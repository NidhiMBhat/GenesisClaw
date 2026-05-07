/**
 * GenesisClaw — server.js
 * Express API server. Entry point for Dev 2's GitHub search results + Dev 3's pipeline.
 */

import 'dotenv/config';
import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import { readFileSync, existsSync } from "fs";
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
  const { abstract, github_context } = req.body;

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
    const result = await runPipeline(abstract, github_context || []);
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

// ─────────────────────────────────────────────

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
      "POST /api/analyze/gaps-only",
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
  console.log(`   Leaderboard: GET  http://localhost:${PORT}/api/leaderboard\n`);
});

export default app; // exported for testing