# Guia de Alimentação de Conteúdo — ConcursoAI

> **Status da implementação (2026-08-15):** itens 1–7 do checklist (§6) implementados
> (código, UI, migration e testes) — ver `docs/SDD-CONCURSOAI.md` §20. Itens 8 (OCR) e 9
> (transcrição) ficam como **detecção/hook**: o pipeline sinaliza material que precisa de OCR
> ou transcrição e falha com mensagem clara, pois o serviço externo ainda não está configurado
> (bloqueio real, não silencioso).

Este documento define **tudo que o administrador precisa para alimentar a plataforma com material de estudo** — tanto por upload direto quanto por conteúdo externo da internet — e o que falta construir no admin para isso funcionar de ponta a ponta. É um guia operacional + funcional, complementar ao SDD-CONCURSOAI.md.

---

## 1. Objetivo

Hoje o pipeline técnico de apostila (upload → storage → extração → chunks → embeddings → indexação) já funciona. O que falta é a **camada de conteúdo**: de onde vem o material, como ele é organizado por concurso/cargo/matéria, e como o admin consegue alimentar isso em volume — sem depender de subir arquivo por arquivo manualmente.

Este guia cobre três frentes:
1. **Upload manual** (o admin já tem o material em arquivo).
2. **Importação de conteúdo externo** (o material está na internet — editais, leis, apostilas públicas).
3. **Estrutura e curadoria** (como isso vira apostila vinculada a matéria/edital, e como é revisado antes de ir ao ar).

---

## 2. Upload manual — o que o admin precisa poder subir

### 2.1 Tipos de documento
| Tipo | Formatos | Uso |
|---|---|---|
| Apostila / material teórico | PDF, DOCX, TXT, MD, HTML | Fonte para RAG do Professor IA e geração de questões |
| Edital / regulamento do concurso | PDF | Fonte para extrair matérias, pesos, cargo, banca, datas |
| Lei / legislação seca | PDF, TXT, HTML | Fonte de apoio para matérias de direito, RLM, etc. |
| Questões já prontas (banco externo) | CSV, XLSX, JSON | Importação em lote de questões existentes (não geradas por IA) |
| Vídeo/áudio de aula | MP4, MP3 (ou link externo) | Transcrição → texto → chunks (requer pipeline novo, ver 5.4) |
| Slides de aula | PPTX, PDF | Fonte visual para o player de aulas |

### 2.2 O que falta no admin (upload)
- [ ] **Upload em lote** (múltiplos arquivos de uma vez, com fila de processamento visível — hoje parece ser 1 a 1).
- [ ] **Importador de questões prontas** (CSV/XLSX/JSON → banco de questões, com validação de formato antes de gravar).
- [ ] **Campo obrigatório na subida**: vincular o arquivo a **concurso → cargo → matéria** no momento do upload (hoje isso pode estar solto).
- [ ] **Status de processamento visível por arquivo**: recebido → extraindo → chunking → embeddings → indexado → erro (com motivo do erro, reaproveitando o rastreamento que já existe no backend).
- [ ] **Reprocessar** um arquivo que falhou, sem precisar subir de novo.

---

## 3. Conteúdo externo da internet — o que trazer e como

### 3.1 Fontes recomendadas (conteúdo público/oficial — sem risco de direito autoral)
| Fonte | O que oferece | Como usar |
|---|---|---|
| Diário Oficial da União / estados/municípios | Editais oficiais publicados | Baixar PDF do edital → importar |
| Sites das bancas organizadoras (Cebraspe, FGV, FCC, Vunesp, IBFC, AOCP, IADES etc.) | Editais, provas anteriores, gabaritos | Baixar PDF → importar como edital ou banco de questões (provas anteriores) |
| Portais dos órgãos (ex.: portal do TRT, INSS, Receita Federal, prefeituras) | Editais, retificações, regulamentos internos | Baixar PDF → importar |
| Planalto / bases de legislação (planalto.gov.br, senado.leg.br) | Leis secas, decretos, súmulas | Baixar HTML/PDF → importar como material de apoio por matéria |
| PCI Concursos, QConcursos (conteúdo próprio deles) | **Não usar diretamente** — conteúdo autoral de terceiros | Apenas como referência de mercado, não para importar texto |

### 3.2 Regra de ouro sobre direitos autorais
- **Documentos públicos oficiais** (editais, leis, diários oficiais, jurisprudência) → **livres para usar**, são atos públicos.
- **Provas anteriores das bancas** → geralmente públicas para fins de estudo, mas confirmar política de cada banca antes de redistribuir em massa.
- **Apostilas, resumos e videoaulas de terceiros** (produtos comerciais de cursinhos, professores, PCI/QConcursos etc.) → **não importar sem autorização**. Isso é o principal risco jurídico do projeto se ele crescer.
- Recomendação: todo material externo importado deve ter um campo `fonte` e `licenca` registrado no banco, para rastreabilidade futura.

