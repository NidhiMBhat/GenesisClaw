import 'dotenv/config';
import { getModel } from "./gemini-client.js";

const SYSTEM_PROMPT = `You are a research gap extraction engine. Your ONLY job is to analyze a scientific abstract and return a JSON array of research gaps.

Rules:
1. ONLY return a valid JSON array. No explanation, no preamble, no markdown fences.
2. Each gap must be SPECIFIC and FALSIFIABLE — not vague like "needs more data" but concrete like "No benchmark exists for X on Y dataset".
3. Extract between 1 and 4 gaps per abstract.
4. Each gap object must have exactly these fields:
   - gap_text: string (the specific gap)
   - keywords: array of 2–5 strings (for vector search)
   - confidence: "high" | "medium" | "low"
5. If no clear gap exists, return an empty array: []`;

/**
 * @param {string} abstract - The paper abstract text
 * @returns {Promise<Array>} - Array of gap objects
 */
export async function extractGaps(abstract) {
  const model = getModel();

  const prompt = `${SYSTEM_PROMPT}

Abstract:
${abstract}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      console.error("Gemini returned non-array:", text);
      return [];
    }

    // Filter out vague gaps
    return parsed.filter(gap => {
      const isVague = ["needs more data", "future work", "more research"].some(
        phrase => gap.gap_text?.toLowerCase().includes(phrase)
      );
      return !isVague && gap.gap_text && gap.keywords && gap.confidence;
    });

  } catch (err) {
    console.error("Gap extraction failed:", err.message);
    return [];
  }
}