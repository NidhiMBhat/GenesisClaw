/**
 * GenesisClaw — openclaw-worker.js
 * The OpenClaw daemon. Reads heartbeat.md config, wakes on schedule,
 * fetches arXiv papers, runs Gap Extractor, POSTs to Express backend.
 *
 * Run: node openclaw-worker.js
 * Runs independently from server.js
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractGaps } from "./gap-extractor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NICHE_MAP = {
  // Computer Science
  ai:          "cs.AI",
  nlp:         "cs.CL",
  ml:          "cs.LG",
  cv:          "cs.CV",
  robotics:    "cs.RO",
  security:    "cs.CR",
  databases:   "cs.DB",
  systems:     "cs.DC",
  rag:         "cs.IR",   // information retrieval

  // Science & Medicine
  medical:     "q-bio.QM",
  biology:     "q-bio.BM",
  neuroscience:"q-bio.NC",
  genomics:    "q-bio.GN",

  // Finance & Law
  finance:     "q-fin.CP",
  economics:   "econ.GN",

  // Physics & Math
  physics:     "physics.gen-ph",
  math:        "math.ST",
  statistics:  "stat.ML",

  // Emerging
  climate:     "physics.ao-ph",
  materials:   "cond-mat.mtrl-sci",
};

// ─────────────────────────────────────────────
// Config Reader — parses heartbeat.md
// ─────────────────────────────────────────────

function readHeartbeat() {
  const raw = fs.readFileSync(
    path.join(__dirname, "heartbeat.md"),
    "utf8"
  );

  const get = (key, fallback) => {
    const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : fallback;
  };

  function getActiveFeeds(raw) {
  const nichesMatch = raw.match(/active_niches:\n((?:\s+-[^\n]+\n?)+)/);
  if (!nichesMatch) {
    // fallback if section missing from heartbeat.md
    return ["cs.AI", "cs.CL", "cs.LG"];
  }
  return nichesMatch[1]
    .split("\n")
    .filter(l => l.trim().startsWith("-"))
    .map(l => {
      const niche = l.replace("-", "").split("#")[0].trim();
      return NICHE_MAP[niche] || niche; // if unknown, use raw value
    })
    .filter(Boolean);
}

  return {
    intervalMs: parseInt(get("interval_minutes", "30")) * 60 * 1000,
    runOnStart: get("run_on_start", "true") === "true",
    feeds: getActiveFeeds(raw), 
    maxPapers: parseInt(get("max_papers_per_cycle", "3")),
    minAbstractLength: parseInt(get("min_abstract_length", "150")),
    postEndpoint: get("post_endpoint", "http://localhost:3000/api/openclaw/ingest"),
    minConfidence: get("min_confidence", "medium"),
    maxGapsPerPaper: parseInt(get("max_gaps_per_paper", "2")),
    logFile: get("log_file", "memory/openclaw.log"),
  };
}

// ─────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────

function log(level, message, config) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  console.log(line);

  if (config?.logFile) {
    const logPath = path.join(__dirname, config.logFile);
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, line + "\n");
  }
}

// ─────────────────────────────────────────────
// Seen Papers (memory/seen-papers.json)
// ─────────────────────────────────────────────

const SEEN_PATH = path.join(__dirname, "memory/seen-papers.json");

function loadSeen() {
  try {
    if (!fs.existsSync(SEEN_PATH)) return new Set();
    return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")));
  } catch { return new Set(); }
}

function saveSeen(seen) {
  const dir = path.dirname(SEEN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const trimmed = Array.from(seen).slice(-500);
  fs.writeFileSync(SEEN_PATH, JSON.stringify(trimmed, null, 2));
}

// ─────────────────────────────────────────────
// arXiv Fetcher
// ─────────────────────────────────────────────

async function fetchArxivPapers(category, maxPapers, minLength) {
  const url = `https://rss.arxiv.org/rss/${category}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const xml = await res.text();
    const papers = [];

    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    for (const match of itemMatches) {
      if (papers.length >= maxPapers) break;
      const block = match[1];

      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.replace(/<!\[CDATA\[|\]\]>/g, "").trim();

      const abstract = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
        ?.replace(/<!\[CDATA\[|\]\]>/g, "")
        ?.replace(/<[^>]+>/g, "")
        .trim();

      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
        || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim();

      const arxivId = link?.match(/abs\/(.+)/)?.[1]?.trim();

      if (
        title && abstract && arxivId &&
        abstract.length >= minLength
      ) {
        papers.push({ title, abstract, link, arxivId, category });
      }
    }

    return papers;
  } catch (err) {
    return [];
  }
}

// ─────────────────────────────────────────────
// Confidence Filter
// ─────────────────────────────────────────────

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

function meetsMinConfidence(gap, minConfidence) {
  return (CONFIDENCE_RANK[gap.confidence] || 0) >=
    (CONFIDENCE_RANK[minConfidence] || 0);
}

// ─────────────────────────────────────────────
// POST to GenesisClaw Backend
// ─────────────────────────────────────────────

async function postToBackend(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backend ${res.status}: ${err}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
// Main Wake Cycle
// ─────────────────────────────────────────────

async function wakeCycle(config) {
  log("info", `⏰ OpenClaw waking up — cycle start`, config);

  const seen = loadSeen();
  let totalProcessed = 0;

  for (const category of config.feeds) {
    log("info", `📡 Fetching arXiv:${category}...`, config);

    const papers = await fetchArxivPapers(
      category,
      config.maxPapers,
      config.minAbstractLength
    );

    log("info", `   Found ${papers.length} papers in ${category}`, config);

    for (const paper of papers) {
      if (seen.has(paper.arxivId)) {
        log("info", `   ↪ Skipping seen: ${paper.arxivId}`, config);
        continue;
      }

      log("info", `   📄 Processing: "${paper.title?.slice(0, 55)}..."`, config);

      // Step 1: Extract gaps using GenesisClaw skill
      let gaps = [];
      try {
        gaps = await extractGaps(paper.abstract);
        log("info", `   🔍 Gaps found: ${gaps.length}`, config);
      } catch (err) {
        log("error", `   Gap extraction failed: ${err.message}`, config);
        seen.add(paper.arxivId);
        continue;
      }

      // Filter by confidence
      const filteredGaps = gaps
        .filter(g => meetsMinConfidence(g, config.minConfidence))
        .slice(0, config.maxGapsPerPaper);

      if (!filteredGaps.length) {
        log("info", `   ⚠ No gaps above min confidence. Skipping.`, config);
        seen.add(paper.arxivId);
        continue;
      }

      // Step 2: POST to GenesisClaw backend
      const payload = {
        source: "openclaw_worker",
        paper: {
          arxivId: paper.arxivId,
          title: paper.title,
          link: paper.link,
          category: paper.category,
        },
        abstract: paper.abstract,
        gaps: filteredGaps,
      };

      try {
        const result = await postToBackend(config.postEndpoint, payload);
        log("info", `   ✅ Posted to backend. Plans: ${result.plans_generated || 0}`, config);
        totalProcessed++;
      } catch (err) {
        log("error", `   POST failed: ${err.message}`, config);
      }

      seen.add(paper.arxivId);

      // Delay between papers to respect API rate limits
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  saveSeen(seen);
  log("info", `✅ Cycle complete. Papers processed: ${totalProcessed}\n`, config);
}

// ─────────────────────────────────────────────
// Start Daemon
// ─────────────────────────────────────────────

async function start() {
  console.log(`
╔═══════════════════════════════════╗
║   OpenClaw Worker — GenesisClaw   ║
║   Background Research Daemon      ║
╚═══════════════════════════════════╝
  `);

  const config = readHeartbeat();

  console.log(`Config loaded from heartbeat.md:`);
  console.log(`  Interval:   ${config.intervalMs / 60000} minutes`);
  console.log(`  Feeds:      ${config.feeds.join(", ")}`);
  console.log(`  Endpoint:   ${config.postEndpoint}`);
  console.log(`  Max papers: ${config.maxPapers} per cycle\n`);

  if (config.runOnStart) {
    await wakeCycle(config);
  }

  setInterval(() => wakeCycle(config), config.intervalMs);
  log("info", `Daemon running. Next cycle in ${config.intervalMs / 60000} mins.`, config);
}

start().catch(err => {
  console.error("OpenClaw worker crashed:", err);
  process.exit(1);
});