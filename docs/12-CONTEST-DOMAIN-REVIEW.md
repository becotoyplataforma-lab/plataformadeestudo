# 12 — CONTEST DOMAIN REVIEW

> Revisão do domínio Contest antes da implementação.
> Sem código, sem SQL, sem alteração de documentos. Apenas análise arquitetural.

---

## 1. MODELO ATUAL (08-DATABASE-PHYSICAL)

| Entidade | Descrição |
| --- | --- |
| organs | Órgão ou instituição realizadora |
| boards | Banca organizadora |
| contests | Concurso público específico |
| editais | Documento oficial do concurso |

O modelo cobre catálogo básico (órgãos, bancas, concursos e editais), mas **não cobre** cargos, fases, provas, mapeamento de conteúdo programático, anexos ou timeline.

---

## 2. ENTIDADES AVALIADAS

### POSITION (Cargo)

### Finalidade
- Representar um cargo específico em um concurso (Analista, Técnico, Auditor, Fiscal).

### Relacionamentos
- Many-to-One com contests.
- Pode referenciar editais (um cargo pode ter edital próprio).

### Benefícios
- Separação do objeto de competição (cargo) do container (concurso).
- Permite estatísticas e análises por cargo.
- Essencial para concursos multi-cargo.

### Impacto no banco
- 1 tabela (positions), FK para contests.
- Leve.

### Impacto no código
- Novo schema Drizzle; API de catálogo (leitura pública).

### Deve entrar no MVP?
- Não. MVP foca em estudo genérico; cargo não afeta cronograma/questões.

### Pode ficar para V1.1?
- Sim. Entra na fase Contest Intelligence (V1.1).

---

### EXAM (Prova)

### Finalidade
- Representar uma prova ou exame específico dentro de uma fase do concurso (prova objetiva, discursiva, redação, TAF).

### Relacionamentos
- Many-to-One com exam_phases.
- Relaciona-se com questions (questões pertencem a uma prova).

### Benefícios
- Vincula questões à prova real de origem.
- Permite filtrar questões por prova específica.
- Essencial para simular uma prova real.

### Impacto no banco
- 1 tabela (exams), FK para exam_phases.
- Study.questions pode referenciar exams.

### Impacto no código
- Novo schema; Study usa como filtro de questões.

### Deve entrar no MVP?
- Não. MVP usa filtros por banca/cargo/ano no lugar.

### Pode ficar para V1.1?
- Sim.

---

### EXAM PHASE (Fase da Prova)

### Finalidade
- Representar uma fase do concurso (1ª fase, 2ª fase, prova discursiva, TAF, psicotécnico, títulos).

### Relacionamentos
- Many-to-One com contests.
- One-to-Many com exams.

### Benefícios
- Estrutura a progressão de fases do concurso.
- Essencial para Contest Intelligence entender o formato completo.

### Impacto no banco
- 1 tabela (exam_phases), FK para contests.

### Impacto no código
- Novo schema; Contest Intelligence usa na V1.1.

### Deve entrar no MVP?
- Não.

### Pode ficar para V1.1?
- Sim.

---

### NOTICE SUBJECT (Matéria do Edital)

### Finalidade
- Mapear uma matéria listada no edital oficial para o catálogo de conhecimento (knowledge_subjects).

### Relacionamentos
- Many-to-One com editais.
- Many-to-One com knowledge_subjects (Study).

### Benefícios
- Ponte oficial entre edital e conteúdo de estudo.
- Permite que o Professor IA responda "com base no edital".
- Essencial para personalizar o estudo pelo edital.

### Impacto no banco
- 1 tabela associativa (notice_subjects), FK editais + knowledge_subjects.
- Leve.

### Impacto no código
- Novo schema; ACL Contest→Study; Professor IA usa na V1.1.

### Deve entrar no MVP?
- Resposta: **sim, com ressalva**. É a entidade mais importante da lista — liga o edital ao conteúdo. No MVP, as matérias são criadas manualmente; uma tabela associativa simples permitiria ao Professor IA usar o edital como contexto mesmo sem o Knowledge Engine completo.

### Pode ficar para V1.1?
- Parcialmente: a ligação edital→matéria é fundamental e deveria existir desde o início. A complexidade (peso, tópicos) fica para V1.1. Apenas a associação básica poderia entrar no MVP como entidade de catálogo.

---

### NOTICE TOPIC (Tópico do Edital)

### Finalidade
- Representar um tópico específico dentro de uma matéria do edital (ex.: "Direitos e Garantias Fundamentais" dentro de "Direito Constitucional").

### Relacionamentos
- Many-to-One com notice_subjects.

