/**
 * TokLang — Servidor Express
 *
 * Serve a interface web e expõe dois endpoints REST:
 *   POST /api/chat     — comprime + responde com Gemini Pro
 *   POST /api/compress — apenas comprime, sem chamar a IA final
 *
 * Decisões de design:
 * - express.static serve o /public diretamente, sem build step
 * - CORS liberado para desenvolvimento local (ajustar em produção)
 * - Erros retornam JSON estruturado com campo "error" para o frontend tratar
 * - Validação de body antes de processar (evita crashes por input malformado)
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import * as dotenv from "dotenv";
import { createCompressor } from "./core/compressor";
import { createGeminiClient } from "./api";
import type { ChatRequest, ChatResponse } from "./core/types";

dotenv.config();

// ─── Validação da API Key ──────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error(
    "✗ GEMINI_API_KEY não encontrada. Configure o arquivo .env antes de iniciar o servidor."
  );
  process.exit(1);
}

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ─── Instâncias ────────────────────────────────────────────────────────────

const compressor = createCompressor(GEMINI_API_KEY);
const gemini = createGeminiClient(GEMINI_API_KEY);

// ─── App Express ───────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve arquivos estáticos da pasta /public
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── POST /api/chat ────────────────────────────────────────────────────────

app.post("/api/chat", async (req: Request, res: Response): Promise<void> => {
  const { prompt, history = [], useAI = true } = req.body as ChatRequest;

  // Validação
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "Campo 'prompt' é obrigatório e não pode ser vazio." });
    return;
  }

  if (prompt.trim().length > 10000) {
    res.status(400).json({ error: "Prompt excede o limite de 10.000 caracteres." });
    return;
  }

  try {
    // Compressão
    const compression = await compressor.compress(prompt.trim(), { useAI });

    // Resposta da IA com o prompt comprimido
    const aiResponse = await gemini.chat(compression.compressed, history);

    const response: ChatResponse = {
      original: compression.original,
      compressed: compression.compressed,
      response: aiResponse,
      stats: {
        tokensOriginal: compression.tokensOriginal,
        tokensFinal: compression.tokensFinal,
        savedTokens: compression.savedTokens,
        savedPercent: compression.savedPercent,
      },
    };

    res.json(response);
  } catch (error) {
    const err = error as Error;
    console.error("[/api/chat] Erro:", err.message);

    // Erros da API Gemini são propagados com status 502
    if (err.message.includes("Gemini") || err.message.includes("API")) {
      res.status(502).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Erro interno do servidor." });
    }
  }
});

// ─── POST /api/compress ────────────────────────────────────────────────────

app.post("/api/compress", async (req: Request, res: Response): Promise<void> => {
  const { prompt, useAI = true } = req.body as { prompt: string; useAI?: boolean };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    return;
  }

  try {
    const result = await compressor.compress(prompt.trim(), { useAI });

    res.json({
      original: result.original,
      afterRules: result.afterRules,
      compressed: result.compressed,
      tokensOriginal: result.tokensOriginal,
      tokensFinal: result.tokensFinal,
      savedTokens: result.savedTokens,
      savedPercent: result.savedPercent,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// ─── Fallback: serve index.html para rotas não-API ─────────────────────────

app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ─── Error handler global ──────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: "Erro interno inesperado." });
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log("\n");
  console.log("  ████████╗ ██████╗ ██╗  ██╗██╗      █████╗ ███╗  ██╗ ██████╗");
  console.log("     ██║   ██╔═══██╗██║ ██╔╝██║     ██╔══██╗████╗ ██║██╔════╝");
  console.log("     ██║   ██║   ██║█████╔╝ ██║     ███████║██╔██╗██║██║ ███╗");
  console.log("     ██║   ██║   ██║██╔═██╗ ██║     ██╔══██║██║╚████║██║  ██║");
  console.log("     ██║   ╚██████╔╝██║  ██╗███████╗██║  ██║██║ ╚███║╚██████╔╝");
  console.log("     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚══╝ ╚═════╝");
  console.log("\n");
  console.log(`  ✓ Servidor rodando em http://localhost:${PORT}`);
  console.log(`  ✓ API disponível em http://localhost:${PORT}/api/chat`);
  console.log(`  ✓ Compressão por IA: ${process.env.USE_AI_COMPRESSION !== "false" ? "ativada" : "desativada"}`);
  console.log("\n  Pressione Ctrl+C para encerrar.\n");
});
