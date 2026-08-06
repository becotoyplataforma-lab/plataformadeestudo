# 01-PRD.md — Product Requirements Document

> Versão: 1.0
> Projeto: ConcursoAI Platform
> Status: Em elaboração
> Autor: Fernando Augusto + ChatGPT (Arquiteto de Software)

---

# 1. Visão do Produto
O ConcursoAI Platform é uma plataforma SaaS de preparação para concursos públicos baseada em Inteligência Artificial.

Diferente das plataformas tradicionais, o sistema será capaz de **entender editais, apostilas, videoaulas, leis e o desempenho do aluno**, criando uma experiência personalizada de estudo.

A missão do produto é:

> **Transformar qualquer material autorizado em um professor particular alimentado por IA.**

---

# 2. Problema
Os candidatos a concursos enfrentam os seguintes problemas:

- Editais extensos e complexos.
- Dificuldade em organizar os estudos.
- Apostilas desatualizadas.
- Videoaulas desconectadas do edital.
- Falta de acompanhamento individual.
- Revisões ineficientes.
- Excesso de conteúdo irrelevante.
- Bancas com perfis diferentes.

Hoje o aluno precisa utilizar várias plataformas ao mesmo tempo:

- Banco de questões
- Cronograma
- Videoaulas
- PDFs
- Flashcards
- Resumos

O ConcursoAI unificará tudo em um único ecossistema.

---

# 3. Objetivos do Produto

## Objetivo Principal
Aumentar significativamente a eficiência do estudo para concursos através de IA.

## Objetivos Secundários

- Reduzir tempo de preparação.
- Melhorar retenção do conteúdo.
- Automatizar revisões.
- Gerar materiais personalizados.
- Identificar pontos fracos.
- Adaptar o plano de estudos automaticamente.

---

# 4. Público-Alvo

## Persona 1 — Concurseiro Iniciante

- Nunca estudou para concursos.
- Não sabe por onde começar.
- Precisa de orientação completa.

## Persona 2 — Concurseiro Intermediário

- Já possui materiais.
- Precisa organizar os estudos.
- Quer melhorar desempenho.

## Persona 3 — Concurseiro Avançado

- Resolve muitas questões.
- Precisa de análise estatística.
- Busca otimização.

## Persona 4 — Militar / Área de Segurança

- PMERJ
- CBMERJ
- PCERJ
- PF
- PRF
- DEPEN

Necessita foco em editais específicos e legislação.

---

# 5. Proposta de Valor

## Antes

- Edital em PDF.
- Apostila separada.
- Vídeo separado.
- Questões separadas.
- Cronograma manual.

## Depois
O aluno escolhe o concurso e a plataforma entrega:

- Cronograma.
- Resumos.
- Videoaulas organizadas.
- Questões.
- Flashcards.
- Revisões.
- Professor IA.
- Analytics.

Tudo conectado ao edital.

---

# 6. Funcionalidades do MVP

## Autenticação

- Cadastro
- Login
- Recuperação de senha
- Perfil

## Concursos

- Selecionar concurso
- Visualizar edital
- Acompanhar status

## Cronograma

- Geração automática
- Ajuste manual
- Metas diárias

## Questões

- Resolver questões
- Ver gabarito
- Ver explicação

## Flashcards

- Criar automaticamente
- Revisão espaçada

## Professor IA

- Chat contextual
- Explicações
- Dúvidas

## Dashboard

- Tempo estudado
- Acertos
- Erros
- Evolução

---

# 7. Funcionalidades da Versão 2

- Importação de apostilas
- Importação de videoaulas
- OCR
- Transcrição
- Knowledge Engine
- RAG
- Contest Intelligence
- Analytics avançado

---

# 8. Funcionalidades da Versão 3

- Aplicativo Android
- Aplicativo iOS
- Gamificação
- Ranking
- Comunidade
- Estudo em grupo
- IA por voz

---

# 9. Jornada do Usuário

## Fluxo Principal
Cadastro

↓

Escolher Concurso

↓

Importar Material (opcional)

↓

Knowledge Engine processa

↓

IA organiza conteúdo

↓

Cronograma gerado

↓

Estudo

↓

Questões

↓

Revisão

↓

Simulado

↓

Analytics

↓

Ajuste automático do plano

---

# 10. Knowledge Engine
O Knowledge Engine será o diferencial da plataforma.

## Entradas

- Editais
- Apostilas
- PDFs
- Slides
- Videoaulas
- Leis

## Processamento

- OCR
- Transcrição
- Classificação
- Chunking
- Embeddings

## Saídas

- Resumos
- Flashcards
- Questões
- Simulados
- Mapas mentais
- Explicações
- Recomendações

---

# 11. Professor IA
O Professor IA deve responder utilizando a seguinte prioridade:

1. Edital
2. Apostila
3. Videoaula
4. Lei
5. Jurisprudência
6. Questões
7. Conhecimento geral da IA

