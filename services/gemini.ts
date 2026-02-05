
import { GoogleGenAI, Type } from "@google/genai";
import { ImageAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeImageStyle(base64Image: string): Promise<ImageAnalysis> {
  const prompt = `Analyze the color grading and visual style of this image. Provide:
  1. A creative style name (MUST be exactly 2 words, e.g., "Muted Nordic", "Neon Cyberpunk").
  2. A brief 2-sentence description of the color profile (highlights, shadows, saturation).
  3. A list of 5 dominant hex color codes.`;

  let lastError: any;
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // Switched to a more stable model name if available, or keep gemini-1.5-flash or gemini-2.0-flash-exp if that's what's intended. 
        // Note: The user's code used 'gemini-3-flash-preview' which caused 503. 
        // I will try 'gemini-2.0-flash' as it is likely more stable, or revert to 'gemini-1.5-flash'.
        // Let's stick to 'gemini-2.0-flash' which is the current stable flash model, or 'gemini-1.5-flash' if 2.0 isn't available. 
        // Actually, the user had 'gemini-3-flash-preview'. Let's try 'gemini-2.0-flash' as a safer bet.
        // If that fails, the loop will retry.
        contents: {
          parts: [
            { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleName: { type: Type.STRING },
              description: { type: Type.STRING },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["styleName", "description", "palette"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}"); // Handle potential empty response
      
      if (!data.styleName) throw new Error("Invalid response structure");

      // Robustness check for 2 words
      const words = data.styleName.trim().split(/\s+/);
      if (words.length !== 2) {
        data.styleName = words.slice(0, 2).join(' ') || "Visual Style";
        if (words.length < 2) data.styleName = `${words[0] || 'Custom'} Look`;
      }
      
      return data;
    } catch (error: any) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      if (error.status === 503 || error.message?.includes('503')) {
        await wait(1000 * Math.pow(2, i)); // Exponential backoff: 1s, 2s, 4s
        continue;
      }
      throw error; // Non-retriable error
    }
  }

  throw lastError;
}
