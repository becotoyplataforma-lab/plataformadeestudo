/**
 * ConcursoAI — ContestService (Administration)
 *
 * Orquestra operações administrativas de concursos:
 *   requireAdmin → validação → repository → auditoria.
 *
 * Regras de negócio:
 *  - Novo concurso nasce como `rascunho` (nunca publicado automaticamente);
 *  - slug único (duplicidade → DUPLICATE_SLUG / 409);
 *  - órgão e banca devem existir (FK NOT NULL → ORG_NOT_FOUND / BOARD_NOT_FOUND);
 *  - período válido: end_date >= start_date (CHECK do banco → INVALID_PERIOD).
 */
import "server-only";
import { slugify } from "@/lib/utils/slug";
import {
  ContestRepository,
  type CreateContestInput,
  type UpdateContestInput,
} from "../repositories/contest.repository";
import { OrganBoardRepository } from "../repositories/organ-board.repository";
import {
  AdminGuardService,
  type AdminSession,
} from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class ContestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ContestError";
    this.code = code;
  }
}

export interface ContestServiceCreateInput {
  organId: string;
  boardId: string;
  title: string;
  slug?: string;
  description?: string | null;
  status?: "rascunho" | "publicado" | "encerrado" | "arquivado";
  startDate?: string | null; // ISO
  endDate?: string | null; // ISO
}

export interface ContestServiceUpdateInput {
  organId?: string;
  boardId?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  status?: "rascunho" | "publicado" | "encerrado" | "arquivado";
  startDate?: string | null;
  endDate?: string | null;
}

function toDateOrNull(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(v);
}

function validatePeriod(startDate?: Date | null, endDate?: Date | null) {
  if (startDate && endDate && endDate < startDate) {
    throw new ContestError(
      "INVALID_PERIOD",
      "A data final deve ser maior ou igual à data inicial."
    );
  }
}

export const ContestService = {
  /** Lista concursos (todos os status) — somente admin. */
  async list(admin: AdminSession) {
    await AdminGuardService.requireAdmin(admin);
    return ContestRepository.listAll(200);
  },

  /** Cria concurso — somente admin. Novo concurso nasce como rascunho. */
  async create(admin: AdminSession, input: ContestServiceCreateInput) {
    await AdminGuardService.requireAdmin(admin);

    const title = input.title.trim();
    if (title.length < 3) {
      throw new ContestError("INVALID_TITLE", "O título deve ter pelo menos 3 caracteres.");
    }

    const organ = await OrganBoardRepository.findOrganById(input.organId);
    if (!organ) {
      throw new ContestError("ORG_NOT_FOUND", "Órgão não encontrado.");
    }
    const board = await OrganBoardRepository.findBoardById(input.boardId);
    if (!board) {
      throw new ContestError("BOARD_NOT_FOUND", "Banca não encontrada.");
    }

    const slug = input.slug?.trim() || slugify(title);
    const existing = await ContestRepository.findBySlug(slug);
    if (existing) {
      throw new ContestError("DUPLICATE_SLUG", "Já existe um concurso com este slug.");
    }

    const startDate = toDateOrNull(input.startDate);
    const endDate = toDateOrNull(input.endDate);
    validatePeriod(startDate, endDate);

    const data: CreateContestInput = {
      organId: input.organId,
      boardId: input.boardId,
      title,
      slug,
      description: input.description ?? null,
      status: input.status ?? "rascunho",
      startDate,
      endDate,
    };

    const row = await ContestRepository.create(data);
    await AuditService.record({
      adminId: admin.userId,
      action: "contest.create",
      entityType: "contest",
      entityId: row.id,
      details: { title, slug, status: row.status },
      ip: admin.ip,
    });
    return row;
  },

  /** Atualiza concurso — somente admin. */
  async update(admin: AdminSession, id: string, input: ContestServiceUpdateInput) {
    await AdminGuardService.requireAdmin(admin);

    const existing = await ContestRepository.findById(id);
    if (!existing) {
      throw new ContestError("NOT_FOUND", "Concurso não encontrado.");
    }

    const title = input.title?.trim();
    if (title !== undefined && title.length < 3) {
      throw new ContestError("INVALID_TITLE", "O título deve ter pelo menos 3 caracteres.");
    }

    const slug = input.slug?.trim();
    if (slug !== undefined) {
      const dup = await ContestRepository.findBySlugExcluding(slug, id);
      if (dup) {
        throw new ContestError("DUPLICATE_SLUG", "Já existe um concurso com este slug.");
      }
    }

    const startDate = toDateOrNull(input.startDate);
    const endDate = toDateOrNull(input.endDate);
    validatePeriod(startDate, endDate);

    const data: UpdateContestInput = {};
    if (input.organId !== undefined) data.organId = input.organId;
    if (input.boardId !== undefined) data.boardId = input.boardId;
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = slug;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (startDate !== undefined) data.startDate = startDate;
    if (endDate !== undefined) data.endDate = endDate;

    const row = await ContestRepository.update(id, data);
    if (!row) {
      throw new ContestError("NOT_FOUND", "Concurso não encontrado.");
    }
    await AuditService.record({
      adminId: admin.userId,
      action: "contest.update",
      entityType: "contest",
      entityId: row.id,
      details: { title: row.title, slug: row.slug, status: row.status },
      ip: admin.ip,
    });
    return row;
  },

  /** Soft delete — somente admin. Não apaga dados. */
  async softDelete(admin: AdminSession, id: string) {
    await AdminGuardService.requireAdmin(admin);
    const row = await ContestRepository.softDelete(id);
    if (!row) {
      throw new ContestError("NOT_FOUND", "Concurso não encontrado.");
    }
    await AuditService.record({
      adminId: admin.userId,
      action: "contest.delete",
      entityType: "contest",
      entityId: row.id,
      details: { title: row.title, slug: row.slug },
      ip: admin.ip,
    });
    return row;
  },
};
