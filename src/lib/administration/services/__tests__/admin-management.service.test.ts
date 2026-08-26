/**
 * Testes do AdminManagementService — gestão da allowlist de admins/superadmins.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByKey = vi.fn();
const mockUpsert = vi.fn();
const mockRecord = vi.fn();

vi.mock("../../repositories/system-setting.repository", () => ({
  SystemSettingRepository: {
    findByKey: (...args: unknown[]) => mockFindByKey(...args),
    list: vi.fn(),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    deleteByKey: vi.fn(),
  },
}));

vi.mock("../audit.service", () => ({
  AuditService: {
    record: (...args: unknown[]) => mockRecord(...args),
    list: vi.fn(),
  },
}));

import { AdminManagementService } from "../admin-management.service";

const superadmin = { userId: "u1", email: "root@x.com" };
const admin = { userId: "u2", email: "a@x.com" };

describe("AdminManagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPERADMIN_EMAILS;
    delete process.env.ADMIN_EMAILS;
    // Por padrão, o superadmin "root@x.com" está na allowlist de superadmins.
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "superadmin.emails") return { value: ["root@x.com"] };
      return null;
    });
    mockUpsert.mockImplementation(async (_key: string, value: unknown) => ({
      id: "s1",
      key: "admin.emails",
      value,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it("list exige superadmin", async () => {
    await expect(AdminManagementService.list(admin)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("list retorna admins e superadmins", async () => {
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "admin.emails") return { value: ["a@x.com"] };
      if (key === "superadmin.emails") return { value: ["root@x.com"] };
      return null;
    });
    const result = await AdminManagementService.list(superadmin);
    expect(result).toEqual({ admins: ["a@x.com"], superadmins: ["root@x.com"] });
  });

  it("addAdmin exige superadmin", async () => {
    await expect(
      AdminManagementService.addAdmin(admin, "novo@x.com")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("addAdmin adiciona e-mail e audita", async () => {
    const list = await AdminManagementService.addAdmin(
      superadmin,
      "novo@x.com"
    );
    expect(list).toContain("novo@x.com");
    expect(mockUpsert).toHaveBeenCalledWith(
      "admin.emails",
      ["novo@x.com"]
    );
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.add" })
    );
  });

  it("addAdmin rejeita e-mail inválido", async () => {
    await expect(
      AdminManagementService.addAdmin(superadmin, "invalido")
    ).rejects.toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("addAdmin rejeita e-mail duplicado", async () => {
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "superadmin.emails") return { value: ["root@x.com"] };
      if (key === "admin.emails") return { value: ["novo@x.com"] };
      return null;
    });
    await expect(
      AdminManagementService.addAdmin(superadmin, "novo@x.com")
    ).rejects.toMatchObject({ code: "ALREADY_ADMIN" });
  });

  it("removeAdmin remove e-mail e audita", async () => {
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "superadmin.emails") return { value: ["root@x.com"] };
      if (key === "admin.emails") return { value: ["a@x.com", "b@x.com"] };
      return null;
    });
    const list = await AdminManagementService.removeAdmin(superadmin, "a@x.com");
    expect(list).toEqual(["b@x.com"]);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.remove" })
    );
  });

  it("removeAdmin rejeita e-mail inexistente", async () => {
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "superadmin.emails") return { value: ["root@x.com"] };
      if (key === "admin.emails") return { value: ["a@x.com"] };
      return null;
    });
    await expect(
      AdminManagementService.removeAdmin(superadmin, "zz@x.com")
    ).rejects.toMatchObject({ code: "NOT_ADMIN" });
  });

  it("addSuperadmin adiciona e audita", async () => {
    const list = await AdminManagementService.addSuperadmin(
      superadmin,
      "root2@x.com"
    );
    expect(list).toContain("root2@x.com");
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "superadmin.add" })
    );
  });

  it("removeSuperadmin remove e audita", async () => {
    mockFindByKey.mockImplementation(async (key: string) => {
      if (key === "superadmin.emails") return { value: ["root@x.com", "root2@x.com"] };
      return null;
    });
    const list = await AdminManagementService.removeSuperadmin(
      superadmin,
      "root2@x.com"
    );
    expect(list).toEqual(["root@x.com"]);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "superadmin.remove" })
    );
  });

  it("assertNotSelf bloqueia remoção de si mesmo", async () => {
    await expect(
      AdminManagementService.assertNotSelf(superadmin, "root@x.com")
    ).rejects.toMatchObject({ code: "SELF_REMOVAL" });
  });

  it("assertNotSelf permite remoção de outro", async () => {
    await expect(
      AdminManagementService.assertNotSelf(superadmin, "outro@x.com")
    ).resolves.toBeUndefined();
  });
});