### Benefícios
- Granularidade fina de conteúdo programático.
- Permite ao aluno estudar exatamente o que o edital pede.

### Impacto no banco
- 1 tabela (notice_topics), FK para notice_subjects.
- Estrutura de árvore (tópicos aninhados) aumenta complexidade.

### Impacto no código
- Novo schema; interface de navegação por tópicos.

### Deve entrar no MVP?
- Não. Granularidade desnecessária para o MVP.

### Pode ficar para V1.1?
- Sim.

---

### NOTICE ATTACHMENT (Anexo do Edital)

### Finalidade
- Armazenar arquivos anexos ao edital (PDFs do edital, retificações, comunicados).

### Relacionamentos
- Many-to-One com editais.

### Benefícios
- Centraliza todos os arquivos oficiais.
- Facilita o download e a consulta.

### Impacto no banco
- 1 tabela (notice_attachments), FK para editais + storage_path (R2).

### Impacto no código
- Novo schema + integração com storage (R2).

### Deve entrar no MVP?
- Não.

### Pode ficar para V1.1?
- Sim.

---

### EXAM ATTACHMENT (Anexo da Prova)

### Finalidade
- Armazenar arquivos relacionados a uma prova (PDF da prova, gabarito oficial, recursos).

### Relacionamentos
- Many-to-One com exams.

### Benefícios
- Centraliza documentos de provas.
- Fonte para ETL de questões (pipeline).

### Impacto no banco
- 1 tabela (exam_attachments), FK para exams + storage_path (R2).

### Impacto no código
- Novo schema + storage (R2) + pipeline ETL.

### Deve entrar no MVP?
- Não.

### Pode ficar para V1.1?
- Sim (junto com os pipelines ETL de questões).

---

### CONTEST TIMELINE (Linha do Tempo)

### Finalidade
- Representar eventos-chave de um concurso: abertura de inscrições, data da prova, divulgação de gabarito, resultado, convocação.

### Relacionamentos
- Many-to-One com contests.

### Benefícios
- Alertas automáticos para o aluno ("faltam 30 dias para a prova").
- Planejamento de estudo reverso (cronograma até a data da prova).

### Impacto no banco
- 1 tabela (contest_timelines), FK para contests.

### Impacto no código
- Novo schema; integração com cronograma (Study); notificações.

### Deve entrar no MVP?
- Resposta parcial: a **data da prova** é útil para o cronograma e o Professor IA. Uma linha do tempo completa é V1.1.

### Pode ficar para V1.1?
- Sim.

---

## 3. RESUMO COMPARATIVO

| Entidade | MVP? | V1.1? | Depende de | Impacto |
| --- | --- | --- | --- | --- |
| Position | Não | Sim | contests | 1 tabela |
| Exam | Não | Sim | exam_phases | 1 tabela |
| ExamPhase | Não | Sim | contests | 1 tabela |
| NoticeSubject | **Parcial** | Sim | editais, knowledge_subjects | 1 tabela associativa |
| NoticeTopic | Não | Sim | notice_subjects | 1 tabela (árvore) |
| NoticeAttachment | Não | Sim | editais, storage R2 | 1 tabela + storage |
| ExamAttachment | Não | Sim | exams, storage R2 | 1 tabela + storage |
| ContestTimeline | **Parcial** | Sim | contests | 1 tabela |

---

## 4. MODELO RECOMENDADO

### MVP (já existente — manter como está)
- organs
- boards
- contests
- editais

### MVP (acréscimo recomendado — baixo custo, alto valor)
- **notice_subjects** (associação editais → knowledge_subjects, sem peso nem tópicos).
  - Motivo: permite ao Professor IA contextualizar respostas no edital.
  - Impacto: 1 tabela associativa; código de catálogo simples.

### V1.1 (Contest Intelligence — fase completa)
- **notice_subjects** (expandir com peso, recomendações).
- **notice_topics** (tópicos do edital).
- **positions** (cargos).
- **exam_phases** (fases do concurso).
- **exams** (provas por fase).
- **notice_attachments** (anexos do edital).
- **exam_attachments** (documentos de prova, pipeline ETL).
- **contest_timelines** (linha do tempo do concurso).

### Ordem de implementação na V1.1
1. positions (independente)
2. exam_phases → exams (dependente em cascata)
3. notice_subjects (expansão do MVP) → notice_topics
4. contest_timelines (independente)
5. attachments (dependem de storage R2)

> O domínio Contest permanece **congelado no MVP** exceto pelo acréscimo
> opcional de `notice_subjects`. As demais entidades são V1.1.
