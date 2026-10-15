import { eq, or, type SQL } from "drizzle-orm";
import { documents } from "@/db/schema/knowledge";
import { getProfile } from "@/lib/db/repositories/perfil";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { resolveCourseScope, type CourseScope } from "./course-scope";

/**
 * ConcursoAI - autorizacao central de leitura de documentos de conhecimento.
 *
 * Regra unica, compartilhada por busca, listagens, paginas e rotas:
 *   - admin resolvido no backend ve tudo;
 *   - o dono ve sempre os proprios documentos;
 *   - documento com escopo valido (cargo ou edital) e compartilhado com quem
 *     tem o mesmo escopo;
 *   - documento sem escopo NAO e publico: permanece do dono e do admin.
 *
 * O escopo nunca vem do navegador: as rotas montam a partir do perfil
 * autenticado (resolveCourseScope) e da allowlist de admin.
 */
export interface DocumentAccessScope {
  userId: string;
  positionId?: string | null;
  editalId?: string | null;
  /**
   * Admin resolvido no backend. Professor nao e admin aqui: professor ve os
   * proprios documentos e os compartilhados com o escopo do perfil dele.
   */
  isStaff?: boolean;
}

/** Campos de perfil usados na decisao de acesso. */
export type ProfileLike = {
  position_id?: string | null;
  contest_id?: string | null;
};

/** Colunas minimas para decidir acesso sem carregar o resto da linha. */
export type DocumentScopeRow = {
  userId: string;
  positionId: string | null;
  editalId: string | null;
};

/** Documento compartilhado = tem escopo de curso valido (cargo ou edital). */
export function isSharedDocument(doc: DocumentScopeRow): boolean {
  return Boolean(doc.positionId || doc.editalId);
}

/**
 * Condicao SQL para consultas em documents. `undefined` so ocorre para admin,
 * e and()/where trata undefined como filtro ausente.
 */
export function documentAccessCondition(
  scope: DocumentAccessScope
): SQL | undefined {
  if (scope.isStaff) return undefined;

  const own = eq(documents.userId, scope.userId);
  const shared: SQL[] = [];
  if (scope.positionId) shared.push(eq(documents.positionId, scope.positionId));
  if (scope.editalId) shared.push(eq(documents.editalId, scope.editalId));

  if (shared.length === 0) return own;
  return or(own, ...shared) as SQL;
}

/** Decisao linha a linha, para paginas e rotas que ja tem o documento. */
export function canAccessDocument(
  doc: DocumentScopeRow,
  scope: DocumentAccessScope
): boolean {
  if (scope.isStaff) return true;
  if (doc.userId === scope.userId) return true;
  if (!isSharedDocument(doc)) return false;
  if (scope.positionId && doc.positionId === scope.positionId) return true;
  if (scope.editalId && doc.editalId === scope.editalId) return true;
  return false;
}

/**
 * Escopo a partir de um perfil ja carregado pela pagina/rota: evita a segunda
 * leitura de perfil na mesma requisicao.
 */
export function accessScopeFromProfile(
  userId: string,
  profile: ProfileLike | null,
  options?: { editalId?: string | null; isStaff?: boolean }
): DocumentAccessScope {
  return {
    userId,
    positionId: profile?.position_id ?? null,
    editalId: options?.editalId ?? null,
    isStaff: options?.isStaff === true,
  };
}

/**
 * Escopo completo de acesso, resolvido no servidor: perfil, edital vigente do
 * concurso e allowlist de admin. Falha ao ler o perfil nao abre acesso - cai em
 * escopo vazio, onde o usuario ve apenas os proprios documentos.
 */
export async function resolveAccessScope(
  userId: string,
  email: string | null | undefined
): Promise<DocumentAccessScope> {
  const profile = await getProfile(userId).catch(() => null);
  const courseScope = await resolveCourseScope(profile).catch(
      (): CourseScope => ({})
    );
  const isAdmin = await AdminGuardService.isAdminOrSuperadmin(email ?? null).catch(
    () => false
  );

  return accessScopeFromProfile(userId, profile, {
    editalId: courseScope.editalId ?? null,
    isStaff: isAdmin,
  });
}