Isso garante respostas fundamentadas.

---

# 12. Casos de Uso

## UC-01 — Escolher Concurso
Como aluno, quero selecionar um concurso para que a plataforma organize meu estudo.

## UC-02 — Gerar Cronograma
Como aluno, quero receber um cronograma baseado no edital e no tempo disponível.

## UC-03 — Resolver Questões
Como aluno, quero praticar questões por matéria e banca.

## UC-04 — Perguntar ao Professor IA
Como aluno, quero tirar dúvidas utilizando meu próprio material.

## UC-05 — Gerar Flashcards
Como aluno, quero transformar capítulos da apostila em flashcards automaticamente.

## UC-06 — Importar Material
Como administrador, quero enviar apostilas e videoaulas para alimentar o Knowledge Engine.

---

# 13. Requisitos Funcionais

## RF-001
O sistema deve permitir cadastro de usuários.

## RF-002
O sistema deve permitir autenticação segura.

## RF-003
O sistema deve armazenar concursos.

## RF-004
O sistema deve armazenar editais.

## RF-005
O sistema deve gerar cronogramas.

## RF-006
O sistema deve armazenar questões.

## RF-007
O sistema deve registrar respostas dos alunos.

## RF-008
O sistema deve calcular estatísticas.

## RF-009
O sistema deve permitir upload de PDFs.

## RF-010
O sistema deve processar OCR.

## RF-011
O sistema deve transcrever videoaulas.

## RF-012
O sistema deve gerar embeddings.

## RF-013
O sistema deve responder perguntas via RAG.

## RF-014
O sistema deve gerar flashcards.

## RF-015
O sistema deve gerar questões inéditas baseadas em material autorizado.

---

# 14. Requisitos Não Funcionais

## Performance

- Resposta do chat do Professor IA (primeiro token) em até 3 segundos.
- TTFB das páginas do app < 500 ms.
- Carregamento do dashboard < 2 segundos.
- Processamento de documentos (OCR/transcrição) assíncrono, sem bloquear a interface.

## Segurança

- Autenticação segura (hash de senha, sessão com expiração).
- HTTPS em toda a plataforma.
- RLS (Row Level Security) no banco de dados.
- Proteção contra injeção de prompt no Professor IA.
- Conformidade com a LGPD (consentimento, exportação e exclusão de dados).

## Escalabilidade

- Suportar 10.000 usuários ativos no MVP com autoscaling.
- Processamento de documentos em filas assíncronas.
- Busca vetorial (pgvector) com índice HNSW.

## Disponibilidade

- Uptime alvo de 99,5%.
- Backups diários do banco de dados.
- Monitoramento de erros e alertas.

## Compatibilidade

- Navegadores: Chrome, Edge, Firefox, Safari (2 últimas versões).
- Responsivo para mobile (≥ 375px).

## Localização e Acessibilidade

- UI 100% em pt-BR.
- Acessibilidade WCAG 2.1 AA.

---

# 15. Métricas de Sucesso (KPIs)

| Métrica | Alvo |
| --- | --- |
| Ativação (1ª sessão de estudo em 24h) | ≥ 40% |
| Retenção D7 / D30 | ≥ 30% / ≥ 20% |
| DAU/MAU | ≥ 25% |
| Questões resolvidas por sessão | ≥ 15 |
| Conversão para plano pago | ≥ 5% |
| Custo de IA por usuário ativo/mês | < R$ 1,50 |
| NPS após o 1º trimestre | ≥ 40 |

---

# 16. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Custo elevado da API de IA | Média | Alto | Limites por plano, cache de respostas, modelo Flash como padrão |
| Qualidade das respostas de IA (alucinação) | Média | Médio | Prompt engineering, RAG com fontes, avaliação contínua, feedback do usuário |
| Dados sensíveis (LGPD) | Baixa | Alto | Minimização de dados, criptografia, anonimização de analíticas |
| Dependência de terceiros (Supabase/DeepSeek/R2) | Média | Médio | Abstração de clientes, fallbacks e monitoramento |
| Processamento pesado (OCR/Whisper) | Média | Médio | Filas assíncronas, workers escaláveis |

---

# 17. Documentos Relacionados

| Documento | Conteúdo |
| --- | --- |
| `02-SDD.md` | Design de sistema e arquitetura |
| `03-AIDD.md` | Design do Professor IA |
| `04-DATABASE.md` | Modelagem do banco de dados |
| `05-API.md` | Endpoints da API |
| `06-KNOWLEDGE-ENGINE.md` | Knowledge Engine (ingestão de materiais) |
| `07-RAG.md` | Retrieval-Augmented Generation |
| `08-ETL.md` | Pipelines de dados e conteúdo |
| `12-ROADMAP.md` | Roadmap de entregas |
| `13-BACKLOG.md` | Backlog priorizado |
