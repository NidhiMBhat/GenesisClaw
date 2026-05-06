import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export function getModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json", // Forces JSON output
      temperature: 0.2,                     // Low temp = deterministic, no hallucinations
      maxOutputTokens: 2048,
    },
  });
}
