/**
 * TokLang — Interface de Terminal (CLI)
 *
 * Interface interativa com readline do Node.js (zero dependência extra).
 * Mantém histórico de conversa, exibe os 3 blocos obrigatórios,
 * e suporta comandos especiais: stats, clear, quit.
 *
 * Decisões de design:
 * - chalk@4 (CommonJS) para compatibilidade com ts-node sem config ESM
 * - readline nativo: sem prompt externo, mais controle sobre exibição
 * - SessionStats acumulado em memória — persiste durante a sessão CLI
 */

import * as readline from "readline";
import * as dotenv from "dotenv";
import chalk from "chalk";
import { createCompressor } from "./core/compressor";
import { createGeminiClient } from "./api";
import { formatSavings } from "./core/tokenizer";
import type { ChatMessage, SessionStats } from "./core/types";

dotenv.config();

// ─── Validação da API Key ──────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error(
    chalk.red.bold("\n✗ GEMINI_API_KEY não encontrada!\n") +
    chalk.gray("  Crie um arquivo .env com:\n") +
    chalk.yellow("  GEMINI_API_KEY=sua_chave_aqui\n") +
    chalk.gray("  Obtenha sua chave em: https://aistudio.google.com/app/apikey\n")
  );
  process.exit(1);
}

const USE_AI_COMPRESSION = process.env.USE_AI_COMPRESSION !== "false";

// ─── Instâncias ────────────────────────────────────────────────────────────

const compressor = createCompressor(GEMINI_API_KEY);
const gemini = createGeminiClient(GEMINI_API_KEY);

// ─── Estado da sessão ──────────────────────────────────────────────────────

let sessionStats: SessionStats = {
  totalPrompts: 0,
  totalOriginalTokens: 0,
  totalFinalTokens: 0,
  totalSavedTokens: 0,
  averageSavedPercent: 0,
};

const conversationHistory: ChatMessage[] = [];

// ─── Utilidades de exibição ────────────────────────────────────────────────

const LINE = chalk.gray("─".repeat(60));
const THIN = chalk.gray("─".repeat(60));

function banner(): void {
  console.clear();
  console.log();
  console.log(
    chalk.green.bold("  ████████╗ ██████╗ ██╗  ██╗██╗      █████╗ ███╗  ██╗ ██████╗ ")
  );
  console.log(
    chalk.green.bold("     ██╔══╝██╔═══██╗██║ ██╔╝██║     ██╔══██╗████╗ ██║██╔════╝ ")
  );
  console.log(
    chalk.green.bold("     ██║   ██║   ██║█████╔╝ ██║     ███████║██╔██╗██║██║  ███╗")
  );
  console.log(
    chalk.green.bold("     ██║   ██║   ██║██╔═██╗ ██║     ██╔══██║██║╚████║██║   ██║")
  );
  console.log(
    chalk.green.bold("     ██║   ╚██████╔╝██║  ██╗███████╗██║  ██║██║ ╚███║╚██████╔╝")
  );
  console.log(
    chalk.green.bold("     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚══╝ ╚═════╝ ")
  );
  console.log();
  console.log(
    chalk.gray("  Motor de compressão de prompts para IA") +
    chalk.green(" · ") +
    chalk.gray("menos tokens, mesma qualidade")
  );
  console.log();
  console.log(
    chalk.gray("  Compressão por IA: ") +
    (USE_AI_COMPRESSION
      ? chalk.green("✓ ativada") + chalk.gray(" (Gemini Flash)")
      : chalk.yellow("✗ desativada") + chalk.gray(" (apenas regras léxicas)"))
  );
  console.log(
    chalk.gray("  Comandos: ") +
    chalk.cyan("stats") +
    chalk.gray(" · ") +
    chalk.cyan("clear") +
    chalk.gray(" · ") +
    chalk.cyan("quit")
  );
  console.log();
  console.log(LINE);
  console.log();
}

