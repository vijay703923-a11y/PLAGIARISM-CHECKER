
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "./types";

export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  // Use process.env.API_KEY directly as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
    You are a professional academic integrity officer and writing coach.
    Analyze the provided text for:
    1. Plagiarism: Use Google Search to find matches. Be strict but fair.
    2. Grammar: Identify errors and flow issues.
    3. Suggestions: Provide 3 high-quality paraphrased versions for any flagged segments.
    4. Subtopics: Identify sections or key themes in the text.

    Format the output as a valid JSON object only. 
    The 'segments' array must reconstruct the original text exactly when concatenated.
    
    Structure:
    {
      "plagiarismPercentage": number (0-100),
      "grammarScore": number (0-100),
      "overallSummary": "string",
      "subtopics": [{ "title": "string", "segmentIndex": number }],
      "segments": [{
        "text": "original segment text",
        "type": "original" | "plagiarism" | "grammar",
        "suggestions": ["string"],
        "sourceUrl": "URL if plagiarism found",
        "explanation": "why it was flagged"
      }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this text: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }]
      },
    });

    const resultText = response.text || "";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

      // Extract URLs from grounding metadata for verified citations
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const urls = groundingChunks
          .map((chunk: any) => chunk.web?.uri)
          .filter(Boolean);
        
        if (urls.length > 0) {
          const uniqueUrls = Array.from(new Set(urls)) as string[];
          parsed.overallSummary += "\n\nVerified Sources:\n" + uniqueUrls.map(u => `- ${u}`).join("\n");
        }
      }

      return parsed;
    }

    throw new Error("Invalid response format from AI.");
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};


