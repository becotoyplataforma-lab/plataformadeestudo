import { chromium, request } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots-telas";
mkdirSync(OUT, { recursive: true });

const STUDENT = {
  email: "planner-teste-1786482952128@test.local",
  password: "PlannerE2e2026!",
};
const ADMIN = {
  email: "layout-teste-1786807761277@test.local",
  password: "ConcursoAI-NxAHmGGB-iugKdo1",
};

const SUBJECT_ID = "aaaaaaaa-0000-4000-8000-000000000001"; // Português (reservado p/ upload)
const LESSON_ID = "aaaaaaaa-0000-4000-8000-000000000301"; // aula de teste criada

void SUBJECT_ID;

async function loginState(email, password) {
  const ctx = await request.newContext({ baseURL: BASE });
  const csrf = await (await ctx.get("/api/auth/csrf")).json();
  const res = await ctx.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email, password },
  });
  if (!res.ok()) throw new Error(`Login falhou (${email}): ${res.status()}`);
  const state = await ctx.storageState();
  await ctx.dispose();
  return state;
}

function safeName(route) {
  const clean = route.replace(/^\/+/, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "raiz";
}

async function openTabs(context, routes, prefix) {
  const results = [];
  for (const route of routes) {
    const page = await context.newPage();
    let status = null;
    let error = null;
    try {
      const resp = await page.goto(BASE + route, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      status = resp ? resp.status() : null;
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${prefix}-${safeName(route)}.png` });
    } catch (e) {
      error = e.message.split("\n")[0];
      try {
        await page.screenshot({ path: `${OUT}/${prefix}-${safeName(route)}.png` });
      } catch {
        /* ignore */
      }
    }
    results.push({ route, status, error });
    await page.waitForTimeout(600); // dá fôlego ao dev server (cold compile)
  }
  return results;
}

const browser = await chromium.launch({ headless: false });

const studentState = await loginState(STUDENT.email, STUDENT.password);
const adminState = await loginState(ADMIN.email, ADMIN.password);

// Reusa um documento já indexado (criado em tentativa anterior) — sem re-upload,
// que pode estourar timeout em cold compile.
const doc = { id: process.env.DOC_ID ?? "a6316749-8c0f-4d64-a5b1-84a8ad29d013", status: "chunked" };
console.log("DOC_TESTE:", JSON.stringify(doc));

const studentCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await studentCtx.addCookies(studentState.cookies);

const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await adminCtx.addCookies(adminState.cookies);

const studentRoutes = [
  "/dashboard",
  "/apostilas",
  `/apostilas/${doc.id}`,
  `/aulas/${LESSON_ID}`,
  "/questoes",
  "/flashcards",
  "/professor",
  "/cronograma",
  "/analises",
  "/sessao",
  "/perfil",
  "/configuracoes",
];

const adminRoutes = [
  "/admin",
  "/admin/alunos",
  "/admin/concursos",
  "/admin/apostilas",
  "/admin/apostilas/revisao",
  "/admin/questoes",
  "/admin/questoes/importar",
  "/admin/aulas",
  "/admin/avatares",
  "/admin/ia",
  "/admin/materias",
  "/admin/fontes",
  "/admin/editais/importar",
];

const aluno = await openTabs(studentCtx, studentRoutes, "aluno");
const admin = await openTabs(adminCtx, adminRoutes, "admin");

console.log("ALUNO_RESULTADOS:", JSON.stringify(aluno, null, 0));
console.log("ADMIN_RESULTADOS:", JSON.stringify(admin, null, 0));
console.log("TOTAL_ABAS:", aluno.length + admin.length);

console.log("BROWSER_ABERTO — deixando o navegador vivo para navegação manual.");
await new Promise(() => {}); // mantém o processo (e o navegador) vivos
