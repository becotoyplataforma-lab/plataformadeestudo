/**
 * ConcursoAI — CLI de ingestão de apostila local (dev / homologação)
 *
 * Ingere um arquivo que está no disco (ou no Google Drive montado) do
 * desenvolvedor no Knowledge Core:
 *
 *  - Com `DATABASE_URL` no ambiente: usa o `IngestionService` real, ou seja o
 *    mesmo caminho da UI — bytes no StorageAdapter + linha em `documents` +
 *    vínculo em `document_subjects`.
 *  - Sem banco (`.env.local` ainda não configurado): grava os bytes reais no
 *    StorageAdapter e registra um "manifesto" em `.storage/pending-ingest.json`
 *    com tudo o que a futura migração/seed precisa para inserir a linha.
 *  - `--do-manifesto`: lê o manifesto e completa o que falta — a linha em
 *    `documents` (os bytes já estão no storage) — e limpa os registros ingeridos.
 *    É o comando a correr depois de criar o `.env.local` com `DATABASE_URL`.
 *
 * Uso (o script npm já passa a flag de condições exigida pelo guard `server-only`):
 *   npm run apostila:ingest -- --arquivo "H:/Drive/.../aula-01.pdf" \
 *     --concurso CBM-RJ --materia Português --titulo "Aula 01 - Completo"
 *   npm run apostila:sync            # manifesto -> banco
 *   npx tsx --conditions=react-server scripts/ingest-local-apostila.ts --help
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { getStorage, resolveLocalStorageRoot, type StorageAdapter } from "@/lib/storage";

// ============================================================
// Constantes
// ============================================================

/** Mesmas extensões aceitas por `ALLOWED_MIME_TYPES` no IngestionService. */
const MIME_POR_EXTENSAO: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
};

/**
 * UUID de placeholder para o modo sem banco. O storagePath embute o userId,
 * então ao configurar o banco use o --usuario real para não regravar o arquivo.
 */
const USUARIO_DEV = "00000000-0000-4000-8000-000000000001";

const MANIFESTO = path.resolve(process.cwd(), ".storage", "pending-ingest.json");

// ============================================================
// Tipos
// ============================================================

export interface Opcoes {
  arquivo: string;
  usuario: string;
  /** true quando o usuário veio de `--usuario` (necessário para o re-key no sync). */
  usuarioDefinido: boolean;
  docId: string;
  titulo?: string;
  materia?: string;
  materiaId?: string;
  concurso?: string;
  seco: boolean;
  ajuda: boolean;
  sync: boolean;
  manifesto: string | null;
}

/** Registro do manifesto: o suficiente para inserir a linha depois. */
export interface RegistroPendente {
  documentId: string;
  userId: string;
  type: string;
  title: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  metadata: Record<string, unknown>;
  subjectName: string | null;
  storageDriver: string;
  criadoEm: string;
}

// ============================================================
// CLI
// ============================================================

function ajuda(): string {
  return [
    "Uso: npm run apostila:ingest -- --arquivo <caminho> [opções]",
    "     npm run apostila:sync   [opções]   (= --do-manifesto)",
    "",
    "  --arquivo   caminho do PDF/DOCX/TXT/MD/HTML (obrigatório no ingest)",
    "  --usuario   uuid do usuário (default usa o placeholder de dev)",
    "  --doc-id    uuid do documento (default gera um)",
    "  --titulo    título listado em Minhas Apostilas",
    "  --materia   nome da matéria (ex.: Português) — resolve por nome no banco",
    "  --materia-id  uuid da matéria (alternativa a --materia)",
    "  --concurso  concurso/trilha gravado em documents.metadata (ex.: CBM-RJ)",
    "  --seco      mostra o plano sem gravar nada",
    "",
    "Modo manifesto (--do-manifesto):",
    "  --manifesto caminho alternativo do manifesto (default .storage/pending-ingest.json)",
    "  --usuario   dono real: os bytes são re-indexados para a nova chave de storage",
    "              e a linha em `documents` é inserida com o storagePath definitivo.",
    "",
    "Sem DATABASE_URL o arquivo vai para o storage e o manifesto fica em",
    ".storage/pending-ingest.json (a linha é inserida quando o banco estiver).",
  ].join("\n");
}

