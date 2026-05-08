/**
 * ADD THESE TO server.js
 * ─────────────────────────────────────────────────────────
 * Step 1: Add imports at the top of server.js
 * Step 2: Add the SSE client store after imports
 * Step 3: Add the 3 new routes before your 404 catch-all
 * ─────────────────────────────────────────────────────────
 */


// ── STEP 1: ADD TO IMPORTS (top of server.js) ───────────
import { generatePlan } from "./execution-planner.js";

// ── STEP 2: ADD AFTER IMPORTS (before routes) ───────────

// SSE client store — tracks all connected browser clients
const sseClients = new Set();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}


// ── STEP 3: ADD THESE 3 ROUTES ──────────────────────────


/**
 * GET /api/stream
 * Browser connects here to receive live OpenClaw updates.
 * No Discord, no Telegram — results push directly to frontend.
 *
 * Frontend usage (React):
 * const es = new EventSource('http://localhost:3000/api/stream');
 * es.onmessage = e => setUpdates(prev => [JSON.parse(e.data), ...prev]);
 */
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  sseClients.add(res);
  console.log(`[SSE] Client connected. Total: ${sseClients.size}`);

  // Heartbeat every 25s to keep alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected. Total: ${sseClients.size}`);
  });
});


/**
 * POST /api/openclaw/ingest
 * OpenClaw worker POSTs here after extracting gaps from arXiv.
 * Server runs execution planner and broadcasts result via SSE.
 *
 * Body from openclaw-worker.js:
 * {
 *   source: "openclaw_worker",
 *   paper: { arxivId, title, link, category },
 *   abstract: "string",
 *   gaps: [{ gap_text, keywords, confidence }]
 * }
 */
app.post("/api/openclaw/ingest", async (req, res) => {
  const { source, paper, abstract, gaps } = req.body;

  if (!gaps?.length || !abstract) {
    return res.status(400).json({ error: "gaps and abstract required" });
  }

  console.log(`[ingest] Received ${gaps.length} gap(s) from ${source} — ${paper?.arxivId}`);

  // Broadcast "incoming" event immediately so sidebar shows activity
  broadcastSSE({
    type: "incoming",
    paper: paper?.title,
    arxivId: paper?.arxivId,
    link: paper?.link,
    category: paper?.category,
    gap_count: gaps.length,
    timestamp: new Date().toISOString(),
  });

  // Generate plans for each gap
  const plans = [];
  for (const gap of gaps) {
    try {
      const plan = await generatePlan(gap.gap_text, gap.keywords, []);
      plans.push({ gap, plan });

      // Broadcast each plan as it's generated (real-time)
      broadcastSSE({
        type: "new_result",
        paper: paper?.title,
        arxivId: paper?.arxivId,
        link: paper?.link,
        category: paper?.category,
        gap_text: gap.gap_text,
        confidence: gap.confidence,
        keywords: gap.keywords,
        plan,
        timestamp: new Date().toISOString(),
      });

    } catch (err) {
      console.error(`[ingest] Plan failed for gap: ${err.message}`);
    }
  }

  // Write to leaderboard
  const boardPath = path.join(__dirname, "leaderboard.json");
  try {
    const board = fs.existsSync(boardPath)
      ? JSON.parse(fs.readFileSync(boardPath, "utf8"))
      : [];

    board.unshift({
      id: `oc_${Date.now()}`,
      source: source || "openclaw",
      paper_title: paper?.title,
      arxiv_id: paper?.arxivId,
      arxiv_link: paper?.link,
      category: paper?.category,
      top_gap: gaps[0]?.gap_text,
      confidence: gaps[0]?.confidence,
      plans_generated: plans.length,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(boardPath, JSON.stringify(board.slice(0, 100), null, 2));
  } catch (err) {
    console.error("[ingest] Leaderboard write failed:", err.message);
  }

  return res.json({
    status: "ok",
    plans_generated: plans.length,
    broadcast_to: sseClients.size,
  });
});


/**
 * GET /api/skills
 * Lists available OpenClaw skills from GenesisClaw.
 */
app.get("/api/skills", (_req, res) => {
  res.json({
    skills: [
      { name: "extract_gaps", description: "Extracts falsifiable research gaps from abstract" },
      { name: "generate_plan", description: "Generates 24hr hackathon execution plan for a gap" },
      { name: "full_pipeline", description: "Runs complete abstract → gaps → plans pipeline" },
    ]
  });
});