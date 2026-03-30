/**
 * TokLang — Tipos centrais do sistema
 *
 * Todas as interfaces e tipos compartilhados entre os módulos.
 * Centralizar tipos aqui evita imports cruzados e facilita refatorações.
 */

// ─── Resultado da compressão ───────────────────────────────────────────────

export interface CompressionResult {
  /** Texto original digitado pelo usuário */
  original: string;

  /** Texto após aplicação das regras léxicas (sem IA) */
  afterRules: string;

  /** Texto final após compressão por IA (ou igual a afterRules se IA desativada) */
  compressed: string;

  /** Tokens estimados do prompt original */
  tokensOriginal: number;

  /** Tokens estimados do prompt final comprimido */
  tokensFinal: number;

  /** Diferença absoluta de tokens */
  savedTokens: number;

  /** Percentual economizado (0–100) */
  savedPercent: number;
}

// ─── Estatísticas acumuladas da sessão ────────────────────────────────────

export interface SessionStats {
  /** Total de prompts enviados na sessão */
  totalPrompts: number;

  /** Total de tokens originais acumulados */
  totalOriginalTokens: number;

  /** Total de tokens finais acumulados */
  totalFinalTokens: number;

  /** Total de tokens economizados na sessão */
  totalSavedTokens: number;

  /** Percentual médio de economia na sessão */
  averageSavedPercent: number;
}

// ─── Mensagem do histórico de conversa ────────────────────────────────────

export interface ChatMessage {
  /** "user" | "model" — padrão da API Gemini */
  role: "user" | "model";

  /** Conteúdo da mensagem */
  parts: Array<{ text: string }>;
}

// ─── Payload de request para o servidor ───────────────────────────────────

export interface ChatRequest {
  /** Prompt original do usuário */
  prompt: string;

  /** Histórico de conversa para contexto */
  history: ChatMessage[];

  /** Se true, aplica compressão via IA além das regras léxicas */
  useAI: boolean;
}

// ─── Payload de response do servidor ──────────────────────────────────────

export interface ChatResponse {
  /** Prompt original */
  original: string;

  /** Prompt comprimido enviado para a IA */
  compressed: string;

  /** Resposta completa do Gemini Pro */
  response: string;

  /** Estatísticas de economia deste prompt */
  stats: {
    tokensOriginal: number;
    tokensFinal: number;
    savedTokens: number;
    savedPercent: number;
  };
}

// ─── Opções do compressor ──────────────────────────────────────────────────

export interface CompressorOptions {
  /** Ativar compressão via Gemini Flash (além das regras léxicas) */
  useAI: boolean;
}

// ─── Opções do cliente Gemini ──────────────────────────────────────────────

export interface GeminiConfig {
  apiKey: string;
  flashModel: string;
  proModel: string;
}
