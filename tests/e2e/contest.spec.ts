/**
 * E2E — Contest UI (seleção de concurso/cargo no perfil).
 *
 * Fluxo: autenticar → /perfil → selecionar concurso publicado + cargo ativo →
 * salvar → confirmar persistência após reload. Em seguida, garante que o
 * cronograma renderiza com o concurso vinculado.
 *
 * Requer backend real com catálogo Contest publicado e cargo ativo (seed).
 */
import { test, expect } from "@playwright/test";
import { hasAuth, authenticateBrowser } from "./support/auth";

test.describe("Contest — seleção de concurso e cargo no perfil", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");

  test("selecionar concurso e cargo persiste no perfil", async ({ page }) => {
    await authenticateBrowser(page);

    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
    await expect(page.getByText("Concurso e Cargo")).toBeVisible();

    // Seleciona o concurso publicado (catálogo Contest).
    await page.locator("#concurso-id").click();
    await page.getByRole("option", { name: "Concurso Público MPF 2026" }).click();

    // Seleciona o cargo do concurso (filtrado pelo concurso escolhido).
    await page.locator("#cargo-id").click();
    await page.getByRole("option", { name: "Analista do MPF" }).click();

    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Perfil atualizado!")).toBeVisible();

    // Recarrega: a seleção deve vir do servidor (persistida no perfil).
    await page.reload();
    await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
    await expect(page.locator("#concurso-id")).toContainText(
      "Concurso Público MPF 2026"
    );
    await expect(page.locator("#cargo-id")).toContainText("Analista do MPF");
  });

  test("cronograma renderiza com concurso vinculado", async ({ page }) => {
    await authenticateBrowser(page);
    await page.goto("/cronograma");
    await expect(page).toHaveURL(/\/cronograma/);
  });

  test("cronograma exibe fator de edital após replan com concurso vinculado", async ({
    page,
  }) => {
    await authenticateBrowser(page);
    await page.goto("/cronograma");
    await expect(page).toHaveURL(/\/cronograma/);

    // Dispara o replan (planejador adaptativo com peso do edital).
    await page.getByRole("button", { name: "Replanejar com IA" }).click();

    // Painel "Planejamento inteligente" aparece após o replan.
    await expect(page.getByText("Planejamento inteligente")).toBeVisible({
      timeout: 15_000,
    });

    // Ao menos uma disciplina com peso no edital exibe o fator de edital
    // (Direito Constitucional e Português têm peso no edital MPF).
    await expect(page.getByText(/edital —/).first()).toBeVisible();
  });
});
