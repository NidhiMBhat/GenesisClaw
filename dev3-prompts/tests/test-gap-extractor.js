import { extractGaps } from "../skills/gap-extractor.js";

// Sample abstracts for testing (replace with real Semantic Scholar pulls)
const testAbstracts = [
  `We present a multimodal sentiment analysis system for high-resource languages. 
   While our model achieves state-of-the-art on English and Mandarin benchmarks, 
   no comparable dataset exists for Dravidian languages such as Kannada or Telugu, 
   limiting deployment in South Asian markets.`,

  `This paper surveys large language model hallucination in legal reasoning tasks. 
   Current benchmarks focus on US common law; no standardized evaluation exists 
   for civil law jurisdictions or Indian statutory frameworks like the BNS.`,

  `We introduce a retrieval-augmented generation pipeline for clinical notes. 
   The system performs well on English EHR data but has not been evaluated 
   on multilingual or low-resource clinical settings.`
];

let passed = 0;
let failed = 0;

for (let i = 0; i < testAbstracts.length; i++) {
  console.log(`\n--- Test ${i + 1} ---`);
  try {
    const gaps = await extractGaps(testAbstracts[i]);
    console.log("Gaps found:", gaps.length);
    console.log(JSON.stringify(gaps, null, 2));

    // Basic validation
    if (!Array.isArray(gaps)) throw new Error("Not an array");
    for (const g of gaps) {
      if (!g.gap_text || !g.keywords || !g.confidence) throw new Error("Missing fields");
      if (!["high", "medium", "low"].includes(g.confidence)) throw new Error("Bad confidence value");
    }
    console.log("✅ PASS");
    passed++;
  } catch (err) {
    console.error("❌ FAIL:", err.message);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);