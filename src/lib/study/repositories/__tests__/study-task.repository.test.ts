/**
 * Testes do StudyTaskRepository.replacePendingPlan — substituição atômica
 * do plano de tarefas auto-geradas:
 *  - roda dentro de UMA transação (rollback se a inserção falhar);
 *  - remove apenas tarefas PENDENTES do usuário com a assinatura do planner
 *    (title "Estudar %") — preserva CONCLUÍDAS e de outros usuários;
 *  - insere as novas tarefas e retorna as linhas inseridas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTransaction = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

import { StudyTaskRepository } from "../study-task.repository";
import { studyTasks } from "@/db/schema/study";

/** Renderiza uma condição Drizzle (SQL) para texto, para inspecionar o filtro. */
function renderSql(cond: unknown): string {
  if (cond == null) return "";
  if (typeof cond === "string") return cond;
  const c = cond as {
    queryChunks?: unknown[];
    value?: unknown;
    isStream?: boolean;
    table?: { name?: string };
    name?: string;
  };
  if (Array.isArray(c.queryChunks)) return c.queryChunks.map(renderSql).join("");
  // Param do Drizzle: { value, isStream, encoder }
  if ("isStream" in (cond as object) && "value" in (cond as object)) {
    return String(c.value);
  }
  // StringChunk interno do Drizzle: { value, getSQL }
  if (typeof c.value === "string" && !Array.isArray(c.queryChunks)) {
    return c.value;
  }
  // Column do Drizzle: { table, name }
  if (c.table && c.name) return `"${c.table.name ?? c.table}"."${c.name}"`;
  return String(cond);
}

beforeEach(() => {
  vi.clearAllMocks();

  // A "transação" mockada repassa o tx para o callback — igual ao Drizzle real.
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const tx = { delete: mockDelete, insert: mockInsert };
    return cb(tx);
  });
});

describe("StudyTaskRepository.replacePendingPlan", () => {
  it("remove pendentes do usuário e insere as novas dentro de uma transação", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: whereMock });
    const insertedRows = [{ id: "t1" }, { id: "t2" }];
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(insertedRows),
    });
    mockInsert.mockReturnValue({ values: valuesMock });

    const inputs = [
      { userId: "u1", title: "Estudar Português", scheduledDate: new Date(), durationMin: 30, status: "pendente" as const },
      { userId: "u1", title: "Estudar Matemática", scheduledDate: new Date(), durationMin: 30, status: "pendente" as const },
    ];

    const result = await StudyTaskRepository.replacePendingPlan("u1", inputs);

    // 1) Atômico: tudo dentro de db.transaction
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // 2) DELETE escopado ao usuário: só pendentes + assinatura do planner
    expect(mockDelete).toHaveBeenCalledWith(studyTasks);
    expect(whereMock).toHaveBeenCalledTimes(1);
    const sqlText = renderSql(whereMock.mock.calls[0]![0]);
    expect(sqlText).toContain("user_id");
    expect(sqlText).toContain("u1");
    expect(sqlText).toContain("status");
    expect(sqlText).toContain("pendente");
    expect(sqlText).toContain("title");
    expect(sqlText).toContain("Estudar %");
    expect(sqlText).toContain("deleted_at");

    // 3) INSERT das novas tarefas e retorno das linhas
    expect(mockInsert).toHaveBeenCalledWith(studyTasks);
    expect(valuesMock).toHaveBeenCalledWith(inputs);
    expect(result).toEqual(insertedRows);
  });

  it("não chama insert quando não há novas tarefas (apenas limpa pendentes)", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const result = await StudyTaskRepository.replacePendingPlan("u1", []);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("reverte a transação (rollback) se a inserção falhar — cronograma não fica vazio", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error("db error")),
      }),
    });

    await expect(
      StudyTaskRepository.replacePendingPlan("u1", [
        { userId: "u1", title: "Estudar Português", scheduledDate: new Date(), durationMin: 30, status: "pendente" as const },
      ])
    ).rejects.toThrow("db error");

    // DELETE e INSERT aconteceram DENTRO da mesma transação (o erro propaga).
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
