/**
 * ConcursoAI — OrganBoardService (Administration)
 *
 * Orquestra operações administrativas dos catálogos de órgãos (organs) e
 * bancas (boards):
 *   requireAdmin → validação → repository → auditoria.
 *
 * Regras:
 *  - nome obrigatório (mín 2 chars);
 *  - slug único (duplicidade → DUPLICATE_SLUG / 409);
 *  - find-or-create idempotente por slug.
 */
import "server-only";
import { slugify } from "@/lib/utils/slug";
import { OrganBoardRepository } from "../repositories/organ-board.repository";
import {
  AdminGuardService,
  type AdminSession,
} from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class OrganBoardError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OrganBoardError";
    this.code = code;
  }
}

export interface OrganBoardCreateInput {
  type: "organ" | "board";
  name: string;
  description?: string | null;
}

export const OrganBoardService = {
  /** Lista órgãos e bancas ativos — somente admin. */
  async list(admin: AdminSession) {
    await AdminGuardService.requireAdmin(admin);
    const [organs, boards] = await Promise.all([
      OrganBoardRepository.listOrgans(),
      OrganBoardRepository.listBoards(),
    ]);
    return { organs, boards };
  },

  /** Cria órgão ou banca — somente admin. Find-or-create idempotente. */
  async create(admin: AdminSession, input: OrganBoardCreateInput) {
    await AdminGuardService.requireAdmin(admin);

    const name = input.name.trim();
    if (name.length < 2) {
      throw new OrganBoardError(
        "INVALID_NAME",
        "O nome deve ter pelo menos 2 caracteres."
      );
    }
    const slug = slugify(name);

    if (input.type === "organ") {
      const existing = await OrganBoardRepository.findOrganBySlug(slug);
      if (existing) {
        throw new OrganBoardError("DUPLICATE_SLUG", "Já existe um órgão com este nome.");
      }
      const row = await OrganBoardRepository.createOrgan({
        name,
        slug,
        description: input.description ?? null,
      });
      await AuditService.record({
        adminId: admin.userId,
        action: "organ.create",
        entityType: "organ",
        entityId: row.id,
        details: { name, slug },
        ip: admin.ip,
      });
      return row;
    }

    const existing = await OrganBoardRepository.findBoardBySlug(slug);
    if (existing) {
      throw new OrganBoardError("DUPLICATE_SLUG", "Já existe uma banca com este nome.");
    }
    const row = await OrganBoardRepository.createBoard({
      name,
      slug,
      description: input.description ?? null,
    });
    await AuditService.record({
      adminId: admin.userId,
      action: "board.create",
      entityType: "board",
      entityId: row.id,
      details: { name, slug },
      ip: admin.ip,
    });
    return row;
  },
};