### 3.3 O que falta no admin (importação externa)
- [ ] **Importador por URL**: admin cola o link do edital/lei/PDF público e o sistema baixa, extrai e processa automaticamente (reaproveita o pipeline de extração já existente).
- [ ] **Extração automática de estrutura do edital via IA**: dado o PDF do edital, a IA já deveria conseguir sugerir automaticamente: matérias, pesos, número de questões por matéria, cargo(s), banca, data da prova. Hoje isso parece ser cadastro manual (`notice_subjects` sem UI, conforme SDD). Esse é o item de maior alavancagem — sem ele, cada edital novo é trabalho manual repetitivo.
- [ ] **Biblioteca de fontes externas**: uma tela listando "de onde" veio cada material (site da banca, Planalto, etc.), com histórico de importações e status.
- [ ] **Deduplicação**: evitar importar o mesmo edital/lei duas vezes (hash do arquivo ou checagem por URL já importada).

---

## 4. Estrutura de dados necessária (para tudo acima funcionar)

Estrutura mínima que o admin precisa conseguir gerenciar via UI (hoje algumas dessas entidades só existem no banco, sem tela — conforme SDD):

1. **Concurso** (nome, órgão, banca, status: previsto/aberto/encerrado)
2. **Cargo** (vinculado ao concurso, requisitos, remuneração opcional)
3. **Edital** (arquivo original + versão + data de publicação + retificações)
4. **Matéria/Assunto** (catálogo geral, reaproveitável entre concursos — hoje "vem do banco, sem UI" segundo o SDD; **isso precisa de tela de cadastro**)
5. **Matéria do Edital** (`notice_subjects`): matéria + peso/nº de questões **para aquele edital específico**
6. **Apostila** (arquivo + matéria vinculada + concurso opcional + status de indexação)
7. **Fonte externa** (URL de origem, tipo de licença, data de importação)

Sem os itens 4 e 5 com UI própria, o vínculo "apostila → matéria → peso do edital" (que acabamos de implementar no fluxo de geração de questões) depende de alguém popular isso direto no banco — o que não escala para o admin usar sozinho.

---

## 5. Curadoria e qualidade (antes de ir ao ar para o aluno)

### 5.1 Fluxo recomendado
1. Material entra (upload ou importação externa) → status `pendente`.
2. Pipeline técnico processa (extração/chunking/embeddings) → status `indexado` ou `erro`.
3. **Revisão de conteúdo** (novo passo): admin confere se o material extraído faz sentido (texto não corrompido, matéria correta) → status `aprovado`.
4. Só material `aprovado` entra no RAG do Professor IA e na geração de questões.

### 5.2 O que falta no admin
- [ ] Tela de **fila de revisão de material** (separada da fila de revisão de questões que já existe).
- [ ] Preview do texto extraído antes de aprovar (para pegar PDF escaneado sem OCR, texto quebrado, etc.).
- [ ] Marcar apostila como **desatualizada** quando uma nova versão do edital for publicada (retificação muda pesos/matérias).

### 5.3 OCR para PDFs escaneados
Editais e apostilas antigas às vezes são PDF escaneado (imagem, não texto). Verificar se o pipeline atual de extração já lida com isso; se não, é um bloqueio silencioso — o upload "funciona" mas o texto extraído fica vazio ou ilegível.

### 5.4 Transcrição de vídeo/áudio (se for usar aulas em vídeo como fonte)
Requer um passo adicional não coberto pelo pipeline atual: vídeo/áudio → transcrição (Whisper ou similar) → texto → chunks. Só vale priorizar se o projeto realmente for usar videoaulas de terceiros como fonte de estudo (atenção redobrada a direitos autorais nesse caso).

---

## 6. Checklist priorizado para o admin "alimentar sozinho" o sistema

Ordem sugerida de construção, da maior à menor alavancagem:

1. **Cadastro de Matéria** (tela simples — hoje só existe no banco).
2. **Extração automática de estrutura do edital via IA** (upload do PDF do edital → sugestão automática de matérias/pesos/cargo para o admin revisar e confirmar, em vez de digitar tudo).
3. **Importador por URL** (cola o link, sistema baixa e processa).
4. **Upload em lote de apostilas** com vínculo obrigatório a matéria.
5. **Fila de revisão de material** (aprovar antes de liberar para o aluno).
6. **Biblioteca de fontes externas** com registro de licença/origem.
7. **Importador de questões prontas** (CSV/XLSX/JSON).
8. OCR para PDFs escaneados (se ainda não houver).
9. Transcrição de vídeo/áudio (só se for usar videoaulas como fonte).

Os itens 1–3 são os que mais destravam o admin a operar sem depender de alguém mexer no banco manualmente — valem ser o próximo bloco de comando para o agente, se você quiser seguir essa ordem.

---

## 7. Riscos a ter em mente

- **Direitos autorais** de apostilas/videoaulas de terceiros é o maior risco jurídico se o projeto crescer — tratar como regra dura, não como detalhe técnico.
- **Qualidade do texto extraído** (OCR, PDFs mal formatados) impacta diretamente a qualidade das questões geradas pela IA — vale investir em revisão antes de escalar volume de conteúdo.
- **Editais mudam** (retificações são comuns) — sem um processo de atualização, apostilas/questões podem ficar desalinhadas com o edital vigente.
