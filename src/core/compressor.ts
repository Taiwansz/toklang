/**
 * TokLang — Orquestrador de Compressão
 *
 * Combina as duas camadas de compressão em um pipeline coeso:
 *   1. Regras léxicas (rules.ts) — sempre ativo, sem latência
 *   2. IA Gemini Flash (ai-compressor.ts) — opcional, adiciona ~500ms
 *
 * Este módulo é o único ponto de entrada para compressão.
 * Tanto o CLI quanto o servidor chamam apenas este módulo.
 */

import { applyRules } from "./rules";
import { createAICompressor } from "./ai-compressor";
import { estimateTokens, calculateSavings } from "./tokenizer";
import type { CompressionResult, CompressorOptions } from "./types";

/**
 * Cria uma instância do compressor com a chave de API configurada.
 * O padrão factory permite reutilizar o mesmo cliente Gemini na sessão.
 */
export function createCompressor(apiKey: string) {
  const aiCompressor = createAICompressor(apiKey);

  /**
   * Pipeline principal de compressão.
   *
   * Fluxo:
   *   texto original
   *     → applyRules()       [Camada 1: léxica, síncrona]
   *     → aiCompressor()     [Camada 2: semântica, async — se useAI=true]
   *     → calcular tokens e economia
   *     → retornar CompressionResult
   */
  async function compress(
    text: string,
    options: CompressorOptions = { useAI: true }
  ): Promise<CompressionResult> {
    const original = text.trim();

    // Camada 1: regras léxicas determinísticas
    const afterRules = applyRules(original);

    // Camada 2: compressão semântica por IA (opcional)
    let compressed: string;
    if (options.useAI) {
      compressed = await aiCompressor.compress(afterRules);
    } else {
      compressed = afterRules;
    }

    // Calcular estatísticas de tokens
    const tokensOriginal = estimateTokens(original);
    const tokensFinal = estimateTokens(compressed);
    const savedTokens = Math.max(0, tokensOriginal - tokensFinal);
    const savedPercent = calculateSavings(tokensOriginal, tokensFinal);

    return {
      original,
      afterRules,
      compressed,
      tokensOriginal,
      tokensFinal,
      savedTokens,
      savedPercent,
    };
  }

  return { compress };
}
