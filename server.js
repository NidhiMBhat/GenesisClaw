/**
 * GenesisClaw — server.js
 * Express API server. Entry point for Dev 2's GitHub search results + Dev 3's pipeline.
 */
import { generatePlan } from "./execution-planner.js";
import fs, { readFileSync, writeFileSync, existsSync } from "fs";
import 'dotenv/config';
import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "1mb" })); // abstracts won't be huge

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[server] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});
const sseClients = new Set();
function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}
// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

/**
 * GET /health
 * Dev 2 uses this to confirm server is alive before sending data.
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    project: "GenesisClaw",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────

/**
 * POST /api/analyze
 *
 * Body:
 * {
 *   "abstract": "string — research paper abstract",
 *   "github_context": [          ← Dev 2 fills this
 *     { "name": "repo-name", "url": "...", "description": "...", "stars": 100 }
 *   ]
 * }
 *
 * Response:
 * {
 *   status: "success" | "partial" | "no_gaps" | "all_failed",
 *   gaps: [...],
 *   plans: [...],
 *   meta: { duration_ms, timestamp, ... }
 * }
 */
app.post("/api/analyze", async (req, res) => {
  const { abstract, github_context, timeline_hours, team_size } = req.body;

  // ── Input validation ──────────────────────
  if (!abstract) {
    return res.status(400).json({
      error: "Missing required field: abstract",
      hint: "Send a JSON body with { abstract: '...', github_context: [] }",
    });
  }

  if (typeof abstract !== "string" || abstract.trim().length < 50) {
    return res.status(400).json({
      error: "abstract must be a string with at least 50 characters",
    });
  }

  if (github_context !== undefined && !Array.isArray(github_context)) {
    return res.status(400).json({
      error: "github_context must be an array (or omit it entirely)",
    });
  }

  // ── Run pipeline ──────────────────────────
  try {
    const result = await runPipeline(abstract, github_context || [], { 
  timelineHours: timeline_hours, 
  teamSize: team_size 
});
    const statusCode = result.status === "all_failed" ? 500 : 200;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error("[server] /api/analyze error:", err.message);
    return res.status(500).json({
      error: "Pipeline execution failed",
      detail: err.message,
    });
  }
});

// ─────────────────────────────────────────────
// server.js — add this route
app.post("/api/retry-pending", async (_req, res) => {
  const pendingPath = path.join(__dirname, "memory/pending-abstract.json");
  if (!fs.existsSync(pendingPath)) return res.json({ message: "No pending abstracts" });

  const pending = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
  if (!pending.length) return res.json({ message: "Queue is empty" });

  const next = pending[0]; // process oldest first
  try {
    const result = await runPipeline(next.abstract, next.githubContext || []);
    removePending(next.id);
    res.json({ processed: next.id, result });
  } catch (err) {
    res.status(500).json({ error: err.message, pending_id: next.id });
  }
});
/**
 * GET /api/leaderboard
 * Returns all past pipeline runs. Dev 2's frontend can poll this.
 */
app.get("/api/leaderboard", (_req, res) => {
  const boardPath = path.join(__dirname, "leaderboard.json");
  try {
    if (!existsSync(boardPath)) {
      return res.json({ entries: [], count: 0 });
    }
    const raw = readFileSync(boardPath, "utf8");
    const entries = JSON.parse(raw);
    return res.json({ entries, count: entries.length });
  } catch (err) {
    console.error("[server] Leaderboard read error:", err.message);
    return res.status(500).json({ error: "Failed to read leaderboard" });
  }
});
/**
 * GET /api/run/:id
 * Returns the full execution plan for a specific run ID.
 * (Merged from Dev 4's UI updates)
 */
app.get("/api/run/:id", (req, res) => {
  const { id } = req.params;
  const runPath = path.join(__dirname, "memory", "runs", `${id}.json`);
  
  try {
    if (!fs.existsSync(runPath)) {
      return res.status(404).json({ error: "Run not found" });
    }
    const raw = fs.readFileSync(runPath, "utf8");
    const runData = JSON.parse(raw);
    return res.json(runData);
  } catch (err) {
    console.error(`[server] Run read error for ${id}:`, err.message);
    return res.status(500).json({ error: "Failed to read run data" });
  }
});
// ─────────────────────────────────────────────

/**
 * POST /api/analyze/gaps-only
 * Lightweight endpoint — only runs gap extraction, no planning.
 * Useful for Dev 2 to fetch keywords BEFORE running their GitHub search.
 *
 * Body: { "abstract": "string" }
 */
