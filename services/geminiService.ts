import { GoogleGenAI, Type } from "@google/genai";
import { StorageType } from "../types";

export interface IdentifiedFood {
  name: string;
  quantity: number;
  unit: string;
  storageType: StorageType;
  expiryDays: number;
  estimatedPrice: number;
}

const FOOD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Nome do alimento" },
    quantity: { type: Type.NUMBER, description: "Quantidade" },
    unit: { type: Type.STRING, description: "Unidade (kg, g, un, etc)" },
    storageType: { 
      type: Type.STRING, 
      enum: Object.values(StorageType),
      description: "Local de armazenamento" 
    },
    expiryDays: { type: Type.NUMBER, description: "Dias para vencer" },
    estimatedPrice: { type: Type.NUMBER, description: "Preço estimado" }
  },
  required: ["name", "quantity", "unit", "storageType", "expiryDays", "estimatedPrice"]
};

// Helper para obter o cliente AI de forma segura
const getAI = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const identifyFoodInput = async (input: string | { data: string, mimeType: string }): Promise<IdentifiedFood[]> => {
  const isImage = typeof input !== 'string';
  const prompt = isImage 
    ? "Identifique os alimentos na imagem, quantidades e validade."
    : `Extraia alimentos e quantidades deste texto em JSON: "${input}".`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: isImage 
        ? { parts: [{ inlineData: input }, { text: prompt }] } 
        : { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: FOOD_SCHEMA
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Erro no Gemini identifyFoodInput:", e);
    return [];
  }
};

export const interpretConsumption = async (input: string): Promise<{ name: string, quantity: number }[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: `O usuário disse: "${input}". Extraia o que foi consumido em JSON.` }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER }
            },
            required: ["name", "quantity"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Erro no Gemini interpretConsumption:", e);
    return [];
  }
};