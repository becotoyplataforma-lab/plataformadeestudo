/**
 * Testes do UsageService — custo, registro e verificação de limite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFind = vi.fn();
const mockIncrement = vi.fn();

vi.mock("../../repositories/usage.repository", () => ({
  UsageRepository: {
    findByUserAndDay: (...a: unknown[]) => mockFind(...a),
    increment: (...a: unknown[]) => mockIncrement(...a),
  },
}));

import { UsageService } from "../usage.service";

describe("UsageService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("estimateCost", () => {
    it("estima custo BRL positivo para flash", () => {
      const cost = UsageService.estimateCost("flash", 1_000_000, 1_000_000);
      expect(cost).toBeGreaterThan(0);
      // (0.27 + 1.1) USD * 5 = 6.85
      expect(cost).toBeCloseTo(6.85, 1);
    });

    it("estima custo BRL positivo para pro", () => {
      const cost = UsageService.estimateCost("pro", 1_000_000, 1_000_000);
      expect(cost).toBeGreaterThan(0);
      // (0.55 + 2.19) USD * 5 = 13.70
      expect(cost).toBeCloseTo(13.7, 1);
    });
  });

  describe("getToday", () => {
    it("retorna zeros quando não há uso", async () => {
      mockFind.mockResolvedValue(null);
      const status = await UsageService.getToday("u1");
      expect(status.messagesUsed).toBe(0);
      expect(status.totalTokens).toBe(0);
    });

    it("retorna uso existente", async () => {
      mockFind.mockResolvedValue({
        messagesCount: 3,
        tokensIn: 100,
        tokensOut: 50,
      });
      const status = await UsageService.getToday("u1");
      expect(status.messagesUsed).toBe(3);
      expect(status.totalTokens).toBe(150);
    });
  });

  describe("record", () => {
    it("incrementa com tokens válidos", async () => {
      mockIncrement.mockResolvedValue({});
      await UsageService.record("u1", 10, 20);
      expect(mockIncrement).toHaveBeenCalled();
    });

    it("lança INVALID_TOKENS para tokens negativos", async () => {
      await expect(UsageService.record("u1", -1, 0)).rejects.toMatchObject({
        code: "INVALID_TOKENS",
      });
    });
  });

  describe("checkLimit", () => {
    it("permite quando abaixo do limite", async () => {
      mockFind.mockResolvedValue({ messagesCount: 2, tokensIn: 100, tokensOut: 50 });
      const { canSend } = await UsageService.checkLimit("u1", {
        maxMessages: 10,
        maxTokens: 1000,
      });
      expect(canSend).toBe(true);
    });

    it("bloqueia quando atinge o limite de mensagens", async () => {
      mockFind.mockResolvedValue({ messagesCount: 10, tokensIn: 100, tokensOut: 50 });
      const { canSend } = await UsageService.checkLimit("u1", {
        maxMessages: 10,
        maxTokens: 1000,
      });
      expect(canSend).toBe(false);
    });
  });
});
