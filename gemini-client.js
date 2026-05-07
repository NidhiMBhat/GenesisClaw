import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export function getModel() {
  return {
    generateContent: async (prompt) => {
      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      return {
        response: {
          text: () => response.choices[0].message.content
        }
      };
    }
  };
}