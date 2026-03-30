/**
 * TokLang — Compressão por Regras Léxicas
 *
 * Primeira camada de compressão: regex determinístico, zero custo, zero latência.
 * Roda SEMPRE, independentemente de a compressão por IA estar ativa.
 *
 * Decisão de design: usamos regex com flag `gi` para capturar variações de capitalização.
 * A ordem das regras importa: do mais específico para o mais genérico.
 * Regras de substituição rodam antes das regras de remoção pura.
 */

// ─── Tipos internos ────────────────────────────────────────────────────────

interface SubstitutionRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

interface RemovalRule {
  pattern: RegExp;
  description: string;
}

// ─── Regras de substituição (padrão → versão densa) ───────────────────────

const SUBSTITUTION_RULES: SubstitutionRule[] = [
  // Pedidos de explicação
  {
    pattern: /me\s+explique\s+como\s+funciona[m]?\s+/gi,
    replacement: "explique ",
    description: "Reduz pedido de explicação verbose",
  },
  {
    pattern: /me\s+explique\s+/gi,
    replacement: "explique ",
    description: "Simplifica 'me explique'",
  },
  {
    pattern: /pode\s+me\s+explicar\s+/gi,
    replacement: "explique ",
    description: "Converte 'pode me explicar' em imperativo direto",
  },
  {
    pattern: /como\s+funciona[m]?\s+/gi,
    replacement: "funcionamento de ",
    description: "Nominaliza 'como funciona'",
  },

  // Exemplos
  {
    pattern: /d[eê]\s+exemplos?\s+práticos?\s+de\s+/gi,
    replacement: "exemplos: ",
    description: "Comprime pedido de exemplos práticos",
  },
  {
    pattern: /com\s+exemplos?\s+práticos?\s*/gi,
    replacement: ", exemplos práticos",
    description: "Comprime 'com exemplos práticos'",
  },

  // Diferenças e definições
  {
    pattern: /qual\s+[eé]\s+a\s+diferença\s+entre\s+/gi,
    replacement: "diferença entre ",
    description: "Remove verbosidade de comparação",
  },
  {
    pattern: /quais\s+s[aã]o\s+as\s+diferenças?\s+entre\s+/gi,
    replacement: "diferenças entre ",
    description: "Remove verbosidade de comparação plural",
  },
  {
    pattern: /o\s+que\s+[eé]\s+exatamente\s+/gi,
    replacement: "defina ",
    description: "Nominaliza pedido de definição",
  },
  {
    pattern: /o\s+que\s+[eé]\s+/gi,
    replacement: "defina ",
    description: "Simplifica 'o que é'",
  },

  // Criação e ajuda
  {
    pattern: /me\s+ajude\s+a\s+criar\s+/gi,
    replacement: "crie ",
    description: "Comprime 'me ajude a criar'",
  },
  {
    pattern: /me\s+ajude\s+a\s+/gi,
    replacement: "",
    description: "Remove 'me ajude a' mantendo o verbo seguinte",
  },
  {
    pattern: /me\s+ajude\s+com\s+/gi,
    replacement: "ajude: ",
    description: "Simplifica pedido de ajuda",
  },

  // "Quero que você" + verbo
  {
    pattern: /quero\s+que\s+voc[eê]\s+/gi,
    replacement: "",
    description: "Remove 'quero que você' deixando o verbo direto",
  },
  {
    pattern: /preciso\s+que\s+voc[eê]\s+/gi,
    replacement: "",
    description: "Remove 'preciso que você'",
  },
  {
    pattern: /gostaria\s+que\s+voc[eê]\s+/gi,
    replacement: "",
    description: "Remove 'gostaria que você'",
  },

  // Quero entender / quero saber
  {
    pattern: /quero\s+entender\s+/gi,
    replacement: "",
    description: "Remove 'quero entender'",
  },
  {
    pattern: /quero\s+saber\s+/gi,
    replacement: "",
    description: "Remove 'quero saber'",
  },
  {
    pattern: /preciso\s+entender\s+/gi,
    replacement: "",
    description: "Remove 'preciso entender'",
  },

  // Quando usar/não usar
  {
    pattern: /quando\s+devo\s+ou\s+n[aã]o\s+usar\s+/gi,
    replacement: "quando usar e evitar ",
    description: "Comprime 'quando devo ou não usar'",
  },
  {
    pattern: /quando\s+devo\s+usar\s+/gi,
    replacement: "quando usar ",
    description: "Simplifica 'quando devo usar'",
  },
  {
    pattern: /e\s+quando\s+n[aã]o\s+/gi,
    replacement: "e quando evitar ",
    description: "Simplifica 'e quando não'",
  },
];

