/**
 * Testes dos DTOs do Administration — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  SystemSettingDtoSchema,
  SetSettingRequestDtoSchema,
  AdminActionLogDtoSchema,
  ModerationQuestionDtoSchema,
  SetQuestionStatusRequestDtoSchema,
  QuestionStatusDtoSchema,
  mapSystemSettingToDto,
  mapAdminActionLogToDto,
  mapModerationQuestionToDto,
  mapQuestionStatusToDto,
} from "@/lib/dto/administration.dto";

const UUID = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

describe("SystemSettingDtoSchema", () => {
  it("aceita configuração válida", () => {
    const row = {
      id: UUID,
      key: "platform.maintenance_mode",
      value: false,
      description: "Modo manutenção",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const dto = mapSystemSettingToDto(row);
    const parsed = SystemSettingDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.key).toBe("platform.maintenance_mode");
      expect(parsed.data.value).toBe(false);
    }
  });
});

describe("SetSettingRequestDtoSchema", () => {
  it("aceita chave e valor", () => {
    expect(
      SetSettingRequestDtoSchema.safeParse({ key: "ia.default_model", value: "flash" }).success
    ).toBe(true);
  });

  it("rejeita chave vazia", () => {
    expect(
      SetSettingRequestDtoSchema.safeParse({ key: "", value: 1 }).success
    ).toBe(false);
  });
});

describe("AdminActionLogDtoSchema", () => {
  it("aceita e mapeia log de auditoria", () => {
    const row = {
      id: UUID,
      adminId: UUID2,
      action: "user.ban",
      entityType: "user",
      entityId: UUID,
      details: { motivo: "spam" },
      ip: "10.0.0.1",
      createdAt: new Date(),
    };
    const dto = mapAdminActionLogToDto(row);
    const parsed = AdminActionLogDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.action).toBe("user.ban");
      expect(parsed.data.admin_id).toBe(UUID2);
    }
  });

  it("rejeita action vazia", () => {
    const row = {
      id: UUID,
      adminId: null,
      action: "",
      entityType: "user",
      entityId: null,
      details: null,
      ip: null,
      createdAt: new Date(),
    };
    const dto = mapAdminActionLogToDto(row);
    expect(AdminActionLogDtoSchema.safeParse({ ...dto, action: "" }).success).toBe(false);
  });
});

describe("ModerationQuestionDtoSchema", () => {
  it("aceita e mapeia questão para curadoria", () => {
    const dto = mapModerationQuestionToDto({
      id: UUID,
      subjectId: UUID2,
      subjectName: "Direito Constitucional",
      banca: "FGV",
      ano: 2024,
      nivel: "medio",
      enunciado: "Pergunta?",
      status: "rascunho",
      isPublic: false,
      createdAt: new Date(),
    });
    const parsed = ModerationQuestionDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe("rascunho");
  });

  it("rejeita status inválido", () => {
    const dto = mapModerationQuestionToDto({
      id: UUID,
      subjectId: null,
      subjectName: null,
      banca: null,
      ano: null,
      nivel: "facil",
      enunciado: "P?",
      status: "rascunho",
      isPublic: false,
      createdAt: new Date(),
    });
    expect(
      ModerationQuestionDtoSchema.safeParse({ ...dto, status: "lixo" }).success
    ).toBe(false);
  });
});

describe("SetQuestionStatusRequestDtoSchema", () => {
  it("aceita status válido", () => {
    for (const status of ["rascunho", "publicada", "bloqueada"]) {
      expect(
        SetQuestionStatusRequestDtoSchema.safeParse({ status }).success
      ).toBe(true);
    }
  });

  it("rejeita status inválido", () => {
    expect(
      SetQuestionStatusRequestDtoSchema.safeParse({ status: "aprovada" }).success
    ).toBe(false);
  });
});

describe("QuestionStatusDtoSchema", () => {
  it("aceita e mapeia status", () => {
    const dto = mapQuestionStatusToDto({ id: UUID, status: "publicada" });
    expect(QuestionStatusDtoSchema.safeParse(dto).success).toBe(true);
  });
});
