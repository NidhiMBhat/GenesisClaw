# OpenClaw Heartbeat Config
# This file is read by openclaw-worker.js on every wake cycle.
# Edit values here — no code changes needed.

## Schedule
interval_minutes: 30
run_on_start: true

## arXiv Topics to Watch
## All available niches — comment out ones you don't want
## Or use POST /api/niches to update from frontend
active_niches:
  - ai         # cs.AI  — Artificial Intelligence
  - nlp        # cs.CL  — NLP / LLMs
  - ml         # cs.LG  — Machine Learning
  - rag        # cs.IR  — Information Retrieval / RAG
  - cv         # cs.CV  — Computer Vision
  - medical    # q-bio.QM — Medical / Biomedical
  - finance    # q-fin.CP — Computational Finance
  - security   # cs.CR  — Cybersecurity
  - robotics   # cs.RO  — Robotics
  - statistics # stat.ML — Statistical ML

## Paper Limits
max_papers_per_cycle: 3
min_abstract_length: 150
skip_seen: true

## GenesisClaw Backend
post_endpoint: http://localhost:3000/api/openclaw/ingest

## Gap Filter
min_confidence: medium
max_gaps_per_paper: 2

## Logging
log_level: info
log_file: memory/openclaw.log