/** Defaults partilhados pelo parseArgs e pelos testes do modo manifesto. */
export function opcoesPadrao(): Opcoes {
  return {
    arquivo: "",
    usuario: USUARIO_DEV,
    usuarioDefinido: false,
    docId: randomUUID(),
    seco: false,
    ajuda: false,
    sync: false,
    manifesto: null,
  };
}

function parseArgs(argv: string[]): Opcoes {
  const opcoes: Opcoes = opcoesPadrao();

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const igual = flag.indexOf("=");
    const nome = igual === -1 ? flag : flag.slice(0, igual);
    const inline = igual === -1 ? null : flag.slice(igual + 1);
    const proxima = i + 1 < argv.length ? argv[i + 1] : undefined;
    const valor = inline ?? (proxima !== undefined && !proxima.startsWith("--") ? proxima : null);
    if (valor !== null && inline === null && proxima !== undefined && !proxima.startsWith("--")) {
      i += 1;
    }

    switch (nome) {
      case "--help":
      case "-h":
        opcoes.ajuda = true;
        break;
      case "--arquivo":
        opcoes.arquivo = valor ?? exigir("Informe o caminho depois de --arquivo.");
        break;
      case "--usuario":
        opcoes.usuario = valor ?? exigir("Informe um uuid depois de --usuario.");
        opcoes.usuarioDefinido = true;
        break;
      case "--doc-id":
        opcoes.docId = valor ?? exigir("Informe um uuid depois de --doc-id.");
        break;
      case "--titulo":
        opcoes.titulo = valor ?? exigir("Informe um título depois de --titulo.");
        break;
      case "--materia":
        opcoes.materia = valor ?? exigir("Informe o nome da matéria depois de --materia.");
        break;
      case "--materia-id":
        opcoes.materiaId = valor ?? exigir("Informe um uuid depois de --materia-id.");
        break;
      case "--concurso":
        opcoes.concurso = valor ?? exigir("Informe o concurso depois de --concurso.");
        break;
      case "--seco":
      case "--dry-run":
        opcoes.seco = valor === null || valor === "true";
        break;
      case "--do-manifesto":
      case "--sync":
      case "--manifesto-banco":
        opcoes.sync = valor === null || valor === "true";
        break;
      case "--manifesto":
        opcoes.manifesto = path.resolve(
          valor ?? exigir("Informe o caminho do manifesto depois de --manifesto.")
        );
        opcoes.sync = true;
        break;
      default:
        throw new Error(`Opção desconhecida: ${nome}\n\n${ajuda()}`);
    }
  }

  if (!opcoes.ajuda && !opcoes.sync && opcoes.arquivo === "") {
    throw new Error(`Falta --arquivo (ou use --do-manifesto / npm run apostila:sync).\n\n${ajuda()}`);
  }
  return opcoes;
}

function exigir(mensagem: string): never {
  throw new Error(`${mensagem}\n\n${ajuda()}`);
}

// ============================================================
// Plano de ingestão
// ============================================================

interface Plano {
  usuario: string;
  docId: string;
  nomeArquivo: string;
  bytes: Buffer;
  mimeType: string;
  storagePath: string;
  fileHash: string;
  titulo: string;
  metadata: Record<string, unknown>;
  materia?: string;
  materiaId?: string;
}

/** `documents.type` a partir do MIME (mesmo mapa do IngestionService). */
function tipoDocumento(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "text/markdown":
      return "markdown";
    case "text/html":
      return "html";
    default:
      return "txt";
  }
}

// ============================================================
// Manifesto (modo sem banco)
// ============================================================

async function lerManifesto(caminho: string = MANIFESTO): Promise<RegistroPendente[]> {
  try {
    const dados: unknown = JSON.parse(await readFile(caminho, "utf8"));
    return Array.isArray(dados) ? (dados as RegistroPendente[]) : [];
  } catch {
    return [];
  }
}

/** Escreve (ou apaga, quando não restam registros) o manifesto. */
async function gravarManifesto(
  caminho: string,
  registros: RegistroPendente[]
): Promise<void> {
  if (registros.length === 0) {
    await rm(caminho, { force: true });
    return;
  }
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, `${JSON.stringify(registros, null, 2)}\n`, "utf8");
}

async function upsertManifesto(
  registro: RegistroPendente,
  caminho: string = MANIFESTO
): Promise<number> {
  const restantes = (await lerManifesto(caminho)).filter(
    (item) => item.documentId !== registro.documentId
  );
  const registros = [...restantes, registro];
  await gravarManifesto(caminho, registros);
  return registros.length;
}