function printBlock(
  title: string,
  content: string,
  color: chalk.Chalk = chalk.white
): void {
  console.log(chalk.gray("┌─ ") + chalk.bold(title));
  console.log(chalk.gray("│"));

  // Quebra o conteúdo em linhas de 56 chars para caber na "box"
  const words = content.split(" ");
  let line = "";
  for (const word of words) {
    if ((line + word).length > 56) {
      console.log(chalk.gray("│  ") + color(line.trim()));
      line = word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line.trim()) {
    console.log(chalk.gray("│  ") + color(line.trim()));
  }

  console.log(chalk.gray("│"));
  console.log(chalk.gray("└" + "─".repeat(59)));
  console.log();
}

function printStats(
  tokensOriginal: number,
  tokensFinal: number,
  savedTokens: number,
  savedPercent: number
): void {
  const savingsLabel = formatSavings(savedPercent);
  const savingsColor = savedPercent > 30 ? chalk.green : savedPercent > 10 ? chalk.yellow : chalk.gray;

  console.log(chalk.gray("┌─ ") + chalk.bold("📊 Estatísticas"));
  console.log(chalk.gray("│"));
  console.log(
    chalk.gray("│  ") +
    chalk.gray("Tokens originais:  ") +
    chalk.white(tokensOriginal.toString())
  );
  console.log(
    chalk.gray("│  ") +
    chalk.gray("Tokens finais:     ") +
    chalk.white(tokensFinal.toString())
  );
  console.log(
    chalk.gray("│  ") +
    chalk.gray("Tokens economizados: ") +
    chalk.green(savedTokens.toString())
  );
  console.log(
    chalk.gray("│  ") +
    chalk.gray("Economia:          ") +
    savingsColor.bold(savingsLabel)
  );
  console.log(chalk.gray("│"));
  console.log(
    chalk.gray("│  ") +
    chalk.gray("Sessão acumulada:  ") +
    chalk.green(`${sessionStats.totalSavedTokens} tokens economizados`)
  );
  console.log(chalk.gray("└" + "─".repeat(59)));
  console.log();
}

function printSessionSummary(): void {
  console.log();
  console.log(LINE);
  console.log();
  console.log(chalk.green.bold("  Resumo da sessão TokLang"));
  console.log();
  console.log(
    chalk.gray("  Prompts enviados:      ") +
    chalk.white(sessionStats.totalPrompts.toString())
  );
  console.log(
    chalk.gray("  Tokens originais:      ") +
    chalk.white(sessionStats.totalOriginalTokens.toString())
  );
  console.log(
    chalk.gray("  Tokens após compressão: ") +
    chalk.white(sessionStats.totalFinalTokens.toString())
  );
  console.log(
    chalk.gray("  Total economizado:     ") +
    chalk.green.bold(sessionStats.totalSavedTokens.toString() + " tokens")
  );
  console.log(
    chalk.gray("  Média de economia:     ") +
    chalk.green.bold(`${sessionStats.averageSavedPercent}%`)
  );
  console.log();
  console.log(chalk.gray("  Até logo! 👋"));
  console.log();
}

// ─── Comandos especiais ────────────────────────────────────────────────────

function handleStatsCommand(): void {
  console.log();
  console.log(chalk.gray("┌─ ") + chalk.bold("📈 Estatísticas da sessão"));
  console.log(chalk.gray("│"));
  console.log(chalk.gray("│  ") + `Prompts: ${chalk.white(sessionStats.totalPrompts)}`);
  console.log(
    chalk.gray("│  ") +
    `Tokens originais:  ${chalk.white(sessionStats.totalOriginalTokens)}`
  );
  console.log(
    chalk.gray("│  ") +
    `Tokens finais:     ${chalk.white(sessionStats.totalFinalTokens)}`
  );
  console.log(
    chalk.gray("│  ") +
    `Economizados:      ${chalk.green.bold(sessionStats.totalSavedTokens.toString())}`
  );
  console.log(
    chalk.gray("│  ") +
    `Média de economia: ${chalk.green.bold(sessionStats.averageSavedPercent + "%")}`
  );
  console.log(chalk.gray("└" + "─".repeat(59)));
  console.log();
}

function handleClearCommand(rl: readline.Interface): void {
  conversationHistory.length = 0;
  sessionStats = {
    totalPrompts: 0,
    totalOriginalTokens: 0,
    totalFinalTokens: 0,
    totalSavedTokens: 0,
    averageSavedPercent: 0,
  };
  banner();
  console.log(chalk.yellow("  Histórico e estatísticas limpos.\n"));
}

// ─── Loop principal ────────────────────────────────────────────────────────

async function processPrompt(userInput: string): Promise<void> {
  console.log();
  console.log(chalk.gray("  ⟳ Comprimindo prompt..."));

  // Compressão
  const result = await compressor.compress(userInput, { useAI: USE_AI_COMPRESSION });

  console.log(chalk.gray("  ⟳ Consultando Gemini..."));

  // Resposta da IA
  const response = await gemini.chat(result.compressed, conversationHistory);

  // Atualiza histórico (com o prompt ORIGINAL — contexto mais rico para o histórico)
  conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
  conversationHistory.push({ role: "model", parts: [{ text: response }] });

  // Atualiza estatísticas da sessão
  sessionStats.totalPrompts++;
  sessionStats.totalOriginalTokens += result.tokensOriginal;
  sessionStats.totalFinalTokens += result.tokensFinal;
  sessionStats.totalSavedTokens += result.savedTokens;
  sessionStats.averageSavedPercent = Math.round(
    ((sessionStats.totalOriginalTokens - sessionStats.totalFinalTokens) /
      sessionStats.totalOriginalTokens) *
      100
  );

  // Exibe os 3 blocos
  console.log();
  console.log(LINE);
  console.log();

  printBlock("🗜  Prompt comprimido", result.compressed, chalk.cyan);
  printBlock("🤖 Resposta da IA", response, chalk.white);
  printStats(
    result.tokensOriginal,
    result.tokensFinal,
    result.savedTokens,
    result.savedPercent
  );
}

async function main(): Promise<void> {
  banner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = (): void => {
    rl.question(chalk.green("  ❯ "), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Comandos especiais
      switch (trimmed.toLowerCase()) {
        case "quit":
        case "exit":
        case "sair":
          printSessionSummary();
          rl.close();
          process.exit(0);

        case "stats":
        case "estatísticas":
          handleStatsCommand();
          prompt();
          return;

        case "clear":
        case "limpar":
          handleClearCommand(rl);
          prompt();
          return;

        default:
          break;
      }

      try {
        await processPrompt(trimmed);
      } catch (error) {
        console.error(
          chalk.red("\n  ✗ Erro: ") +
          chalk.gray((error as Error).message) +
          "\n"
        );
      }

      prompt();
    });
  };

  prompt();
}

main().catch((err) => {
  console.error(chalk.red("Erro fatal:"), err);
  process.exit(1);
});
