# Software Design Document (SDD)

**Projeto:** ConcursoAI Platform

**Versão:** 2.0

**Status:** Draft

**Autor:** Equipe de Arquitetura

---

# 1. Objetivo

Este documento define toda a arquitetura técnica da plataforma ConcursoAI.

Seu objetivo é garantir que todos os desenvolvedores e agentes de IA (Trae, Cursor, Claude Code e ChatGPT) implementem o sistema seguindo os mesmos padrões arquiteturais.

Este documento é considerado a principal referência técnica do projeto.

---

# 2. Visão Geral

A plataforma ConcursoAI é um sistema SaaS para preparação para concursos públicos.

A solução utiliza Inteligência Artificial para auxiliar o aluno durante toda sua jornada de estudos.

O sistema não depende apenas de LLMs.

Todo conhecimento é baseado em documentos autorizados previamente indexados.

---

# 3. Objetivos da Arquitetura

A arquitetura deve atender aos seguintes requisitos:

- Alta disponibilidade
- Escalabilidade horizontal
- Baixo custo operacional
- Fácil manutenção
- Código modular
- Preparado para IA
- Segurança
- Observabilidade
- Evolução incremental

---

# 4. Arquitetura Geral

```
                    Usuário

                        │

                        ▼

              Next.js Frontend

                        │

                        ▼

                API Application

                        │

        ┌───────────────┼───────────────┐

        │               │               │

        ▼               ▼               ▼

     Supabase       Oracle VPS      Cloudflare R2

 PostgreSQL          Workers           Arquivos

 pgvector            OCR              PDFs

 Auth                Whisper          Vídeos

 Storage             ETL              Áudios
```

---

# 5. Filosofia da Arquitetura

O MVP será desenvolvido como um Monólito Modular.

Não haverá microsserviços na primeira versão.

Cada módulo deverá ser independente internamente.

A separação lógica permitirá futura migração para microsserviços.

---

# 6. Stack Tecnológica

## Frontend

- Next.js 16
- TypeScript
- React
- TailwindCSS
- shadcn/ui

## Backend

- Next.js Route Handlers

## Banco

- PostgreSQL
- Supabase

## Busca Vetorial

- pgvector

## Storage

- Cloudflare R2

## IA

- DeepSeek

## Pagamentos

- Mercado Pago (checkout, Pix, assinaturas)

## OCR

- PaddleOCR

## Transcrição

- Whisper

## Infraestrutura

- Oracle Cloud VPS
- Vercel

---

# 7. Estrutura do Projeto

```
src/

app/

components/

features/

modules/

services/

repositories/

lib/

hooks/

types/

utils/
```

Cada funcionalidade deverá ser implementada em um módulo independente.

---

# 8. Módulos

A plataforma será dividida nos seguintes módulos.

## Core

Responsável por:

- Login
- Cadastro
- Assinaturas
- Dashboard
- Perfil
- Configurações

---

## Concurso

Responsável por:

- Órgãos
- Bancas
- Concursos
- Editais
- Cronogramas

---

## Knowledge Engine

Responsável por:

- Upload de PDFs
- Upload de apostilas
- Upload de videoaulas
- OCR
- Extração de texto
- Classificação
- Chunking
- Embeddings
- Organização do conhecimento

---

## Question Engine

Responsável por:

- Questões
- Simulados
- Correções
- Comentários
- Explicações

---

## Flashcard Engine

Responsável por:

- Flashcards
- Revisões
- Revisão espaçada

---

## Analytics

Responsável por:

- Estatísticas
- Evolução
- Tempo estudado
- Pontuação

---

## Recommendation Engine

Responsável por recomendar:

- Questões
- Videoaulas
- Revisões
- Flashcards
- Simulados

---

## Admin

Responsável por:

- Usuários
- Assinaturas
- Conteúdo
- IA
- Uploads
- Logs

---

# 9. Fluxo Principal

```
Aluno

↓

Escolhe Concurso

↓

Seleciona Edital

↓

Recebe Cronograma

↓

Estuda

↓

Resolve Questões

↓

Recebe Feedback

↓

Revisa

↓

Simulado

↓

Analytics
```

---

# 10. Fluxo do Knowledge Engine

```
Upload

↓

OCR

↓

Extração

↓

Parser

↓

Chunk

↓

Embeddings

↓

pgvector

↓

Pronto para IA
```

---

# 11. Pipeline RAG

```
Pergunta

↓

Embedding

↓

Busca Vetorial

↓

Documentos Relevantes

↓

Prompt Builder

↓

LLM

↓

Resposta
```

---

# 12. Pipeline ETL

```
Importação

↓

OCR

↓

Parser

↓

Normalização

↓

Classificação

↓

Chunking

↓

Embedding

↓

Indexação
```

---
a API de IA (DeepSeek)
# 13. Regras Arquiteturais

Nunca acessar OpenAI diretamente pelo Frontend.

Nunca acessar PostgreSQL diretamente pelo React.

Nunca colocar lógica de negócio em componentes.

Toda regra deverá estar em Services.

Toda persistência deverá utilizar Repository.

---

# 14. Segurança

JWT

Row Level Security

Rate Limit

Logs

Auditoria

LGPD

---

# 15. Observabilidade

Logs

Sentry

Analytics

Custos IA

Performance

---

# 16. Escalabilidade

A arquitetura deverá suportar:

100 usuários

↓

1.000 usuários

↓

10.000 usuários

↓

100.000 usuários

sem reescrita significativa.

---

# 17. Integrações

Mercado Pago

DeepSeek

Cloudflare R2

Supabase

---

# 18. ADR (Architecture Decision Records)

## ADR-001

Arquitetura Monólito Modular para o MVP.

## ADR-002

Supabase como banco principal.

## ADR-003

Cloudflare R2 para documentos.

## ADR-004

Oracle VPS para processamento pesado.

## ADR-005

RAG como mecanismo oficial de IA.

Fine-tuning não será utilizado no MVP.

---

# 19. Próximos Documentos

03-AIDD.md

04-DATABASE.md

05-API.md

06-KNOWLEDGE-ENGINE.md

07-RAG.md

08-ETL.md

09-INFRASTRUCTURE.md

10-SECURITY.md
