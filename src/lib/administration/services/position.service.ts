/**
 * ConcursoAI — PositionService (Administration)
 *
 * Orquestra operações administrativas de cargos:
 *   requireAdmin → validação → repository → auditoria.
 *
 * Regras de negócio:
 *  - Cargo sempre vinculado a um concurso (FK NOT NULL);
 *  - slug único por concurso (duplicidade → DUPLICATE_SLUG / 409);
 *  - concurso deve existir (CONTEST_NOT_FOUND / 422);
 *  - edital (se informado) deve pertencer ao concurso do cargo (EDITAL_NOT_FOUND).
 */
import "server-only";
import { slugify } from "@/lib/utils/slug";
import {
  PositionRepository,
  type CreatePositionInput,
  type UpdatePositionInput,
} from "../repositories/position.repository";
import { ContestRepository } from "../repositories/contest.repository";
import {
  AdminGuardService,
  type AdminSession,
} from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class PositionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PositionError";
    this.code = code;
  }
}

export interface PositionServiceCreateInput {
  contestId: string;
  name: string;
  slug?: string;
  description?: string | null;
  editalId?: string | null;
  status?: "active" | "inactive";
}

export interface PositionServiceUpdateInput {
  name?: string;
  slug?: string;
  description?: string | null;
  editalId?: string | null;
  status?: "active" | "inactive";
}

export const PositionService = {
  /** Lista cargos de um concurso (todos os status) — somente admin. */
  async listByContest(admin: AdminSession, contestId: string) {
    await AdminGuardService.requireAdmin(admin);
    return PositionRepository.listByContest(contestId);
  },

  /** Cria cargo — somente admin. */
  async create(admin: AdminSession, input: PositionServiceCreateInput) {
    await AdminGuardService.requireAdmin(admin);

    const name = input.name.trim();
    if (name.length < 2) {
      throw new PositionError("INVALID_NAME", "O nome do cargo deve ter pelo menos 2 caracteres.");
    }

    const contest = await ContestRepository.findById(input.contestId);
    if (!contest) {
      throw new PositionError("CONTEST_NOT_FOUND", "Concurso não encontrado.");
    }

    const slug = input.slug?.trim() || slugify(name);
    const existing = await PositionRepository.findBySlug(input.contestId, slug);
    if (existing) {
      throw new PositionError(
        "DUPLICATE_SLUG",
        "Já existe um cargo com este nome neste concurso."
      );
    }

    const data: CreatePositionInput = {
      contestId: input.contestId,
      name,
      slug,
      description: input.description ?? null,
      editalId: input.editalId ?? null,
      status: input.status ?? "active",
    };

    const row = await PositionRepository.create(data);
    await AuditService.record({
      adminId: admin.userId,
      action: "position.create",
      entityType: "position",
      entityId: row.id,
      details: { name, slug, contestId: row.contestId },
      ip: admin.ip,
    });
    return row;
  },

  /** Atualiza cargo — somente admin. */
  async update(admin: AdminSession, id: string, input: PositionServiceUpdateInput) {
    await AdminGuardService.requireAdmin(admin);

    const existing = await PositionRepository.findById(id);
    if (!existing) {
      throw new PositionError("NOT_FOUND", "Cargo não encontrado.");
    }

    const name = input.name?.trim();
    if (name !== undefined && name.length < 2) {
      throw new PositionError("INVALID_NAME", "O nome do cargo deve ter pelo menos 2 caracteres.");
    }

    const slug = input.slug?.trim();
    if (slug !== undefined) {
      const dup = await PositionRepository.findBySlugExcluding(
        existing.contestId,
        slug,
        id
      );
      if (dup) {
        throw new PositionError(
          "DUPLICATE_SLUG",
          "Já existe um cargo com este nome neste concurso."
        );
      }
    }

    const data: UpdatePositionInput = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (input.description !== undefined) data.description = input.description;
    if (input.editalId !== undefined) data.editalId = input.editalId;
    if (input.status !== undefined) data.status = input.status;

    const row = await PositionRepository.update(id, data);
    if (!row) {
      throw new PositionError("NOT_FOUND", "Cargo não encontrado.");
    }
    await AuditService.record({
      adminId: admin.userId,
      action: "position.update",
      entityType: "position",
      entityId: row.id,
      details: { name: row.name, slug: row.slug },
      ip: admin.ip,
    });
    return row;
  },

  /** Soft delete — somente admin. Não apaga dados. */
  async softDelete(admin: AdminSession, id: string) {
    await AdminGuardService.requireAdmin(admin);
    const row = await PositionRepository.softDelete(id);
    if (!row) {
      throw new PositionError("NOT_FOUND", "Cargo não encontrado.");
    }
    await AuditService.record({
      adminId: admin.userId,
      action: "position.delete",
      entityType: "position",
      entityId: row.id,
      details: { name: row.name, slug: row.slug },
      ip: admin.ip,
    });
    return row;
  },
};
