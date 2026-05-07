import { config } from 'dotenv';
config({ path: './.env' });
import { generatePlan } from "../execution-planner.js";

const testInput = {
  gap: "No existing benchmark evaluates LLM hallucination on Indian statutory law (BNS/IPC citations).",
  keywords: ["legal-rag", "hallucination", "Indian law", "BNS", "benchmark"],
  githubContext: [
    { repo: "explodinggradients/ragas", stars: 6200, description: "Evaluation framework for RAG pipelines" },
    { repo: "mistralai/mistral-src", stars: 8100, description: "Mistral 7B reference implementation" },
    { repo: "chroma-core/chroma", stars: 12000, description: "Embedding database for AI applications" }
  ]
};

try {
  console.log("Generating execution plan...\n");
  const plan = await generatePlan(testInput.gap, testInput.keywords, testInput.githubContext);

  console.log("=== ARCHITECTURE ===");
  plan.architecture.forEach(l => console.log(`Layer ${l.layer}: ${l.name} — ${l.description}`));

  console.log("\n=== TIMELINE ===");
  plan.timeline.forEach(t => console.log(`[${t.hour_range}] ${t.task} (${t.owner})`));

  console.log("\n=== ROLES ===");
  plan.roles.forEach(r => console.log(`${r.role_title}: ${r.responsibilities.join(", ")}`));

  console.log("\n=== DEPLOYMENT ===");
  console.log("Models:", plan.deployment.recommended_models);
  console.log("On-device:", plan.deployment.on_device_compatible);
  console.log("Constraints:", plan.deployment.constraints);

  console.log("\n✅ Execution plan generated successfully");
} catch (err) {
  console.error("❌ Test failed:", err.message);
}