// ============================================================
// Modos
// ============================================================

/** Banco configurado: exatamente o mesmo caminho da UI (bytes + linha + vínculo). */
async function ingerirComBanco(plano: Plano): Promise<void> {
  const { IngestionService, IngestionError } = await import(
    "@/lib/knowledge/services/ingestion.service"
  );

  let subjectId = plano.materiaId;
  if (!subjectId && plano.materia) {
    const { KnowledgeSubjectRepository } = await import(
      "@/lib/knowledge/repositories/subject.repository"
    );
    const encontrada = await KnowledgeSubjectRepository.findByName(plano.materia);
    if (encontrada) {
      subjectId = encontrada.id;
    } else {
      console.warn(
        `⚠  Matéria "${plano.materia}" não existe em knowledge_subjects: a apostila entra "Sem matéria". ` +
          "Crie a matéria (sql/seed.sql) ou passe --materia-id."
      );
    }
  }

  const file = new File([new Uint8Array(plano.bytes)], plano.nomeArquivo, {
    type: plano.mimeType,
  });

  try {
    const resultado = await IngestionService.ingest({
      userId: plano.usuario,
      file,
      title: plano.titulo,
      metadata: plano.metadata,
      subjectId,
    });
    console.log(`✅ Documento registrado: ${resultado.documentId}`);
    console.log(`   Chave no storage: ${resultado.storagePath} | status: ${resultado.status}`);
    console.log(`   Matéria vinculada: ${subjectId ?? "nenhuma (Sem matéria)"}`);
  } catch (erro) {
    if (erro instanceof IngestionError && erro.code === "DUPLICATE_FILE") {
      console.log(
        `ℹ  Arquivo já ingerido neste usuário (mesmo SHA-256): documento ${erro.details?.existingDocumentId ?? "?"}. Nada gravado.`
      );
      return;
    }
    throw erro;
  }
}

/** Sem banco: bytes reais no StorageAdapter + manifesto para a futura migração. */
async function ingerirSemBanco(plano: Plano): Promise<void> {
  const storage = getStorage();
  const conteudo = new Uint8Array(plano.bytes);

  if (await storage.exists(plano.storagePath)) {
    console.log("ℹ  Os bytes já existiam nesta chave; regravados (idempotente).");
  }
  await storage.upload(plano.storagePath, conteudo, plano.mimeType);

  const total = await upsertManifesto({
    documentId: plano.docId,
    userId: plano.usuario,
    type: tipoDocumento(plano.mimeType),
    title: plano.titulo,
    storagePath: plano.storagePath,
    mimeType: plano.mimeType,
    fileSize: plano.bytes.byteLength,
    fileHash: plano.fileHash,
    metadata: plano.metadata,
    subjectName: plano.materia ?? null,
    storageDriver: storage.driver,
    criadoEm: new Date().toISOString(),
  });

  console.log(`✅ Bytes gravados no storage (driver "${storage.driver}"): ${plano.storagePath}`);
  if (storage.driver === "local") {
    console.log(`   Em disco: ${path.join(resolveLocalStorageRoot(), ...plano.storagePath.split("/"))}`);
  }
  console.log(`   Manifesto: ${MANIFESTO} (${total} registro(s) aguardando banco)`);
  console.log(
    "   ⚠  Falta a linha em `documents`: rode de novo com DATABASE_URL no .env.local usando o " +
      "--usuario real do Supabase (a chave de storage embute o userId)."
  );
}

// ============================================================
// Modo --do-manifesto: bytes já no storage -> linha em `documents`
// ============================================================

/** Valores do enum `document_type` (src/db/schema/knowledge.ts). */
const TIPOS_VALIDOS = ["pdf", "docx", "txt", "markdown", "html", "edital", "apostila"] as const;
type TipoValido = (typeof TIPOS_VALIDOS)[number];

/** A verificação lê o objeto inteiro: acima disto o sync recusa (ferramenta de dev). */
const LIMITE_SYNC_BYTES = 200 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizaTipo(valor: string): TipoValido | null {
  return (TIPOS_VALIDOS as readonly string[]).includes(valor) ? (valor as TipoValido) : null;
}

interface ConteudoStorage {
  bytes: Uint8Array;
  sha256: string;
}

