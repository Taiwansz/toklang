/**
 * TokLang — Compressão por IA (Gemini Flash)
 *
 * Segunda camada de compressão: envia o prompt já pré-processado pelas regras léxicas
 * para o Gemini Flash (modelo barato e rápido) que faz compressão semântica profunda.
 *
 * Decisão de design:
 * - Usamos Flash aqui, não Pro: a tarefa é simples (reescrever mais curto), não precisa
 *   de raciocínio complexo. Pro ficaria subutilizado e custaria mais.
 * - O system prompt é estritamente controlado para evitar que o Flash "invente" contexto
 *   ou mude a intenção do prompt original.
 * - maxOutputTokens = 256: prompts comprimidos raramente precisam de mais que isso.
 * - temperature = 0.1: queremos compressão determinística, não criativa.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// System prompt exato conforme especificação
const COMPRESSION_SYSTEM_PROMPT = `Você é um otimizador de prompts para modelos de linguagem.
Sua única função é reescrever o prompt recebido de forma mais densa e direta, removendo qualquer palavra que não adicione significado semântico.
Regras obrigatórias:
- Preserve 100% da intenção e contexto original
- Nunca remova informações técnicas ou específicas
- Responda APENAS com o prompt otimizado
- Sem explicações, sem prefixos, sem aspas`;

// Configurações de segurança permissivas para prompts técnicos
// (sem isso, o Gemini pode recusar pedidos sobre segurança de software, hacking ético, etc.)
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
 * Inicializa o cliente Gemini Flash e retorna uma função de compressão.
 * Usamos factory function para evitar instanciar o cliente repetidamente.
 */
export function createAICompressor(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: COMPRESSION_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.1,       // quase determinístico
      topP: 0.8,
      topK: 20,
    },
    safetySettings: SAFETY_SETTINGS,
  });

  /**
   * Comprime um prompt usando Gemini Flash.
   *
   * @param text - Texto já pré-processado pelas regras léxicas
   * @returns Versão comprimida pelo modelo
   *
   * Em caso de erro (rate limit, rede, etc.), retorna o texto original
   * sem lançar exceção — degradação graceful.
   */
  async function compress(text: string): Promise<string> {
    try {
      const result = await model.generateContent(text);
      const response = result.response;
      const compressed = response.text().trim();

      // Sanidade: se o resultado for mais longo que o original ou vazio,
      // o modelo falhou na tarefa — retornamos o original.
      if (!compressed || compressed.length >= text.length * 1.2) {
        return text;
      }

      return compressed;
    } catch (error) {
      // Log silencioso no servidor, retorno graceful para o cliente
      console.error("[AI Compressor] Erro ao comprimir:", (error as Error).message);
      return text; // fallback: retorna o texto sem compressão por IA
    }
  }

  return { compress };
}
