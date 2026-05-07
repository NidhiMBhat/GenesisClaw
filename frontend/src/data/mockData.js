export const MOCK_LEADERBOARD = {
  entries: [
    {
      id: "run_1714523491",
      timestamp: new Date().toISOString(),
      status: "success",
      top_gap: "No standardized benchmark currently exists for evaluating quantized LLMs on Indic languages under 2GB RAM constraints.",
      top_gap_confidence: "high",
      top_keywords: ["multilingual NLP", "Indic language models", "benchmarking"],
      gaps_found: 3,
      plans_generated: 1,
      github_repos_used: 3,
      duration_ms: 3205,
      recommended_models: ["Llama-3-8B-Instruct-GGUF", "Mistral-7B-v0.2"],
      on_device_compatible: true,
    },
    {
      id: "run_1714523492",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "success",
      top_gap: "The trade-off between inference latency and accuracy for 4-bit quantized models on mobile NPUs has not been systematically studied.",
      top_gap_confidence: "medium",
      top_keywords: ["quantized LLM inference", "mobile AI", "NPU"],
      gaps_found: 2,
      plans_generated: 1,
      github_repos_used: 2,
      duration_ms: 2840,
      recommended_models: ["Phi-3-Mini-4k-Instruct"],
      on_device_compatible: true,
    },
    {
      id: "run_1714523493",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: "partial",
      top_gap: "Federated learning frameworks for genomic data lack efficient differential privacy mechanisms that don't destroy predictive power.",
      top_gap_confidence: "high",
      top_keywords: ["federated learning", "differential privacy", "genomics"],
      gaps_found: 4,
      plans_generated: 2,
      github_repos_used: 0,
      duration_ms: 4500,
      recommended_models: ["GPT-4o", "Claude 3.5 Sonnet"],
      on_device_compatible: false,
    }
  ],
  count: 3
};

export const MOCK_GAPS = {
  status: "success",
  gaps: [
    {
      gap_text: "Current anomaly detection models for industrial IoT do not adequately handle sudden distribution shifts caused by equipment degradation.",
      keywords: ["anomaly detection", "industrial IoT", "distribution shift"],
      confidence: "high"
    },
    {
      gap_text: "There is a lack of interpretability methods (XAI) specifically designed to explain decisions made by graph neural networks (GNNs) on dynamic supply chain graphs.",
      keywords: ["XAI", "graph neural networks", "supply chain"],
      confidence: "medium"
    }
  ],
  meta: { count: 2 }
};

export const MOCK_ANALYSIS_PLAN = {
  status: "success",
  gaps: MOCK_GAPS.gaps,
  plans: [
    {
      gap_text: MOCK_GAPS.gaps[0].gap_text,
      plan: {
        architecture: [
          { layer: 1, name: "Data Ingestion", description: "Real-time MQTT stream processor", tech_stack: ["Kafka", "Mosquitto"] },
          { layer: 2, name: "Feature Engineering", description: "Rolling window statistics and frequency domain transforms", tech_stack: ["Pandas", "Scipy"] },
          { layer: 3, name: "Model Core", description: "Adaptive Isolation Forest with concept drift detection", tech_stack: ["Scikit-learn", "River"] },
          { layer: 4, name: "API Layer", description: "FastAPI inference endpoint", tech_stack: ["FastAPI", "Uvicorn"] },
          { layer: 5, name: "Visualization", description: "Real-time anomaly dashboard", tech_stack: ["React", "Recharts"] }
        ],
        timeline: [
          { hour_range: "0-4h", task: "Setup streaming infra and data simulator", owner: "Backend Engineer", deliverable: "Working data stream" },
          { hour_range: "4-12h", task: "Implement drift detection and baseline model", owner: "ML Engineer", deliverable: "Trained adaptive model" },
          { hour_range: "12-18h", task: "Build API and UI integration", owner: "Full Stack", deliverable: "E2E data flow" },
          { hour_range: "18-24h", task: "Testing, optimization, and pitch prep", owner: "Team", deliverable: "Final demo" }
        ],
        roles: [
          { role_title: "ML Engineer", responsibilities: ["Model design", "Drift detection"], required_skills: ["Python", "River", "Time-series"] },
          { role_title: "Data Engineer", responsibilities: ["Stream processing", "IoT simulation"], required_skills: ["Kafka", "MQTT"] },
          { role_title: "Backend Dev", responsibilities: ["API creation", "Deployment"], required_skills: ["FastAPI", "Docker"] },
          { role_title: "Frontend Dev", responsibilities: ["Dashboard UI", "Data viz"], required_skills: ["React", "Recharts"] }
        ],
        deployment: {
          recommended_models: ["LightGBM", "IsolationForest"],
          on_device_compatible: true,
          constraints: ["Max 500MB RAM", "Sub-50ms latency required"]
        }
      }
    }
  ],
  meta: {
    duration_ms: 3500,
    timestamp: new Date().toISOString()
  }
};
