# TokLang

> Motor de compressão de prompts para IA — menos tokens, mesma qualidade.

O TokLang intercepta seus prompts, comprime automaticamente usando regras léxicas + Gemini Flash, e envia a versão otimizada para a IA. O usuário digita normalmente e economiza tokens sem aprender nada novo.

```
VOCÊ DIGITA:  "Você pode me explicar como funcionam closures em JavaScript?
               Quero entender com exemplos práticos e saber quando devo ou
               não usar essa técnica."

TOKLANG:      "Explique closures JavaScript: conceito, exemplos práticos,
               quando usar e evitar."

ECONOMIA:     ↓ 42% de tokens
```

---

## Pré-requisitos

- Node.js 18+
- Chave da API do Google Gemini ([obter aqui](https://aistudio.google.com/app/apikey))

---

## Instalação

```bash
# 1. Clone o projeto
git clone https://github.com/seu-usuario/toklang
cd toklang

# 2. Instale as dependências
npm install

# 3. Configure a chave da API
cp .env.example .env
# Edite .env e adicione sua GEMINI_API_KEY
```

---

## Como usar

### Interface Web

```bash
npm run dev:web
```

Acesse: `http://localhost:3000`

- Digite seu prompt na caixa de texto
- Clique em **Enviar** ou pressione **Ctrl + Enter**
- Veja o prompt comprimido, a resposta da IA e as estatísticas de economia
- Use o toggle para ativar/desativar a compressão por IA

### Terminal (CLI)

```bash
npm run dev:cli
```

**Comandos especiais:**

| Comando   | Ação                                      |
|-----------|-------------------------------------------|
| `stats`   | Exibe resumo de tokens economizados       |
| `clear`   | Limpa histórico e reseta estatísticas     |
| `quit`    | Encerra e mostra totais da sessão         |

---

## Arquitetura

```
Usuário digita prompt
       │
       ▼
 [Camada 1: Regras Léxicas]  ←── sempre ativo, sem latência
  src/core/rules.ts
  - Remove cortesias ("por favor", "você pode", etc.)
  - Remove hedges ("talvez", "se não for muito trabalho")
  - Substituições densas ("me explique" → "explique")
       │
       ▼
 [Camada 2: IA Gemini Flash]  ←── opcional (USE_AI_COMPRESSION)
  src/core/ai-compressor.ts
  - Compressão semântica profunda
  - temperature=0.1 (determinístico)
  - Degradação graceful em caso de erro
       │
       ▼
 [Resposta: Gemini Flash/Pro]
  src/api.ts
  - Multi-turn com histórico de conversa
  - Resposta de qualidade total
       │
       ▼
 Exibição dos 3 blocos:
  1. Prompt comprimido
  2. Resposta da IA
  3. Estatísticas de economia
```

## Estrutura de pastas

```
toklang/
├── src/
│   ├── core/
│   │   ├── rules.ts          # Compressão léxica (regex, sem IA)
│   │   ├── ai-compressor.ts  # Compressão semântica via Gemini Flash
│   │   ├── compressor.ts     # Orquestra os dois passos
│   │   ├── tokenizer.ts      # Estimativa de tokens
│   │   └── types.ts          # Interfaces TypeScript
│   ├── cli.ts                # Interface de terminal interativa
│   ├── server.ts             # Servidor Express
│   └── api.ts                # Cliente Gemini Pro
├── public/
│   └── index.html            # Interface web (single file)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## API

### `POST /api/chat`

Comprime e responde com a IA.

**Body:**
```json
{
  "prompt": "Você pode me explicar o que é Docker?",
  "history": [],
  "useAI": true
}
```

**Response:**
```json
{
  "original": "Você pode me explicar o que é Docker?",
  "compressed": "Defina Docker.",
  "response": "Docker é uma plataforma de containerização...",
  "stats": {
    "tokensOriginal": 10,
    "tokensFinal": 4,
    "savedTokens": 6,
    "savedPercent": 60
  }
}
```

### `POST /api/compress`

Apenas comprime, sem chamar a IA final.

**Body:**
```json
{
  "prompt": "Por favor, me explique como funciona async/await.",
  "useAI": false
}
```

---

## Variáveis de ambiente

| Variável              | Padrão  | Descrição                                    |
|-----------------------|---------|----------------------------------------------|
| `GEMINI_API_KEY`      | —       | **Obrigatório.** Chave da API do Google Gemini |
| `USE_AI_COMPRESSION`  | `true`  | Ativa compressão por Gemini Flash            |
| `PORT`                | `3000`  | Porta do servidor web                        |

---

## Build para produção

```bash
npm run build
npm run start:web   # ou start:cli
```

---

## Estimativa de economia real

A heurística de tokens (~4 chars/token) tem margem de ~15% vs. o tokenizador real do Gemini (SentencePiece). Para o propósito de feedback visual ao usuário, essa precisão é suficiente. Em textos técnicos com muitos tokens de código, a economia real pode ser maior que a estimada.

---

## Licença

MIT
