import { getModel } from "./gemini-client.js";

const SYSTEM_PROMPT = `You are a senior AI hackathon architect. Given a research gap and GitHub context, output a complete 24-hour hackathon execution plan as a single valid JSON object.

The JSON must contain exactly these top-level keys:
1. "architecture" — array of exactly 5 objects: { layer (int), name, description, tech_stack (array) }
2. "timeline" — array of time blocks 0-24h: { hour_range, task, owner, deliverable }
3. "roles" — array of exactly 4 objects: { role_title, responsibilities (array), required_skills (array) }
4. "deployment" — object: { recommended_models (array), on_device_compatible (bool), constraints (array) }

Deployment rules:
- If recommending models under 7B parameters, set on_device_compatible: true
- Always specify RAM/VRAM requirements in constraints
- Prefer open-source, quantized models where possible

Output ONLY the JSON object. No markdown fences, no explanation, no preamble.`;

/**
 * @param {string} gap - The research gap text
 * @param {string[]} keywords - Keywords from gap extraction
 * @param {Array} githubContext - Top repos from Dev 2's GitHub search
 * @returns {Promise<Object>} - Full execution plan
 */
export async function generatePlan(gap, keywords, githubContext) {
  const model = getModel();

  const input = JSON.stringify({ gap, keywords, github_context: githubContext }, null, 2);

  const prompt = `${SYSTEM_PROMPT}

Input:
${input}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Validate required keys
    const required = ["architecture", "timeline", "roles", "deployment"];
    for (const key of required) {
      if (!parsed[key]) throw new Error(`Missing key: ${key}`);
    }
    if (parsed.architecture.length !== 5) throw new Error("Architecture must have exactly 5 layers");
    if (parsed.roles.length !== 4) throw new Error("Roles must have exactly 4 entries");

    return parsed;

  } catch (err) {
    console.error("Plan generation failed:", err.message);
    throw err;
  }
}