/** Lê o objeto pelo próprio StorageAdapter e devolve bytes + SHA-256 (prova de integridade). */
async function leConteudoStorage(storage: StorageAdapter, chave: string): Promise<ConteudoStorage> {
  const leitor = (await storage.getStream(chave)).body.getReader();
  const pedacos: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (value) pedacos.push(value);
  }
  let total = 0;
  for (const pedaco of pedacos) total += pedaco.byteLength;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const pedaco of pedacos) {
    bytes.set(pedaco, offset);
    offset += pedaco.byteLength;
  }
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** A chave é sempre `<userId>/<docId>/<arquivo>`: embute o dono definitivo. */
function chaveStorage(usuario: string, docId: string, nomeArquivo: string): string {
  return `${usuario}/${docId}/${nomeArquivo}`;
}

/** `--seco` do sync: não toca o banco nem o storage. */
function planejaSync(registros: RegistroPendente[], opcoes: Opcoes): void {
  for (const registro of registros) {
    const dono = opcoes.usuarioDefinido ? opcoes.usuario : registro.userId;
    const docId = registro.documentId || registro.storagePath.split("/")[1] || "(gerar)";
    const chaveFinal = chaveStorage(dono, docId, path.basename(registro.storagePath));
    console.log(
      [
        `   ${docId}  ${registro.title}`,
        `     de: ${registro.userId} -> ${dono}`,
        `     chave: ${chaveFinal}`,
        `     bytes: ${registro.fileSize.toLocaleString("pt-BR")} | sha256: ${registro.fileHash.slice(0, 12)}…` +
          ` | matéria: ${registro.subjectName ?? "Sem matéria"}`,
      ].join("\n")
    );
  }
  console.log("(--seco) Nada foi gravado: nenhuma linha inserida, nenhum byte movido.");
}

/**
 * Completa o que a ingestão sem banco deixou em atraso: insere a linha em
 * `documents` apontando para os bytes JÁ presentes no storage. Não re-grava
 * conteúdo — move a chave apenas quando `--usuario` muda o dono, e só apaga a
 * chave antiga depois de a linha estar registrada (rollback em qualquer falha).
 */
