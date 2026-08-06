# ConcursoAI Platform 🎯

Plataforma de estudos com IA para **concursos públicos brasileiros** — cronograma inteligente, banco de questões, flashcards, Professor IA (DeepSeek) e análises de desempenho.

## ✨ Funcionalidades (MVP)

| Módulo | Descrição |
| --- | --- |
| 🔐 **Autenticação** | Login/cadastro com NextAuth + Supabase Auth |
| 📊 **Dashboard** | Visão geral do desempenho e progresso |
| 🗓️ **Cronograma** | Plano de estudos personalizado e acompanhamento |
| 🤖 **Professor IA** | Chat com IA (DeepSeek V4 Flash/Pro) especializada em concursos |
| 📝 **Banco de Questões** | Resolver questões, gabarito, explicações e histórico |
| 🃏 **Flashcards** | Revisão por repetição espaçada |
| 📈 **Analíticas** | Métricas de acertos, matérias e evolução |

## 🧭 Roadmap futuro

- **Knowledge Engine**: importar PDFs, apostilas, editais e videoaulas (OCR + Whisper + embeddings + RAG com pgvector)
- **Contest Intelligence**: análise de banca e estatísticas de edital
- **Recommendation Engine**: recomendações personalizadas de conteúdo
- **Revisão espaçada**: algoritmo SRS avançado

## 🛠️ Stack

- **Framework**: Next.js 16 (App Router)
- **Linguagem**: TypeScript
- **Estilo**: Tailwind CSS + shadcn/ui
- **Banco**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **LLM**: DeepSeek API (`deepseek-chat` / `deepseek-reasoner`)
- **Auth**: NextAuth (Auth.js v5)
- **Pagamentos**: Mercado Pago
- **Storage (futuro)**: Cloudflare R2

## 📁 Estrutura do projeto

```
├── .ai/           → ⭐ Standards para devs/agentes (leia 00-START-HERE.md)
├── docs/          → Documentação completa (PRD, SDD, AIDD, banco, API, RAG...)
├── sql/           → Migrations e seed do banco
├── prompts/       → Prompts de sistema e templates
├── src/
│   ├── app/       → Rotas (App Router) com route groups (auth), (dashboard), (study)
│   ├── components/→ Componentes shadcn/ui + de layout
│   ├── lib/       → Utilitários, clientes Supabase, DeepSeek e Mercado Pago
│   └── types/     → Tipos TypeScript
```

> **Novo desenvolvedor?** Comece por `.ai/00-START-HERE.md`.

## 🚀 Começando

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# → preencha Supabase, DeepSeek e AUTH_SECRET

# 3. Aplicar schema no banco (SQL Editor do Supabase ou CLI)
# → execute os arquivos de sql/ na ordem: schema.sql → indexes.sql → policies.sql → seed.sql

# 4. Rodar em desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## 📚 Documentação

Consulte a pasta [`docs/`](./docs) — comece pelo [01-PRD.md](./docs/01-PRD.md).

## 🔐 Segurança

Nunca commite `.env.local`. A service role key do Supabase e a chave da DeepSeek devem existir **apenas** no servidor (envs privadas).

## 📄 Licença

Uso privado / proprietário.
