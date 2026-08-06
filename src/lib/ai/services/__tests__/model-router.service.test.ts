/**
 * Testes do ModelRouterService (roteamento flash/pro).
 */
import { describe, it, expect } from "vitest";
import { ModelRouterService, ModelRouterError } from "../model-router.service";

describe("ModelRouterService", () => {
  it("usa flash por padrão", () => {
    expect(ModelRouterService.route()).toBe("flash");
  });

  it("respeita modelo explícito", () => {
    expect(ModelRouterService.route({ requested: "pro" })).toBe("pro");
    expect(ModelRouterService.route({ requested: "flash" })).toBe("flash");
  });

  it("promove para pro quando complexo", () => {
    expect(ModelRouterService.route({ isComplex: true })).toBe("pro");
  });

  it("lança INVALID_MODEL para modelo desconhecido", () => {
    expect(() =>
      ModelRouterService.route({ requested: "turbo" as never })
    ).toThrow(ModelRouterError);
  });
});
