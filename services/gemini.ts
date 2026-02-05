
import { GoogleGenAI, Type } from "@google/genai";
import { ImageAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function analyzeImageStyle(base64Image: string): Promise<ImageAnalysis> {
  const prompt = `Analyze the color grading and visual style of this image. Provide:
  1. A creative style name (MUST be exactly 2 words, e.g., "Muted Nordic", "Neon Cyberpunk").
  2. A brief 2-sentence description of the color profile (highlights, shadows, saturation).
  3. A list of 5 dominant hex color codes.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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

  const data = JSON.parse(response.text);
  // Robustness check for 2 words
  const words = data.styleName.trim().split(/\s+/);
  if (words.length !== 2) {
    data.styleName = words.slice(0, 2).join(' ') || "Visual Style";
    if (words.length < 2) data.styleName = `${words[0] || 'Custom'} Look`;
  }
  
  return data;
}
