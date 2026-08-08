/**
 * MIAR ÁRIA — System Handler
 * Executa comandos no shell nativo do sistema com timeout e captura de output.
 * Funciona bem em Windows, Linux e macOS.
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const CMD_TIMEOUT_MS = 120000;

function getShellConfig(command) {
  const normalized = command.trim();

  if (process.platform === 'win32') {
    const wrapped = `try { ${normalized} } catch { Write-Output \"ERRO_PS: $_\" }`;
    return {
      executable: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', wrapped],
      label: 'PowerShell',
    };
  }

  if (process.platform === 'darwin') {
    return {
      executable: '/bin/zsh',
      args: ['-lc', normalized],
      label: 'zsh',
    };
  }

  return {
    executable: '/bin/bash',
    args: ['-lc', normalized],
    label: 'bash',
  };
}

function executeShell(command, shellConfig) {
  return new Promise((resolve) => {
    const child = spawn(shellConfig.executable, shellConfig.args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve({ ok: false, stdout: stdout.trim(), stderr: 'Timeout após 120s.', exitCode: -1, command });
    }, CMD_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        command,
      });
    });

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: '', stderr: `${shellConfig.label} indisponível: ${e.message}`, exitCode: -1, command });
    });
  });
}

function runPowerShell(command) {
  return executeShell(command, getShellConfig(command));
}

function runCmd(command) {
  const shellConfig = process.platform === 'win32'
    ? { executable: 'cmd.exe', args: ['/c', command], label: 'cmd.exe' }
    : { executable: '/bin/bash', args: ['-lc', command], label: 'bash' };
  return executeShell(command, shellConfig);
}

async function runCommand(command) {
  if (!command || !command.trim()) {
    return { ok: false, stdout: '', stderr: 'Comando vazio.', exitCode: -1 };
  }
  const cmd = command.trim();
  return runPowerShell(cmd);
}

function getSystemInfo() {
  try {
    const appDir = path.dirname(path.dirname(__filename));
    const electronDir = path.join(appDir, 'electron');
    const srcDir = path.join(appDir, 'src');

    return {
      os: `Sistema ${os.platform()} ${os.release()}`,
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      homeDir: os.homedir(),
      tempDir: os.tmpdir(),
      totalMemGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
      freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(1),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'desconhecido',
      platform: os.platform(),
      uptime: Math.round(os.uptime() / 3600) + 'h',
      appDir,
      electronDir,
      srcDir,
      selfFiles: {
        aiHandler: path.join(electronDir, 'ai-handler.js'),
        mainHandler: path.join(electronDir, 'main.js'),
        memoryHandler: path.join(electronDir, 'memory-handler.js'),
        systemHandler: path.join(electronDir, 'system-handler.js'),
        storageHandler: path.join(electronDir, 'storage-handler.js'),
        fileHandler: path.join(electronDir, 'file-handler.js'),
        renderer: path.join(srcDir, 'renderer.js'),
        styles: path.join(srcDir, 'styles.css'),
        html: path.join(srcDir, 'index.html'),
      },
    };
  } catch {
    return {};
  }
}

module.exports = { runCommand, runPowerShell, runCmd, getSystemInfo };