// ─── Regras de remoção pura (cortesia / hedges) ───────────────────────────

const REMOVAL_RULES: RemovalRule[] = [
  // Formas de pedir permissão / cortesia com IA
  {
    pattern: /voc[eê]\s+pode\s+/gi,
    description: "Remove 'você pode'",
  },
  {
    pattern: /voc[eê]\s+poderia\s+/gi,
    description: "Remove 'você poderia'",
  },
  {
    pattern: /seria\s+poss[ií]vel\s+/gi,
    description: "Remove 'seria possível'",
  },
  {
    pattern: /[eé]\s+poss[ií]vel\s+/gi,
    description: "Remove 'é possível'",
  },
  {
    pattern: /por\s+favor[,]?\s*/gi,
    description: "Remove 'por favor'",
  },
  {
    pattern: /se\s+puder[,]?\s*/gi,
    description: "Remove 'se puder'",
  },
  {
    pattern: /quando\s+tiver\s+tempo[,]?\s*/gi,
    description: "Remove 'quando tiver tempo'",
  },
  {
    pattern: /gostaria\s+de\s+/gi,
    description: "Remove 'gostaria de'",
  },
  {
    pattern: /eu\s+gostaria\s+de\s+/gi,
    description: "Remove 'eu gostaria de'",
  },

  // Hedges e incertezas inúteis
  {
    pattern: /se\s+n[aã]o\s+for\s+muito\s+trabalho[,]?\s*/gi,
    description: "Remove hedge 'se não for muito trabalho'",
  },
  {
    pattern: /talvez\s+/gi,
    description: "Remove 'talvez'",
  },
  {
    pattern: /quem\s+sabe\s+/gi,
    description: "Remove 'quem sabe'",
  },

  // Pronomes desnecessários no início
  {
    pattern: /^eu\s+/gi,
    description: "Remove 'eu' inicial desnecessário",
  },
];

// ─── Função principal ──────────────────────────────────────────────────────

/**
 * Aplica todas as regras léxicas de compressão ao texto.
 *
 * Pipeline:
 * 1. Aplica substituições (padrão → versão densa)
 * 2. Aplica remoções (cortesias e hedges)
 * 3. Normaliza espaços múltiplos
 * 4. Capitaliza primeira letra
 * 5. Remove pontuação dupla
 */
export function applyRules(text: string): string {
  let result = text.trim();

  // Passo 1: substituições
  for (const rule of SUBSTITUTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // Passo 2: remoções
  for (const rule of REMOVAL_RULES) {
    result = result.replace(rule.pattern, "");
  }

  // Passo 3: normaliza espaços
  result = result.replace(/\s+/g, " ").trim();

  // Passo 4: remove pontuação dupla ou espaço antes de pontuação
  result = result.replace(/\s+([.,!?:;])/g, "$1");
  result = result.replace(/([.,!?:;])\1+/g, "$1");

  // Passo 5: capitaliza primeiro caractere
  result = capitalize(result);

  return result;
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─── Testes inline (executar com: ts-node src/core/rules.ts) ──────────────
//
// Para rodar os testes: npx ts-node src/core/rules.ts
//
// const testCases = [
//   {
//     input: "Você pode me explicar como funcionam closures em JavaScript? Quero entender com exemplos práticos e saber quando devo ou não usar essa técnica.",
//     expected: "Explique closures em JavaScript, exemplos práticos, quando usar e evitar."
//   },
//   {
//     input: "Por favor, me ajude a criar uma função que valide e-mails.",
//     expected: "Crie uma função que valide e-mails."
//   },
//   {
//     input: "Qual é a diferença entre async/await e Promises?",
//     expected: "Diferença entre async/await e Promises?"
//   },
//   {
//     input: "Quero que você escreva um teste unitário para essa função.",
//     expected: "Escreva um teste unitário para essa função."
//   },
//   {
//     input: "Se não for muito trabalho, talvez você poderia me explicar Docker.",
//     expected: "Explique Docker."
//   },
// ];
//
// console.log("=== TokLang Rules — Testes ===\n");
// testCases.forEach(({ input, expected }, i) => {
//   const result = applyRules(input);
//   const pass = result.toLowerCase().includes(expected.toLowerCase().slice(0, 15));
//   console.log(`Teste ${i + 1}: ${pass ? "✓" : "✗"}`);
//   console.log(`  Input:    ${input}`);
//   console.log(`  Output:   ${result}`);
//   console.log(`  Expected: ${expected}\n`);
// });
