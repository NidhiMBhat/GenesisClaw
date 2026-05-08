
/**
 * GenesisClaw — pipeline.js
 * Orchestrates: Abstract → Gap Extraction → GitHub Context → Execution Plan → Leaderboard
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractGaps } from "./gap-extractor.js";
import { generatePlan } from "./execution-planner.js";
import { readFileSync } from "fs";
import { execSync } from "child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEADERBOARD_PATH = path.join(__dirname, "leaderboard.json");
const GAP_SCHEMA = JSON.parse(readFileSync("./schemas/gap-schema.json", "utf8"));
const PLAN_SCHEMA = JSON.parse(readFileSync("./schemas/plan-schema.json", "utf8"));
const PENDING_PATH = path.join(__dirname, "memory/pending-abstract.json");

function savePending(abstract, githubContext) {
  const dir = path.join(__dirname, "memory");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const pending = fs.existsSync(PENDING_PATH)
    ? JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"))
    : [];

  pending.push({
    id: `pending_${Date.now()}`,
    abstract,
    githubContext,
    queued_at: new Date().toISOString(),
    retries: 0
  });

  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
  console.log("[pipeline] Abstract saved to pending queue.");
}

function removePending(id) {
  if (!fs.existsSync(PENDING_PATH)) return;
  const pending = JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));
  fs.writeFileSync(
    PENDING_PATH,
    JSON.stringify(pending.filter(p => p.id !== id), null, 2)
  );
}
function validateAgainstSchema(data, schema, label) {
  const required = schema.required || [];
  for (const field of required) {
    if (data[field] === undefined) {
      throw new Error(`${label} missing required field: "${field}"`);
    }
  }
  return true;
}
// ─────────────────────────────────────────────
// Leaderboard Helpers
// ─────────────────────────────────────────────
// Add this helper at the top of pipeline.js
async function withRetry(fn, retries = 3, delayMs = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message?.includes("429");
      if (is429 && i < retries - 1) {
        console.warn(`[pipeline] Rate limited. Retrying in ${delayMs / 1000}s... (attempt ${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

// Then wrap the extractGaps call:

function readLeaderboard() {
  try {
    if (!fs.existsSync(LEADERBOARD_PATH)) {
      fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(LEADERBOARD_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err){
    console.error("[pipeline] Failed to read leaderboard, resetting to []:", err.message);
    return [];
  }
}

function writeLeaderboard(entries) {
  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(entries, null, 2));
}

function appendLeaderboard(entry) {
  const board = readLeaderboard();
  board.unshift(entry); // newest first
  writeLeaderboard(board.slice(0, 100)); // cap at 100 entries
}

// ─────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────

function validateAbstract(abstract) {
  if (!abstract || typeof abstract !== "string") {
    throw new Error("abstract must be a non-empty string");
  }
  if (abstract.trim().length < 50) {
    throw new Error("abstract is too short — minimum 50 characters");
  }
  if (abstract.length > 10000) {
    throw new Error("abstract exceeds maximum length of 10,000 characters");
  }
}

function validateGithubContext(githubContext) {
  if (!Array.isArray(githubContext)) {
    throw new Error("github_context must be an array");
  }
  // Each item should have at least a name or url; warn if malformed
  return githubContext.filter((repo) => {
    const valid = repo && (repo.name || repo.full_name || repo.url || repo.html_url);
    if (!valid) console.warn("[pipeline] Skipping malformed github_context entry:", repo);
    return valid;
  });
}

// ─────────────────────────────────────────────
// Core Pipeline
// ─────────────────────────────────────────────

/**
 * Full GenesisClaw pipeline.
 *
 * @param {string}   abstract       - Research paper abstract text
 * @param {Array}    githubContext  - Repos from Dev 2's GitHub search (can be [])
 * @param {Object}   options
 * @param {boolean}  options.skipLeaderboard  - Set true during tests
 * @param {number}   options.maxGaps          - Max gaps to process (default: 4)
 *
 * @returns {Promise<Object>} result
 */
