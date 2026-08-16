# Plano Mestre — Consolidação de Apostilas + Teste Real Multi-Papel (ConcursoAI)

> **Status de implementação (2026-08-15):**
> - **Fase 3 (Consolidação)** — ✅ implementada (serviço + API + UI do aluno + gate de curadoria).
>   Ver `docs/SDD-CONCURSOAI.md` §20.10.
> - **Seed PME-RJ** — ✅ aplicado (concurso "PMERJ — Soldado PM (REAL)", cargo "Soldado PM (REAL)",
>   matéria "Português"). Banca marcada "a confirmar" e edital/pesos PENDENTES — **nada foi inventado**.
> - **Roteiros de teste (seções 5.1–5.3)** — ⏳ dependem do Fernando: upload manual de
>   `D:\PME-RJ\PORTUGUES` e percorrer as telas com os usuários de teste. O agente não tem acesso
>   ao caminho local nem à senha dos usuários.

Documento único cobrindo: (1) especificação completa da função de consolidação de apostilas, (2) dados reais de teste (PME-RJ), e (3) plano de teste cobrindo **todos os recursos já existentes na plataforma**, por papel (Aluno, Professor IA, Admin). Complementar a SDD-CONCURSOAI.md, AUDIT-APOSTILA-QUESTOES.md e GUIA-CONTEUDO-ADMIN-CONCURSOAI.md.

---

## 1. Objetivo

Sair de "testado por partes isoladas" para "testado como produto completo, com dado real (apostilas de Português do PME-RJ), simulando os 3 papéis que interagem com o sistema". Ao final deste plano executado, o Fernando deve conseguir abrir a plataforma e, sem saber nada do código, confirmar visualmente que cada recurso funciona com conteúdo real.

---

## 2. Inventário completo de recursos (o que existe hoje)

### 2.1 Área do Aluno
| Recurso | Rota | Depende de |
|---|---|---|
| Dashboard | `/dashboard` | Concurso/cargo do perfil, métricas reais |
| Apostilas | `/apostilas`, `/apostilas/[id]` | Upload, indexação, matéria vinculada |
| Aulas (player) | `/aulas/[id]` | Roteiro, avatar, progresso |
| Questões | `/questoes` | Banco de questões + geração por apostila |
| Flashcards | `/flashcards` | Geração por IA |
| Professor IA | `/professor` | RAG sobre apostila selecionada |
| Cronograma | `/cronograma` | Planejamento de estudo |
| Análises | `/analises` | Métricas de desempenho |
| Sessão (player de estudo) | `/sessao` | Fluxo de sessão guiada |
| Perfil | `/perfil` | Dados do aluno, concurso/cargo |
| Configurações | `/configuracoes` | Preferências da conta |

### 2.2 Área Admin
| Recurso | Rota | Status conhecido |
|---|---|---|
| Dashboard admin | `/admin` | Existe |
| Alunos | `/admin/alunos` | Existe |
| Concursos/Editais | `/admin/concursos` | Existe |
| Apostilas | `/admin/apostilas` | Existe |
| Questões (gerar + revisão) | `/admin/questoes` | Existe |
| Aulas | `/admin/aulas` | Existe |
| Avatares | `/admin/avatares` | Existe |
| IA (configuração) | `/admin/ia` | Existe |
| Matérias (catálogo) | `/admin/materias` | **Novo — implementado na rodada anterior** |
| Fontes externas | `/admin/fontes` | **Novo — implementado na rodada anterior** |
| Revisão de apostilas | `/admin/apostilas/revisao` | **Novo — implementado na rodada anterior** |
| Importar questões | `/admin/questoes/importar` | **Novo — implementado na rodada anterior** |
| Importar edital | `/admin/editais/importar` | **Novo — implementado na rodada anterior** |
| Planos | — | **Não existe tela, só API** |
| Pagamentos | — | **Não existe tela, só API** |
| Relatórios | — | **Não existe tela, só API** |
| Configurações (admin) | — | **Não existe tela, só API** |
| Logs | — | **Não existe tela, só API** |

