/**
 * TokLang — Estimador de tokens
 *
 * Contagem de tokens sem dependência de bibliotecas externas pesadas como tiktoken.
 * Usamos a heurística padrão da indústria: ~4 caracteres por token para português/inglês.
 * Isso é consistente com o que a própria OpenAI documenta para seus modelos, e suficientemente
 * preciso para o propósito do TokLang (mostrar economia relativa).
 *
 * Gemini usa um tokenizador próprio (SentencePiece), mas para estimativa de UI
 * essa heurística tem margem de erro de ~10–15%, aceitável para feedback visual.
 */

const CHARS_PER_TOKEN = 4;

/**
 * Estima o número de tokens de um texto.
 *
 * Algoritmo:
 * 1. Conta caracteres totais
 * 2. Divide por CHARS_PER_TOKEN (heurística de ~4 chars/token)
 * 3. Garante mínimo de 1 token para strings não-vazias
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  const charCount = text.trim().length;
  return Math.max(1, Math.round(charCount / CHARS_PER_TOKEN));
}

/**
 * Calcula a economia percentual entre dois valores de tokens.
 * Retorna 0 se não há economia ou se o original é zero.
 */
export function calculateSavings(original: number, final: number): number {
  if (original === 0) return 0;
  if (final >= original) return 0;

  return Math.round(((original - final) / original) * 100);
}

/**
 * Formata o percentual de economia para exibição.
 * Ex: 64 → "↓ 64%"
 *     0 → "→ 0%"
 */
export function formatSavings(percent: number): string {
  if (percent > 0) return `↓ ${percent}%`;
  if (percent < 0) return `↑ ${Math.abs(percent)}%`; // prompt cresceu (improvável)
  return `→ 0%`;
}