export async function runPipeline(abstract, githubContext = [], options = {}) {
  const { skipLeaderboard = false, maxGaps = 4, timelineHours = 24, teamSize = 4 } = options;
  const startTime = Date.now();

  // ── Step 0: Validate inputs ──────────────────
  validateAbstract(abstract);
  const cleanedRepos = validateGithubContext(githubContext);

  console.log("[pipeline] Starting GenesisClaw pipeline...");
  console.log(`[pipeline] Abstract length: ${abstract.length} chars`);
  console.log(`[pipeline] GitHub repos provided: ${cleanedRepos.length}`);

  // ── Step 1: Extract Research Gaps ───────────
  console.log("[pipeline] Step 1 — Extracting research gaps...");
  let gaps = [];
  
 
  try {
    gaps = await withRetry(() => extractGaps(abstract));
    const clusteringResult = execSync(
  `python3 dev2_module.py "${JSON.stringify(gaps).replace(/"/g, '\\"')}"`
).toString();

const clusteredGaps = JSON.parse(clusteringResult);

console.log("[pipeline] Clustered gaps:", clusteredGaps);

gaps = clusteredGaps;
  } catch (err) {
    savePending(abstract, githubContext); // ← queue it for retry
  
    console.error("[pipeline] Gap extraction threw:", err.message);
    throw new Error(`Gap extraction failed: ${err.message}`);
  }
  gaps.forEach((gap, i) => {
  validateAgainstSchema(gap, GAP_SCHEMA, `Gap[${i}]`);
  });
  if (!gaps.length) {
    const result = {
      status: "no_gaps",
      message: "No research gaps found in this abstract.",
      gaps: [],
      plans: [],
      meta: {
        abstract_length: abstract.length,
        github_repos_used: cleanedRepos.length,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
    console.log("[pipeline] No gaps found. Returning early.");
    return result;
  }

  // Cap how many gaps we process to avoid runaway API calls
  const gapsToProcess = gaps.slice(0, maxGaps);
  console.log(
    `[pipeline] Found ${gaps.length} gap(s). Processing top ${gapsToProcess.length}.`
  );

  // ── Step 2: Generate Plans for Each Gap ─────
  console.log("[pipeline] Step 2 — Generating execution plans...");
  const planResults = await Promise.allSettled(
    gapsToProcess.map((gap, i) => {
      console.log(`[pipeline]   → Planning gap ${i + 1}: "${gap.gap_text?.slice(0, 60)}..."`);
      return generatePlan(gap.gap_text, gap.keywords, cleanedRepos, timelineHours, teamSize);
    })
  );
  // Separate successes from failures
  const plans = [];
  const errors = [];

  planResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      plans.push({
        gap_index: i,
        gap_text: gapsToProcess[i].gap_text,
        gap_confidence: gapsToProcess[i].confidence,
        plan: result.value,
      });
    } else {
      console.error(`[pipeline] Plan ${i + 1} failed:`, result.reason?.message);
      errors.push({
        gap_index: i,
        gap_text: gapsToProcess[i].gap_text,
        error: result.reason?.message || "Unknown error",
      });
    }
  });

  plans.forEach((p, i) => {
    validateAgainstSchema(p.plan, PLAN_SCHEMA, `Plan[${i}]`);
  });

  const duration = Date.now() - startTime;

  // ── Step 3: Build Final Result ───────────────
  const finalResult = {
    status: errors.length === 0 ? "success" : plans.length > 0 ? "partial" : "all_failed",
    gaps: gapsToProcess,
    plans,
    errors: errors.length ? errors : undefined,
    meta: {
      abstract_length: abstract.length,
      gaps_found: gaps.length,
      gaps_processed: gapsToProcess.length,
      plans_generated: plans.length,
      github_repos_used: cleanedRepos.length,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    },
  };

  // ── Step 4: Write to Leaderboard & Save Run ──
  if (!skipLeaderboard && plans.length > 0) {
    const runId = `run_${Date.now()}`;
    const leaderEntry = {
      id: runId,
      timestamp: finalResult.meta.timestamp,
      status: finalResult.status,
      top_gap: gapsToProcess[0]?.gap_text,
      top_gap_confidence: gapsToProcess[0]?.confidence,
      top_keywords: gapsToProcess[0]?.keywords,
      gaps_found: gaps.length,
      plans_generated: plans.length,
      github_repos_used: cleanedRepos.length,
      duration_ms: duration,
      // Include recommended models from first plan for quick dashboard view
      recommended_models: plans[0]?.plan?.deployment?.recommended_models || [],
      on_device_compatible: plans[0]?.plan?.deployment?.on_device_compatible || false,
    };
    appendLeaderboard(leaderEntry);

    // Save full run to memory/runs
    const runsDir = path.join(__dirname, "memory", "runs");
    if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
    finalResult.id = runId;
    fs.writeFileSync(path.join(runsDir, `${runId}.json`), JSON.stringify(finalResult, null, 2));

    console.log(`[pipeline] Leaderboard updated and run saved (${duration}ms total).`);
  }

  console.log(
    `[pipeline] Done. Status: ${finalResult.status} | Plans: ${plans.length} | Time: ${duration}ms`
  );
  return finalResult;
}

// ─────────────────────────────────────────────
// Direct run (node pipeline.js) — quick smoke test
// ─────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const testAbstract = `
    Large language models (LLMs) have demonstrated remarkable performance on NLP benchmarks,
    but their deployment on resource-constrained edge devices remains challenging. Existing
    quantization techniques reduce model size but often degrade performance on low-resource
    languages. No standardized benchmark currently exists for evaluating quantized LLMs on
    Indic languages under 2GB RAM constraints. Furthermore, the trade-off between inference
    latency and accuracy for 4-bit quantized models on mobile NPUs has not been systematically
    studied across multilingual settings.
  `;

  runPipeline(testAbstract, [], { skipLeaderboard: true })
    .then((r) => {
      console.log("\n=== PIPELINE RESULT ===");
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => console.error("Pipeline smoke test failed:", e));
}