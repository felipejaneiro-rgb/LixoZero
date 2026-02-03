
import { GoogleGenAI, Type } from "@google/genai";
import { StorageType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface IdentifiedFood {
  name: string;
  quantity: number;
  unit: string;
  storageType: StorageType;
  expiryDays: number; // estimated from identified food
  estimatedPrice: number;
}

const FOOD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Nome comum do alimento em português" },
    quantity: { type: Type.NUMBER, description: "Quantidade numérica identificada" },
    unit: { type: Type.STRING, description: "Unidade de medida (ex: kg, g, unidade, litros)" },
    storageType: { 
      type: Type.STRING, 
      enum: Object.values(StorageType),
      description: "Melhor tipo de armazenamento para este alimento" 
    },
    expiryDays: { type: Type.NUMBER, description: "Estimativa de dias para vencimento se armazenado corretamente" },
    estimatedPrice: { type: Type.NUMBER, description: "Preço médio nacional estimado para esta quantidade" }
  },
  required: ["name", "quantity", "unit", "storageType", "expiryDays", "estimatedPrice"]
};

export const identifyFoodInput = async (input: string | { data: string, mimeType: string }): Promise<IdentifiedFood[]> => {
  const isImage = typeof input !== 'string';
  
  const prompt = isImage 
    ? "Analise esta imagem e identifique os alimentos presentes, suas quantidades aproximadas e unidades de medida. Sugira o melhor armazenamento e a validade média para cada item."
    : `Identifique os alimentos descritos neste texto: "${input}". Extraia quantidades e unidades de medida, sugerindo armazenamento e validade.`;

  // O modelo gemini-3-flash-preview suporta entrada multimodal (texto + imagem) e saída estruturada JSON.
  const modelName = 'gemini-3-flash-preview';
  
  const contents = isImage 
    ? { parts: [{ inlineData: input }, { text: prompt }] }
    : { parts: [{ text: prompt }] };

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: FOOD_SCHEMA
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
};

export const interpretConsumption = async (input: string): Promise<{ name: string, quantity: number }[]> => {
  const prompt = `Interprete o seguinte comando de consumo de alimento: "${input}". 
  Retorne o nome do alimento e a quantidade que o usuário quer consumir.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
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
};
