const { spawn } = require('child_process');
const path = require('path');

const electronBin = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const desktopDir = path.resolve(__dirname, '..', 'packages', 'desktop');

const child = spawn(electronBin, ['.'], {
  cwd: desktopDir,
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
