# 🦾 GenesisClaw

**GenesisClaw** is an autonomous AI research agent and execution pipeline. It continuously monitors arXiv for cutting-edge research papers across specific niches, extracts high-value "research gaps," clusters them using machine learning, and generates comprehensive hackathon-style execution plans (including architecture, timelines, and team roles) to solve those gaps.

## Presentation
* [View Project Presentation](https://github.com/NidhiMBhat/GenesisClaw/blob/main/RVCE_RuntimeTerror_RVCE.pptx)
* Demo Video link :https://drive.google.com/file/d/1sgsZYSpsOSVhGc7el8DarmdGHShf6a0M/view?usp=sharing
*  AI Disclosure :https://drive.google.com/file/d/1sgsZYSpsOSVhGc7el8DarmdGHShf6a0M/view?usp=sharing

## ✨ Key Features

* **Autonomous Research Worker:** A background daemon (`openclaw-worker`) that actively polls arXiv based on dynamically configurable niches (e.g., AI, NLP, Medical) stored in `heartbeat.md`.
* **Intelligent Gap Extraction:** Uses LLMs to parse complex abstracts and identify distinct research opportunities.
* **Python-Powered Clustering:** Integrates a Python module (`dev2_module.py`) to cluster similar research gaps and eliminate redundancy.
* **Execution Planner:** Automatically generates an actionable project plan including layered architecture, a time-boxed execution timeline (e.g., 24-hour hackathon sprint), and role delegations.
* **Real-Time Dashboard:** A React/Vite frontend featuring Server-Sent Events (SSE) for live updates as the autonomous worker discovers new papers and generates plans.

---

## 🏗️ System Architecture

GenesisClaw operates on a decoupled, dual-engine architecture:

1.  **The Brain (Express API):** Handles requests from the UI, orchestrates the LLM pipeline, runs Python clustering, and manages the local JSON memory (`leaderboard.json` and `memory/runs/`).
2.  **The Autonomous Agent (Worker):** A standalone Node process that runs continuously, fetching papers and pushing them into the API's ingestion pipeline.
3.  **The Command Center (React UI):** A dashboard to view trending gaps, monitor the live feed, and manually trigger new analysis flows.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, React Router, TailwindCSS, Lucide Icons
* **Backend:** Node.js, Express, Server-Sent Events (SSE)
* **Data Processing:** Python 3 (Clustering module)
* **Process Management:** PM2
* **Deployment:** Google Cloud Platform (Compute Engine), Vercel, Ngrok

---

## 🚀 Local Development Setup

### Prerequisites
* Node.js (v20+)
* Python 3.x
* A Gemini API Key (or preferred LLM provider)

### 1. Clone the Repository
```bash
git clone [https://github.com/NidhiMBhat/GenesisClaw.git]
cd GenesisClaw
2. Configure the Backend (The Brain & Worker)
Bash
# Navigate to the backend directory (if separate, or stay in root)
npm install

# Create your environment file
cp .env.example .env
# Edit .env and add your LLM API keys and PORT=3000
Open three separate terminals to run the stack locally:

Terminal 1: Start the API Server

Bash
node server.js
Terminal 2: Start the Autonomous Worker

Bash
node openclaw-worker.js
3. Configure the Frontend (The Command Center)
Terminal 3: Start the UI

Bash
cd frontend  # or your specific UI folder name
npm install
npm run dev
Navigate to http://localhost:5173 to view the dashboard. Ensure src/services/api.js has API_BASE set to http://localhost:3000/api.

☁️ Cloud Deployment (GCP + Vercel)
Due to the local file system requirements for agent memory (memory/runs/), the backend must be hosted on a persistent Virtual Machine.

Backend (Google Cloud Compute Engine)
Spin up an e2-micro Ubuntu instance on GCP.

Clone the repo and run npm install.

Use PM2 to keep the dual engines running 24/7:

Bash
sudo npm install -g pm2
pm2 start server.js --name "genesis-api"
pm2 start openclaw-worker.js --name "genesis-worker"
pm2 save && pm2 startup
Secure Tunneling: To bypass Mixed Content blocks on the frontend, use Ngrok to expose the API securely:

Bash
npx ngrok http 3000
Frontend (Vercel)
Update src/services/api.js and src/pages/Dashboard.jsx to use the secure Ngrok URL (e.g., https://your-tunnel.ngrok-free.app/api).

Push your code to GitHub.

Import the project into Vercel and deploy.
