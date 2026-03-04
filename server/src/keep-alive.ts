import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

const SCRIPT = join(__dirname, 'server-standalone.ts');
const TSCONFIG = join(__dirname, '..', 'tsconfig.server.json');
let restartCount = 0;
let child: ChildProcess | null = null;

function startServer() {
  restartCount++;
  const ts = new Date().toISOString();
  console.log(`[KeepAlive] Starting server (attempt #${restartCount}) at ${ts}`);

  child = spawn('npx', ['ts-node', '--project', TSCONFIG, SCRIPT], {
    stdio: 'inherit',
    shell: true,
    cwd: join(__dirname, '..'),
  });

  child.on('exit', (code, signal) => {
    console.error(`[KeepAlive] Server exited (code=${code}, signal=${signal}) at ${new Date().toISOString()}`);
    console.log(`[KeepAlive] Restarting in 3 seconds...`);
    setTimeout(startServer, 3000);
  });
}

process.on('SIGTERM', () => {
  console.log('[KeepAlive] SIGTERM received, stopping child...');
  if (child) child.kill('SIGTERM');
  process.exit(0);
});

startServer();
