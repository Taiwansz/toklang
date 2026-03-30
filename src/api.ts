/**
 * TokLang — Cliente Gemini Pro (Respostas Finais)
 *
 * Enquanto o ai-compressor.ts usa Flash para compressão rápida,
 * este módulo usa Pro para gerar as respostas de qualidade ao usuário.
 *
 * Separamos em módulos distintos porque:
 * - Cada chamada tem configs diferentes (temperature, maxTokens, etc.)
 * - Facilita trocar de modelo independentemente
 * - O histórico de conversa fica encapsulado aqui
 *
 * Suporte a multi-turn: o histórico de conversa é passado em cada chamada,
 * permitindo que o Gemini mantenha contexto entre perguntas da mesma sessão.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import type { ChatMessage } from "./core/types";

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

/**
 * Cria um cliente de chat Gemini Pro.
 */
export function createGeminiClient(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",   // usando Flash também para resposta (mais custo-efetivo)
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,   // resposta balanceada: nem robótica, nem alucinada
      topP: 0.95,
      topK: 40,
    },
    safetySettings: SAFETY_SETTINGS,
  });

  /**
   * Envia o prompt comprimido para o Gemini e retorna a resposta completa.
   *
   * @param compressedPrompt - Prompt já processado pelo TokLang
   * @param history - Histórico de mensagens anteriores da sessão
   * @returns Texto da resposta do modelo
   */
  async function chat(
    compressedPrompt: string,
    history: ChatMessage[] = []
  ): Promise<string> {
    try {
      // Inicia uma sessão de chat com o histórico existente
      const chatSession = model.startChat({
        history: history,
      });

      const result = await chatSession.sendMessage(compressedPrompt);
      const response = result.response;

      return response.text();
    } catch (error) {
      const err = error as Error;

      // Erros conhecidos com mensagens amigáveis
      if (err.message.includes("API_KEY_INVALID") || err.message.includes("API key")) {
        throw new Error(
          "GEMINI_API_KEY inválida. Verifique seu arquivo .env e tente novamente."
        );
      }

      if (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("quota")) {
        throw new Error(
          "Cota da API Gemini atingida. Aguarde alguns minutos e tente novamente."
        );
      }

      // Erro genérico — repropaga com contexto
      throw new Error(`Erro na API Gemini: ${err.message}`);
    }
  }

  return { chat };
}
