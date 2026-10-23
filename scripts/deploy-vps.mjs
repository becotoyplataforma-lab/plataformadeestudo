import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

console.log('🚀 Iniciando deploy do ConcursoAI para a VPS...');

export function resolveSshKeyPath() {
  const candidates = [
    process.env.VPS_SSH_KEY_PATH || '',
    'C:\\Users\\dev\\Downloads\\chave\\ssh-key-2026-05-27.key',
    'H:\\Meu Drive\\plataforma de estudo\\chave\\ssh-key-2026-05-27.key',
    path.join(process.env.USERPROFILE || '', 'Downloads', 'chave', 'ssh-key-2026-05-27.key'),
    path.join(process.env.USERPROFILE || '', '.ssh', 'ssh-key-2026-05-27.key'),
    path.join(process.env.USERPROFILE || '', 'Meu Drive', 'plataforma de estudo', 'chave', 'ssh-key-2026-05-27.key'),
  ];

  // Checar todas as letras de unidade montadas pelo Google Drive (D: até Z:)
  const driveLetters = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  for (const letter of driveLetters) {
    candidates.push(`${letter}:\\Meu Drive\\plataforma de estudo\\chave\\ssh-key-2026-05-27.key`);
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const keyPath = resolveSshKeyPath();
if (!keyPath) {
  console.error('❌ Chave SSH não encontrada nos caminhos padrão:');
  console.error('   - C:\\Users\\dev\\Downloads\\chave\\ssh-key-2026-05-27.key');
  console.error('   - H:\\Meu Drive\\plataforma de estudo\\chave\\ssh-key-2026-05-27.key');
  console.error('   - ~/.ssh/ssh-key-2026-05-27.key');
  console.error('   Defina a variável VPS_SSH_KEY_PATH com o caminho correto da chave.');
  process.exit(1);
}

console.log(`🔑 Chave SSH identificada: ${keyPath}`);

// 1. Git push
let pushUrl = 'origin';
try {
  const gitCredPath = path.join(process.env.USERPROFILE || 'C:\\Users\\dev', '.git-credentials');
  if (fs.existsSync(gitCredPath)) {
    const credContent = fs.readFileSync(gitCredPath, 'utf-8');
    const linha = credContent.split(/\r?\n/).find(l => l.includes('becotoyplataforma-lab') || l.includes('github.com'));
    if (linha) {
      const credPart = linha.replace('https://', '').replace('@github.com', '').trim();
      pushUrl = `https://${credPart}@github.com/becotoyplataforma-lab/plataformadeestudo.git`;
    }
  }
} catch {
  // Ignora se não achar .git-credentials, usará origin padrão
}

console.log('📦 Sincronizando com GitHub (git push origin main)...');
try {
  execSync(`git push "${pushUrl}" main`, {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 180000,
  });
  console.log('✅ Push concluído!');
} catch (err) {
  console.error('⚠️  Aviso no push:', err.message);
}

// 2. Comandos no VPS
console.log('🌐 Conectando à VPS 137.131.179.48 e executando deploy...');
const cmdVps = [
  'cd /opt/apps/plataformadeestudo',
  'git stash -u || true',
  'git fetch origin main',
  'git reset --hard origin/main',
  'cd /opt/apps/plataformadeestudo/infra',
  'chmod +x deploy.sh healthcheck.sh backup.sh',
  'RUN_MIGRATE=0 ./deploy.sh',
  'echo "=== CONTAINERS APÓS DEPLOY ==="',
  'docker ps',
  'echo "=== HEALTHCHECK LOCAL VPS ==="',
  'curl -fsS http://127.0.0.1:3001/api/health',
].join(' && ');

const sshArgs = [
  '-i', keyPath,
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=no',
  'ubuntu@137.131.179.48',
  cmdVps,
];

const proc = spawn('ssh', sshArgs, { stdio: 'inherit' });

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n🎉 ALL DEPLOY STEPS COMPLETED SUCCESSFULLY!');
    console.log('🌐 Produção: https://app.becotoy.com');
  } else {
    console.error(`\n❌ Deploy encerrou com código de erro: ${code}`);
    process.exit(code || 1);
  }
});
