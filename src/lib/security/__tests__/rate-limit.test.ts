/**
 * Testes do Rate Limiter in-memory (sliding window).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimitStore } from "../rate-limit";

describe("rateLimit (in-memory sliding window)", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("permite requisições dentro do limite", () => {
    const r1 = rateLimit("test", "key:1", 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit("test", "key:1", 3, 60_000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit("test", "key:1", 3, 60_000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("bloqueia quando o limite é excedido", () => {
    rateLimit("test", "key:1", 2, 60_000);
    rateLimit("test", "key:1", 2, 60_000);
    const r3 = rateLimit("test", "key:1", 2, 60_000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("chaves diferentes são independentes", () => {
    rateLimit("test", "key:a", 1, 60_000);
    const rB = rateLimit("test", "key:b", 1, 60_000);
    expect(rB.allowed).toBe(true);
  });

  it("buckets diferentes são independentes", () => {
    rateLimit("bucket-a", "key:1", 1, 60_000);
    const rB = rateLimit("bucket-b", "key:1", 1, 60_000);
    expect(rB.allowed).toBe(true);
  });

  it("janela expirada reinicia o contador", () => {
    // Janela de 0ms: a segunda chamada já encontra a janela expirada.
    const r1 = rateLimit("test", "key-expiry", 1, 0);
    expect(r1.allowed).toBe(true);
    const r2 = rateLimit("test", "key-expiry", 1, 0);
    expect(r2.allowed).toBe(true);
  });

  it("retorna resetAt futuro dentro da janela", () => {
    const r = rateLimit("test", "key:1", 5, 60_000);
    expect(r.resetAt).toBeGreaterThan(Date.now());
    expect(r.limit).toBe(5);
  });
});