export async function sincronizarManifesto(opcoes: Opcoes): Promise<void> {
  const caminho = opcoes.manifesto ?? MANIFESTO;
  const registros = await lerManifesto(caminho);

  console.log(`Manifesto : ${caminho}`);
  console.log(`Registros : ${registros.length}`);
  if (registros.length === 0) {
    console.log("ℹ  Nada a sincronizar (manifesto vazio ou já concluído).");
    return;
  }

  if (opcoes.seco) {
    planejaSync(registros, opcoes);
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL ausente. Crie o .env.local com o Supabase e rode de novo — " +
        "os bytes e o manifesto estão intactos, nada foi gravado."
    );
  }

  const storage = getStorage();
  const { DocumentRepository } = await import("@/lib/knowledge/repositories/document.repository");
  const { DocumentSubjectRepository } = await import(
    "@/lib/knowledge/repositories/junction.repository"
  );
  const { KnowledgeSubjectRepository } = await import(
    "@/lib/knowledge/repositories/subject.repository"
  );

  console.log(`Storage   : driver "${storage.driver}"`);
  console.log("");

  const restantes: RegistroPendente[] = [];
  let ingeridos = 0;
  let ignorados = 0;

  for (const registro of registros) {
    const rotulo = `${registro.title} (${registro.documentId || "sem id"})`;
    const dono = opcoes.usuarioDefinido ? opcoes.usuario : registro.userId;
    const docId = registro.documentId || registro.storagePath.split("/")[1] || randomUUID();
    const chaveFinal = chaveStorage(dono, docId, path.basename(registro.storagePath));
    const tipo = normalizaTipo(registro.type);

    if (!tipo) {
      console.error(`❌ ${rotulo}: type "${registro.type}" fora do enum document_type — pendente.`);
      restantes.push(registro);
      continue;
    }
    if (!UUID_RE.test(dono) || !UUID_RE.test(docId)) {
      console.error(`❌ ${rotulo}: userId/docId não são uuid válidos — pendente.`);
      restantes.push(registro);
      continue;
    }
    if (registro.fileSize > LIMITE_SYNC_BYTES) {
      console.error(
        `❌ ${rotulo}: ${(registro.fileSize / 1024 / 1024).toFixed(0)} MB acima do limite de ` +
          `${LIMITE_SYNC_BYTES / 1024 / 1024} MB do sync (o upload da UI não tem esse limite) — pendente.`
      );
      restantes.push(registro);
      continue;
    }

    const existente = await DocumentRepository.findById(docId);
    if (existente) {
      if (existente.storagePath === chaveFinal) {
        console.log(`ℹ  ${rotulo}: linha já existe na mesma chave — removida do manifesto.`);
        ignorados += 1;
      } else {
        console.error(
          `⚠  ${rotulo}: já existe a linha ${docId} com storagePath "${existente.storagePath}". ` +
            "Resolva à mão (ou re-ingerir pela UI) — pendente."
        );
        restantes.push(registro);
      }
      continue;
    }

    // ---- bytes: a origem pode ser a chave antiga (mudança de dono) ou a final ----
    let chaveOrigem = registro.storagePath;
    if (!(await storage.exists(chaveOrigem))) {
      if (await storage.exists(chaveFinal)) {
        chaveOrigem = chaveFinal; // uma corrida anterior já re-indexou
      } else {
        console.error(
          `❌ ${rotulo}: os bytes não estão no storage ("${registro.storagePath}"). ` +
            "Re-ingerir com --arquivo — pendente."
        );
        restantes.push(registro);
        continue;
      }
    }

    const conteudo = await leConteudoStorage(storage, chaveOrigem);
    if (conteudo.bytes.byteLength !== registro.fileSize) {
      console.error(
        `❌ ${rotulo}: tamanho divergente (manifesto ${registro.fileSize} vs storage ` +
          `${conteudo.bytes.byteLength}) — linha NÃO inserida, pendente.`
      );
      restantes.push(registro);
      continue;
    }
    if (registro.fileHash && conteudo.sha256 !== registro.fileHash) {
      console.error(
        `❌ ${rotulo}: SHA-256 divergente (${conteudo.sha256} ≠ ${registro.fileHash}) — ` +
          "bytes corrompidos, linha NÃO inserida, pendente."
      );
      restantes.push(registro);
      continue;
    }

    let novaChaveCriada = false;
    if (chaveFinal !== chaveOrigem) {
      if (await storage.exists(chaveFinal)) {
        console.warn(`⚠  ${rotulo}: a chave de destino já existia; será reutilizada.`);
      } else {
        await storage.upload(chaveFinal, conteudo.bytes, registro.mimeType);
        novaChaveCriada = true;
      }
    }

    const desfazReindexacao = async () => {
      if (!novaChaveCriada) return;
      try {
        await storage.delete(chaveFinal);
      } catch {
        console.warn(`⚠  Falha ao remover a chave temporária ${chaveFinal} — limpar à mão.`);
      }
    };

    // ---- matéria: por nome, tolerante a catálogo ainda não semeado ----
    let subjectId: string | null = null;
    if (registro.subjectName) {
      const encontrada = await KnowledgeSubjectRepository.findByName(registro.subjectName);
      if (encontrada) {
        subjectId = encontrada.id;
      } else {
        console.warn(
          `⚠  ${rotulo}: matéria "${registro.subjectName}" não existe em knowledge_subjects ` +
            '(sql/seed.sql). A apostila entra em "Sem matéria".'
        );
      }
    }

    const duplicado = await DocumentRepository.findByHash(dono, conteudo.sha256);
    if (duplicado) {
      await desfazReindexacao();
      console.log(
        `ℹ  ${rotulo}: mesmo SHA-256 já registrado como documento ${duplicado.id} — ` +
          "nada duplicado, removido do manifesto."
      );
      ignorados += 1;
      continue;
    }

    let documento;
    try {
      documento = await DocumentRepository.create({
        id: docId,
        userId: dono,
        type: tipo,
        title: registro.title,
        storagePath: chaveFinal,
        status: "pending",
        fileSize: conteudo.bytes.byteLength,
        mimeType: registro.mimeType,
        sourceType: "upload",
        fileHash: conteudo.sha256,
        metadata: registro.metadata ?? {},
      });
    } catch (erroInsert) {
      await desfazReindexacao();
      console.error(
        `❌ ${rotulo}: insert em documents falhou (${
          erroInsert instanceof Error ? erroInsert.message : String(erroInsert)
        }) — bytes revertidos, pendente.`
      );
      restantes.push(registro);
      continue;
    }

    if (subjectId) {
      try {
        await DocumentSubjectRepository.upsert(documento.id, subjectId, 100);
      } catch (erroJuncao) {
        await DocumentRepository.softDelete(documento.id);
        await desfazReindexacao();
        console.error(
          `❌ ${rotulo}: vínculo de matéria falhou (${
            erroJuncao instanceof Error ? erroJuncao.message : String(erroJuncao)
          }) — linha e bytes revertidos, pendente.`
        );
        restantes.push(registro);
        continue;
      }
    }

    if (chaveOrigem !== chaveFinal) {
      try {
        await storage.delete(chaveOrigem);
      } catch {
        console.warn(
          `⚠  ${rotulo}: linha registrada, mas a chave antiga ${chaveOrigem} não foi removida ` +
            "(órfã). Limpar manualmente quando o storage estiver acessível."
        );
      }
    }

    ingeridos += 1;
    console.log(`✅ ${rotulo}: documento ${documento.id} registrado em "${chaveFinal}".`);
    console.log(
      `   status "pending" (sem chunks: o índice RAG é fase posterior) | ` +
        `matéria: ${subjectId ?? "nenhuma"} | visível em /apostilas`
    );
  }

  await gravarManifesto(caminho, restantes);

  console.log("");
  console.log(
    `Resumo: ${ingeridos} ingerido(s), ${ignorados} já registrado(s), ` +
      `${restantes.length} ainda pendente(s) em ${caminho}.`
  );
  if (restantes.length > 0) {
    process.exitCode = 1;
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const opcoes = parseArgs(process.argv.slice(2));
  if (opcoes.ajuda) {
    console.log(ajuda());
    return;
  }

  if (opcoes.sync) {
    await sincronizarManifesto(opcoes);
    return;
  }

  const absoluta = path.resolve(opcoes.arquivo);
  const extensao = path.extname(absoluta).toLowerCase();
  const mimeType = MIME_POR_EXTENSAO[extensao];
  if (!mimeType) {
    throw new Error(`Extensão não suportada: ${extensao || "(nenhuma)"}\nSuportadas: ${Object.keys(MIME_POR_EXTENSAO).join(", ")}`);
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(absoluta);
  } catch {
    throw new Error(`Não foi possível ler o arquivo: ${absoluta}`);
  }

  const nomeArquivo = path.basename(absoluta);
  const temBanco = Boolean(process.env.DATABASE_URL?.trim());
  const plano: Plano = {
    usuario: opcoes.usuario,
    docId: opcoes.docId,
    nomeArquivo,
    bytes,
    mimeType,
    storagePath: `${opcoes.usuario}/${opcoes.docId}/${nomeArquivo}`,
    fileHash: createHash("sha256").update(bytes).digest("hex"),
    titulo: opcoes.titulo ?? nomeArquivo.replace(/\.[^.]+$/, ""),
    metadata: opcoes.concurso ? { concurso: opcoes.concurso } : {},
    materia: opcoes.materia,
    materiaId: opcoes.materiaId,
  };

  console.log(`Arquivo : ${absoluta}`);
  console.log(`Bytes   : ${plano.bytes.byteLength.toLocaleString("pt-BR")} (${extensao})`);
  console.log(`SHA-256 : ${plano.fileHash}`);
  console.log(`Chave   : ${plano.storagePath}`);
  console.log(`Título  : ${plano.titulo}`);
  console.log(`Concurso: ${opcoes.concurso ?? "-"}`);
  console.log(`Matéria : ${opcoes.materia ?? opcoes.materiaId ?? "Sem matéria"}`);
  console.log(`Modo    : ${temBanco ? "banco + storage (IngestionService)" : "só storage (sem DATABASE_URL)"}`);

  if (opcoes.seco) {
    console.log("(--seco) Nada foi gravado.");
    return;
  }

  if (temBanco) {
    await ingerirComBanco(plano);
  } else {
    await ingerirSemBanco(plano);
  }
}

/**
 * Exporta as funções para que o vitest possa testar o sync sem executar o CLI:
 * o `main()` só corre quando o ficheiro é invocado como script.
 */
const executandoComoScript = /ingest-local-apostila\.[cm]?[jt]s$/i.test(process.argv[1] ?? "");

if (executandoComoScript) {
  main().catch((erro: unknown) => {
    console.error(`❌ ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