### 2.3 Infraestrutura transversal
- Storage: R2 (primário) + Supabase (fallback) — `/api/health/storage`
- IA: DeepSeek (geração/chat) + embeddings — configurados
- Banco: RLS, ownership por usuário, allowlist de admin
- Planos: Gratuito / Pro (R$29,90) / Intensivo (R$49,90) via Hubla

---

## 3. Especificação da nova função: Consolidação de Apostilas

### 3.1 O que é
O aluno (ou admin) seleciona **N apostilas da mesma matéria** já indexadas e o sistema gera **um material único consolidado** (síntese via IA, não concatenação), que passa a existir como uma nova apostila do tipo "consolidado" — reindexada e pronta para uso no Professor IA e na geração de questões.

### 3.2 Modelo de dados
- Novo campo em `apostilas`: `source_type` (`upload` | `imported` | `consolidated`)
- Novo campo: `source_document_ids` (array/jsonb) — rastreabilidade dos documentos originais
- Reaproveita: `matéria vinculada`, `review_status`, pipeline de chunks/embeddings

### 3.3 API
- `POST /api/documents/consolidate` — body: `{ document_ids: [], subject_id }`
- Validações: todos os documentos da mesma matéria; todos com `status = indexado`; limite de 10 documentos por consolidação; todos pertencentes ao usuário (ou visíveis para ele) por RLS.
- Processo: busca chunks de todos os documentos → prompt de síntese estruturada por tópico via provider de IA já usado na geração de questões → grava novo documento `consolidated` → dispara pipeline normal de chunking/embeddings/indexação sobre o resultado.

### 3.4 UI (Aluno)
- Em `/apostilas`: modo "Selecionar várias" → botão "Consolidar em um resumo" (desabilitado se seleção cruzar matérias ou incluir documento não indexado).
- Barra de progresso (síntese pode demorar).
- Resultado aparece como nova apostila, com badge "Consolidado" e link para os documentos-fonte.

### 3.5 Curadoria
- Documento consolidado entra na mesma fila de revisão (`/admin/apostilas/revisao`) antes de ficar disponível para geração de questões/Professor IA.

### 3.6 Erros a tratar
- Matérias diferentes na seleção → bloqueio com mensagem clara.
- Documento não indexado na seleção → bloqueio.
- Falha da IA na síntese → status `erro`, reprocessável.
- Mais de 10 documentos selecionados → bloqueio com sugestão de dividir em duas consolidações.

---

## 4. Dados reais de teste — PME-RJ

- Script de seed idempotente cadastrando: concurso PME-RJ (nome oficial correto), cargo(s) relevante(s), matéria "Português" no catálogo geral.
- Edital real do PME-RJ: buscar publicamente; se encontrado, associar peso/nº de questões de Português; se não, marcar como **pendente de confirmação manual** — nunca inventar peso.
- Diferenciar claramente esse dado real de qualquer dado mock/exemplo pré-existente no sistema (nome, tag ou flag que deixe isso óbvio no admin).
- Arquivos de origem: `D:\PME-RJ\PORTUGUES` (upload manual do Fernando — caminho local não é acessível pelo agente, precisa ser feito na tela).

---

## 5. Plano de teste por papel

### 5.1 Papel: Aluno
Roteiro completo, na ordem:
1. Login/cadastro como aluno de teste, com concurso/cargo = PME-RJ.
2. Dashboard: confirmar que aparece o concurso certo, métricas, progresso do edital (se calculado).
3. Apostilas: subir os arquivos de Português em lote, vinculando à matéria.
4. Aguardar indexação de todos (status visível).
5. Selecionar todos os documentos de Português → Consolidar em um resumo.
6. Aguardar aprovação do consolidado (via admin, ver 5.3).
7. Gerar questões a partir do consolidado, com peso do edital aplicado.
8. Flashcards: gerar a partir do consolidado (se a função aceitar apostila como fonte — confirmar).
9. Professor IA: abrir `/professor`, selecionar o consolidado, fazer uma pergunta real sobre o conteúdo de Português subido.
10. Cronograma: confirmar que reflete a matéria estudada.
11. Análises: confirmar que registra a atividade (questões respondidas, sessão de estudo).
12. Sessão: rodar uma sessão de estudo guiada usando o material.
13. Perfil/Configurações: confirmar dados do concurso/cargo refletidos corretamente.

