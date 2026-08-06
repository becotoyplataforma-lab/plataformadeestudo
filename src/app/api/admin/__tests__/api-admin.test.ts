/**
 * Testes das API routes /api/admin/*.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockListSettings = vi.fn();
const mockSetSetting = vi.fn();
const mockRemoveSetting = vi.fn();
const mockGetSetting = vi.fn();
vi.mock("@/lib/administration/services/system-setting.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/system-setting.service")
  >();
  return {
    ...actual,
    SystemSettingService: {
      list: (...a: unknown[]) => mockListSettings(...a),
      set: (...a: unknown[]) => mockSetSetting(...a),
      remove: (...a: unknown[]) => mockRemoveSetting(...a),
      get: (...a: unknown[]) => mockGetSetting(...a),
    },
  };
});

const mockAuditList = vi.fn();
vi.mock("@/lib/administration/services/audit.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/administration/services/audit.service")>();
  return {
    ...actual,
    AuditService: { record: vi.fn(), list: (...a: unknown[]) => mockAuditList(...a) },
  };
});

const mockListQuestions = vi.fn();
const mockSetQuestionStatus = vi.fn();
vi.mock("@/lib/administration/services/moderation.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/administration/services/moderation.service")>();
  return {
    ...actual,
    ModerationService: {
      listQuestions: (...a: unknown[]) => mockListQuestions(...a),
      setStatus: (...a: unknown[]) => mockSetQuestionStatus(...a),
    },
  };
});

import { GET as getSettings, POST as postSettings } from "@/app/api/admin/settings/route";
import { DELETE as deleteSetting, GET as getSetting } from "@/app/api/admin/settings/[key]/route";
import { GET as getAudit } from "@/app/api/admin/audit/route";
import { GET as getQuestions } from "@/app/api/admin/questions/route";
import { PATCH as patchQuestion } from "@/app/api/admin/questions/[id]/route";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { ModerationError } from "@/lib/administration/services/moderation.service";

const UUID = "00000000-0000-0000-0000-000000000001";
const ADMIN_SESSION = { userId: "a1", email: "admin@x.com" };

const SETTING_ROW = {
  id: UUID,
  key: "platform.maintenance_mode",
  value: false,
  description: "Modo manutenção",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const LOG_ROW = {
  id: UUID,
  adminId: UUID,
  action: "setting.update",
  entityType: "system_setting",
  entityId: UUID,
  details: { key: "platform.maintenance_mode" },
  ip: null,
  createdAt: new Date(),
};

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

function req(body: unknown, url = "http://localhost/api/admin") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API /api/admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN_SESSION);
    mockListSettings.mockResolvedValue([SETTING_ROW]);
    mockSetSetting.mockResolvedValue(SETTING_ROW);
    mockRemoveSetting.mockResolvedValue(SETTING_ROW);
    mockGetSetting.mockResolvedValue(false);
    mockAuditList.mockResolvedValue([LOG_ROW]);
    mockListQuestions.mockResolvedValue({ data: [], total: 0 });
    mockSetQuestionStatus.mockResolvedValue({ id: UUID, status: "publicada" });
  });

  it("retorna 401 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await getSettings();
    expect(res.status).toBe(401);
  });

  it("retorna 403 para não-admin (AdminError FORBIDDEN)", async () => {
    mockListSettings.mockRejectedValue(
      new AdminError("FORBIDDEN", "Acesso restrito a administradores.")
    );
    const res = await getSettings();
    expect(res.status).toBe(403);
  });

  it("settings GET lista configurações (200)", async () => {
    const res = await getSettings();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ key: string }> };
    expect(json.data[0].key).toBe("platform.maintenance_mode");
  });

  it("settings POST cria configuração (200)", async () => {
    const res = await postSettings(
      req({ key: "ia.default_model", value: "flash" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { key: string };
    expect(json.key).toBe("platform.maintenance_mode");
  });

  it("settings POST rejeita corpo inválido (400)", async () => {
    const res = await postSettings(req({ key: "", value: 1 }));
    expect(res.status).toBe(400);
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it("settings [key] GET retorna valor (200)", async () => {
    const res = await getSetting(new NextRequest("http://localhost/api/admin/settings/x"), ctx({ key: "platform.maintenance_mode" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { value: boolean };
    expect(json.value).toBe(false);
  });

  it("settings [key] DELETE remove (200)", async () => {
    const res = await deleteSetting(
      new NextRequest("http://localhost/api/admin/settings/x"),
      ctx({ key: "platform.maintenance_mode" })
    );
    expect(res.status).toBe(200);
  });

  it("settings [key] DELETE retorna 404 quando ausente", async () => {
    mockRemoveSetting.mockResolvedValue(null);
    const res = await deleteSetting(
      new NextRequest("http://localhost/api/admin/settings/x"),
      ctx({ key: "nao.existe" })
    );
    expect(res.status).toBe(404);
  });

  it("audit GET lista auditoria (200)", async () => {
    const res = await getAudit(new NextRequest("http://localhost/api/admin/audit"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ action: string }> };
    expect(json.data[0].action).toBe("setting.update");
  });

  it("questions GET lista para curadoria (200)", async () => {
    const res = await getQuestions(new NextRequest("http://localhost/api/admin/questions"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[]; total: number };
    expect(json.total).toBe(0);
  });

  it("questions [id] PATCH altera status (200)", async () => {
    const res = await patchQuestion(
      req({ status: "publicada" }),
      ctx({ id: UUID })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("publicada");
  });

  it("questions [id] PATCH retorna 404 quando questão não existe", async () => {
    mockSetQuestionStatus.mockRejectedValue(
      new ModerationError("QUESTION_NOT_FOUND", "Questão não encontrada.")
    );
    const res = await patchQuestion(req({ status: "publicada" }), ctx({ id: UUID }));
    expect(res.status).toBe(404);
  });

  it("questions [id] PATCH rejeita status inválido (400)", async () => {
    const res = await patchQuestion(req({ status: "lixo" }), ctx({ id: UUID }));
    expect(res.status).toBe(400);
  });
});
