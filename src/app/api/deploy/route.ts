import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const rootDir = process.cwd();
  const relatorio: Record<string, any> = {
    inicio: new Date().toISOString(),
  };

  // 1. Verifica se ainda há conflitos pendentes no git
  try {
    const diffCheck = execSync("git diff --check", { cwd: rootDir, encoding: "utf-8" });
    relatorio.conflitos = diffCheck ? diffCheck : "nenhum_conflito";
  } catch (e: any) {
    relatorio.conflitosErro = e.stdout || e.message;
  }

  // 2. Token de push
  let pushUrl = "";
  try {
    const gitCredPath = path.join(process.env.USERPROFILE || "C:\\Users\\dev", ".git-credentials");
    const credContent = fs.readFileSync(gitCredPath, "utf-8");
    const linha = credContent.split(/\r?\n/).find((l) => l.includes("becotoyplataforma-lab"));
    if (linha) {
      const credPart = linha.replace("https://", "").replace("@github.com", "").trim();
      pushUrl = `https://${credPart}@github.com/becotoyplataforma-lab/plataformadeestudo.git`;
    }
  } catch (e: any) {
    relatorio.credErro = e.message;
  }

  // 3. Commit e Push
  const targetUrl = pushUrl || "origin";
  try {
    execSync("git add -A", { cwd: rootDir, encoding: "utf-8" });
    try {
      execSync('git commit -m "feat(apostilas): acervo adaptado completo aulas 01-13 com leitor web e download em pdf"', {
        cwd: rootDir,
        encoding: "utf-8",
      });
    } catch (_) {}

    console.log("[deploy] Pushing para o GitHub...");
    relatorio.gitPush = execSync(`git push "${targetUrl}" main`, {
      cwd: rootDir,
      encoding: "utf-8",
      timeout: 180000,
    });
    relatorio.gitPushSucesso = true;
  } catch (e: any) {
    relatorio.gitPushErro = e.message;
    relatorio.gitPushStderr = e.stderr?.toString();
  }

  // 4. Se o push deu certo, executa na VPS
  if (relatorio.gitPushSucesso) {
    const keyToUse = "C:\\Users\\dev\\Downloads\\chave\\ssh-key-2026-05-27.key";
    try {
      console.log("[deploy] Conectando na VPS para deploy...");
      const cmdVps = [
        "cd /opt/apps/plataformadeestudo",
        "git stash -u || true",
        "git fetch origin main",
        "git reset --hard origin/main",
        "cd /opt/apps/plataformadeestudo/infra",
        "chmod +x deploy.sh healthcheck.sh backup.sh",
        "RUN_MIGRATE=0 ./deploy.sh",
        "echo '=== CONTAINERS APÓS DEPLOY ==='",
        "docker ps",
        "echo '=== HEALTHCHECK LOCAL VPS ==='",
        "curl -fsS http://127.0.0.1:3001/api/health",
      ].join(" && ");

      const vpsOutput = execSync(
        `ssh -i "${keyToUse}" -o BatchMode=yes -o StrictHostKeyChecking=no ubuntu@137.131.179.48 "${cmdVps}"`,
        {
          encoding: "utf-8",
          timeout: 600000,
        }
      );

      relatorio.vpsDeploySucesso = true;
      relatorio.vpsOutput = vpsOutput;
    } catch (e: any) {
      relatorio.vpsDeployErro = e.message;
      relatorio.vpsDeployStderr = e.stderr?.toString();
    }
  }

  relatorio.fim = new Date().toISOString();

  const outPath = path.join(rootDir, "public", "deploy-execucao-5.json");
  fs.writeFileSync(outPath, JSON.stringify(relatorio, null, 2), "utf-8");

  return NextResponse.json(relatorio);
}
