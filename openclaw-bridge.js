/**
 * GenesisClaw — openclaw-bridge.js
 * Registers GenesisClaw modules as OpenClaw skills.
 * This is the OpenClaw orchestrator — it calls skills in sequence
 * and emits results to SSE clients and leaderboard.
 */

import { extractGaps } from "./gap-extractor.js";
import { generatePlan } from "./execution-planner.js";
import { runPipeline } from "./pipeline.js";
import { EventEmitter } from "events";

// ─────────────────────────────────────────────
// OpenClaw Skill Registry
// Each skill has: name, description, execute()
// ─────────────────────────────────────────────

const skillRegistry = new Map();

function registerSkill(name, description, executeFn) {
  skillRegistry.set(name, { name, description, execute: executeFn });
  console.log(`[openclaw] Skill registered: "${name}"`);
}

// ─────────────────────────────────────────────
// Register GenesisClaw Skills into OpenClaw
// ─────────────────────────────────────────────

// Skill 1: Extract research gaps from abstract
registerSkill(
  "extract_gaps",
  "Extracts specific, falsifiable research gaps from a paper abstract",
  async ({ abstract }) => {
    const gaps = await extractGaps(abstract);
    return { skill: "extract_gaps", output: gaps, count: gaps.length };
  }
);

// Skill 2: Generate 24hr execution plan for a gap
registerSkill(
  "generate_plan",
  "Generates a complete 24-hour hackathon execution plan for a given research gap",
  async ({ gap_text, keywords, github_context = [] }) => {
    const plan = await generatePlan(gap_text, keywords, github_context);
    return { skill: "generate_plan", output: plan };
  }
);

// Skill 3: Full pipeline (gap + plan together)
registerSkill(
  "full_pipeline",
  "Runs the complete GenesisClaw pipeline: abstract → gaps → plans",
  async ({ abstract, github_context = [] }) => {
    const result = await runPipeline(abstract, github_context);
    return { skill: "full_pipeline", output: result };
  }
);

// ─────────────────────────────────────────────
// OpenClaw Orchestrator
// Calls skills in sequence and emits results
// ─────────────────────────────────────────────

export const openClawEvents = new EventEmitter();

/**
 * Run OpenClaw orchestration on an abstract.
 * Emits events at each step so SSE/frontend gets live updates.
 *
 * @param {string} abstract - Paper abstract
 * @param {Array}  githubContext - Repos (can be [])
 * @param {string} source - Where this abstract came from (e.g. "arxiv", "manual")
 */
export async function orchestrate(abstract, githubContext = [], source = "manual") {
  const runId = `oc_${Date.now()}`;
  console.log(`\n[openclaw] Starting orchestration — run: ${runId} | source: ${source}`);

  // Emit start event → SSE picks this up
  openClawEvents.emit("run_start", {
    runId,
    source,
    timestamp: new Date().toISOString(),
    abstract_preview: abstract.slice(0, 100) + "...",
  });

  try {
    // ── Step 1: Call extract_gaps skill ──────
    console.log("[openclaw] Calling skill: extract_gaps");
    openClawEvents.emit("skill_start", { runId, skill: "extract_gaps" });

    const gapSkill = skillRegistry.get("extract_gaps");
    const gapResult = await gapSkill.execute({ abstract });

    openClawEvents.emit("skill_done", {
      runId,
      skill: "extract_gaps",
      result: gapResult,
    });

    if (!gapResult.count) {
      openClawEvents.emit("run_done", { runId, status: "no_gaps" });
      return { runId, status: "no_gaps" };
    }

    // ── Step 2: Call generate_plan for each gap ──
    const plans = [];
    for (const gap of gapResult.output) {
      console.log(`[openclaw] Calling skill: generate_plan for "${gap.gap_text?.slice(0, 50)}..."`);
      openClawEvents.emit("skill_start", { runId, skill: "generate_plan", gap: gap.gap_text });

      const planSkill = skillRegistry.get("generate_plan");
      const planResult = await planSkill.execute({
        gap_text: gap.gap_text,
        keywords: gap.keywords,
        github_context: githubContext,
      });

      plans.push({ gap, plan: planResult.output });

      openClawEvents.emit("skill_done", {
        runId,
        skill: "generate_plan",
        gap: gap.gap_text,
        result: planResult,
      });
    }

    // ── Step 3: Emit final result ────────────
    const finalResult = {
      runId,
      status: "success",
      source,
      gaps: gapResult.output,
      plans,
      timestamp: new Date().toISOString(),
    };

    openClawEvents.emit("run_done", finalResult);
    console.log(`[openclaw] Orchestration complete — ${plans.length} plan(s) generated.`);

    return finalResult;

  } catch (err) {
    console.error("[openclaw] Orchestration failed:", err.message);
    openClawEvents.emit("run_error", { runId, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────
// List all registered skills (for /api/skills endpoint)
// ─────────────────────────────────────────────

export function listSkills() {
  return Array.from(skillRegistry.values()).map(({ name, description }) => ({
    name,
    description,
  }));
}