app.post("/api/analyze/gaps-only", async (req, res) => {
  const { abstract } = req.body;

  if (!abstract || typeof abstract !== "string") {
    return res.status(400).json({ error: "abstract is required" });
  }

  try {
    // Import inline to avoid circular issues
    const { extractGaps } = await import("./gap-extractor.js");
    const gaps = await extractGaps(abstract);
    return res.json({
      status: gaps.length ? "success" : "no_gaps",
      gaps,
      meta: { timestamp: new Date().toISOString(), count: gaps.length },
    });
  } catch (err) {
    console.error("[server] /api/analyze/gaps-only error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  sseClients.add(res);
  console.log(`[SSE] Client connected. Total: ${sseClients.size}`);

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});
app.post("/api/openclaw/ingest", async (req, res) => {
  const { source, paper, abstract, gaps } = req.body;

  if (!gaps?.length) {
    return res.status(400).json({ error: "gaps required" });
  }

  // Tell frontend a paper arrived
  broadcastSSE({
    type: "incoming",
    paper: paper?.title,
    arxivId: paper?.arxivId,
    link: paper?.link,
    gap_count: gaps.length,
    timestamp: new Date().toISOString(),
  });

  // Generate plan for each gap then broadcast result
  const plans = [];
  for (const gap of gaps) {
    try {
      const plan = await generatePlan(gap.gap_text, gap.keywords, []);
      plans.push({ gap, plan });

      broadcastSSE({
        type: "new_result",
        paper: paper?.title,
        arxivId: paper?.arxivId,
        link: paper?.link,
        gap_text: gap.gap_text,
        confidence: gap.confidence,
        keywords: gap.keywords,
        plan,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[ingest] Plan failed:`, err.message);
    }
  }

  // Write to leaderboard
  const boardPath = path.join(__dirname, "leaderboard.json");
  const board = existsSync(boardPath)
    ? JSON.parse(readFileSync(boardPath, "utf8")) : [];
  board.unshift({
    id: `oc_${Date.now()}`,
    source,
    paper_title: paper?.title,
    arxiv_id: paper?.arxivId,
    top_gap: gaps[0]?.gap_text,
    plans_generated: plans.length,
    timestamp: new Date().toISOString(),
  });
  fs.writeFileSync(boardPath, JSON.stringify(board.slice(0, 100), null, 2));

  return res.json({ status: "ok", plans_generated: plans.length });
});
app.get("/api/skills", (_req, res) => {
  res.json({
    skills: [
      { name: "extract_gaps", owner: "openclaw-worker" },
      { name: "generate_plan", owner: "server /api/openclaw/ingest" },
      { name: "full_pipeline", owner: "server /api/analyze" },
    ]
  });
});
// ─────────────────────────────────────────────
const NICHE_MAP = {
  ai:"cs.AI", nlp:"cs.CL", ml:"cs.LG", cv:"cs.CV",
  robotics:"cs.RO", security:"cs.CR", databases:"cs.DB",
  systems:"cs.DC", rag:"cs.IR", medical:"q-bio.QM",
  biology:"q-bio.BM", neuroscience:"q-bio.NC", genomics:"q-bio.GN",
  finance:"q-fin.CP", economics:"econ.GN", physics:"physics.gen-ph",
  math:"math.ST", statistics:"stat.ML", climate:"physics.ao-ph",
  materials:"cond-mat.mtrl-sci",
};
/**
 * GET /api/niches
 * Returns all available niches + which ones are currently active
 */
app.get("/api/niches", (_req, res) => {
  const raw = readFileSync(path.join(__dirname, "heartbeat.md"), "utf8");
  const nichesMatch = raw.match(/active_niches:\n((?:\s+-[^\n]+\n?)+)/);
  
  const active = nichesMatch
    ? nichesMatch[1]
        .split("\n")
        .filter(l => l.trim().startsWith("-"))
        .map(l => l.replace("-", "").split("#")[0].trim())
        .filter(Boolean)
    : ["ai", "nlp", "ml"];

  res.json({
    available: Object.keys(NICHE_MAP),   // all 20 options
    active,                               // currently enabled
    feed_codes: active.map(n => NICHE_MAP[n] || n), // arXiv codes
  });
});

/**
 * POST /api/niches
 * Frontend sends selected niches, server rewrites heartbeat.md
 * Body: { "niches": ["ai", "rag", "medical"] }
 */
app.post("/api/niches", (req, res) => {
  const { niches } = req.body;

  if (!Array.isArray(niches) || !niches.length) {
    return res.status(400).json({ error: "niches must be a non-empty array" });
  }

  // Validate each niche
  const invalid = niches.filter(n => !NICHE_MAP[n]);
  if (invalid.length) {
    return res.status(400).json({
      error: `Unknown niches: ${invalid.join(", ")}`,
      available: Object.keys(NICHE_MAP)
    });
  }

  // Rewrite active_niches section in heartbeat.md
  const heartbeatPath = path.join(__dirname, "heartbeat.md");
  let raw = readFileSync(heartbeatPath, "utf8");

  const newSection = `active_niches:\n${niches
    .map(n => `  - ${n}         # ${NICHE_MAP[n]}`)
    .join("\n")}\n`;

  if (raw.includes("active_niches:")) {
    // Replace existing section
    raw = raw.replace(/active_niches:\n((?:\s+-[^\n]+\n?)+)/, newSection);
  } else {
    // Append if section missing
    raw += `\n## User Niches\n${newSection}`;
  }

  writeFileSync(heartbeatPath, raw);

  res.json({
    status: "ok",
    active: niches,
    feed_codes: niches.map(n => NICHE_MAP[n]),
    note: "Worker picks this up on next cycle — no restart needed"
  });
});
/**
 * Catch-all — helpful 404 for Dev 2 if they hit a wrong route
 */
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    available_routes: [
      "GET  /health",
      "POST /api/analyze",
      "GET  /api/leaderboard",
      "GET  /api/run/:id",
      "POST /api/analyze/gaps-only",
      "GET  /api/niches",
      "POST /api/niches",
      "GET  /api/stream",
      "POST /api/openclaw/ingest",
      "GET  /api/skills",
    ],
  });
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🦾 GenesisClaw server running on http://localhost:${PORT}`);
  console.log(`   Health:      GET  http://localhost:${PORT}/health`);
  console.log(`   Full run:    POST http://localhost:${PORT}/api/analyze`);
  console.log(`   Gaps only:   POST http://localhost:${PORT}/api/analyze/gaps-only`);
  console.log(`   Leaderboard: GET  http://localhost:${PORT}/api/leaderboard`);
  console.log(`   Niches:      GET  http://localhost:${PORT}/api/niches`);
  console.log(`   Update nich: POST http://localhost:${PORT}/api/niches\n`);
});

export default app; // exported for testing