### 5.2 Papel: Professor IA (dentro da área do aluno)
1. Testar os 4 modos (aula/dúvida/revisão/exercício) sobre o material consolidado.
2. Confirmar que a resposta cita/usa o conteúdo real da apostila (não resposta genérica de IA sem RAG).
3. Testar pergunta fora do escopo do material (deve admitir limite, não alucinar).

### 5.3 Papel: Admin
1. Login como admin.
2. Matérias: confirmar "Português" cadastrado via seed/catálogo.
3. Concursos/Editais: confirmar PME-RJ e edital importado (ou pendência sinalizada).
4. Apostilas → Revisão: aprovar os documentos originais E o consolidado.
5. Fontes externas: confirmar se o edital do PME-RJ (se importado por URL) aparece registrado com origem/licença.
6. Questões: revisar as questões geradas a partir do consolidado, aprovar/reprovar.
7. Alunos: localizar o aluno de teste, confirmar progresso refletido.
8. IA (configuração): confirmar status DeepSeek/embeddings ativo.
9. Health/storage: confirmar R2 ativo (não fallback) durante todo o teste.

---

## 6. Matriz de cobertura (recurso × papel)

| Recurso | Aluno | Professor IA | Admin |
|---|---|---|---|
| Upload de apostila | ✅ testa | — | ✅ revisa |
| Consolidação | ✅ testa | — | ✅ revisa |
| Geração de questões | ✅ testa | — | ✅ revisa |
| Flashcards | ✅ testa | — | — |
| RAG/chat | — | ✅ testa | — |
| Cronograma/Análises | ✅ testa | — | ✅ vê refletido em Alunos |
| Matérias/Editais | vê refletido | — | ✅ cadastra/confirma |
| Storage/Health | efeito indireto | efeito indireto | ✅ confirma |

---

## 7. Critérios de aceite (Definition of Done deste ciclo de teste)

- [ ] Todos os arquivos de `D:\PME-RJ\PORTUGUES` indexados sem erro.
- [ ] Consolidação gera material coerente (revisão humana confirma que não é lixo/repetição).
- [ ] Questões geradas do consolidado citam peso do edital corretamente (ou sinalizam pendência, se edital não confirmado).
- [ ] Professor IA responde com base no conteúdo real subido, não genérico.
- [ ] Nenhuma tela (aluno ou admin) quebra (sem 500) durante o roteiro completo.
- [ ] Health/storage confirma R2 ativo do início ao fim.
- [ ] Admin consegue aprovar/reprovar em cada fila (material e questões) sem erro.

---

## 8. Riscos e bloqueios conhecidos

- Peso oficial de Português no edital do PME-RJ pode não estar disponível publicamente — nesse caso o teste segue com peso "pendente", não bloqueia o resto.
- PDFs escaneados (sem OCR) no material de Português resultariam em chunk vazio — se acontecer, é o primeiro sinal real de que o item OCR (pendente no guia de conteúdo) virou prioridade, não só teórico.
- Telas de Planos/Pagamentos/Relatórios/Configurações/Logs continuam fora de escopo deste ciclo de teste (ainda não têm UI).

---

## 9. Ordem de execução recomendada

1. Implementar Fase 3 (Consolidação) + seed PME-RJ — feito pelo agente.
2. Fernando faz upload manual dos arquivos reais na tela.
3. Fernando (ou o agente, autenticado como teste) percorre o roteiro do Aluno (seção 5.1).
4. Percorre o roteiro do Professor IA (seção 5.2).
5. Percorre o roteiro do Admin (seção 5.3), incluindo aprovações pendentes geradas nos passos anteriores.
6. Preencher a checklist da seção 7 com resultado real (✅/❌) de cada item.
7. Rodar suíte E2E completa como rede de segurança final.
