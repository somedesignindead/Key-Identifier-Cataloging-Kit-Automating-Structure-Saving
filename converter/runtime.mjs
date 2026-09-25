import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const run = promisify(execFile);

process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(ROOT, '.runtime/browsers');

async function usableFile(path) {
  if (!path) return false;

  try {
    await access(
      path,
      process.platform === 'win32'
        ? constants.F_OK
        : constants.X_OK,
    );

    return true;
  } catch {
    return false;
  }
}

async function windowsGhostscriptCandidates() {
  if (process.platform !== 'win32') {
    return [];
  }

  const result = [];

  const roots = Array.from(
    new Set(
      [
        process.env.ProgramW6432,
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
      ].filter(Boolean),
    ),
  );

  for (const root of roots) {
    const gsRoot = join(root, 'gs');

    try {
      const entries = await readdir(
        gsRoot,
        {
          withFileTypes: true,
        },
      );

      const versions = entries
        .filter(
          entry =>
            entry.isDirectory() &&
            /^gs/i.test(entry.name),
        )
        .map(entry => entry.name)
        .sort()
        .reverse();

      for (const version of versions) {
        result.push(
          join(
            gsRoot,
            version,
            'bin',
            'gswin64c.exe',
          ),
        );
      }
    } catch {
      // Ghostscript is not installed in this Program Files root.
    }
  }

  return result;
}

export async function ghostscriptPath() {
  const windowsCandidates =
    await windowsGhostscriptCandidates();

  const candidates = [
    process.env.GS_BIN,

    process.platform === 'win32'
      ? join(
          ROOT,
          '.runtime',
          'ghostscript',
          'bin',
          'gswin64c.exe',
        )
      : join(
          ROOT,
          '.runtime',
          'ghostscript',
          'bin',
          'gs',
        ),

    ...windowsCandidates,

    '/opt/homebrew/bin/gs',
    '/usr/local/bin/gs',
    '/usr/bin/gs',
  ];

  for (const candidate of candidates.filter(Boolean)) {
    if (await usableFile(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    process.platform === 'win32'
      ? 'Ghostscript не найден. Установите 64-битный Ghostscript для Windows.'
      : 'Ghostscript не установлен. Выполните npm run setup:gs в папке проекта.',
  );
}

function windowsBrowserCandidates() {
  if (process.platform !== 'win32') {
    return [];
  }

  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  const result = [];

  for (const root of roots) {
    result.push(
      join(
        root,
        'Microsoft',
        'Edge',
        'Application',
        'msedge.exe',
      ),
    );

    result.push(
      join(
        root,
        'Google',
        'Chrome',
        'Application',
        'chrome.exe',
      ),
    );
  }

  return result;
}

async function bundledBrowserAvailable() {
  const { chromium } =
    await import('playwright');

  try {
    if (
      await usableFile(
        chromium.executablePath(),
      )
    ) {
      return true;
    }
  } catch {
    // Try headless shell below.
  }

  try {
    return (
      await readdir(
        process.env.PLAYWRIGHT_BROWSERS_PATH,
      )
    ).some(
      name =>
        name.startsWith(
          'chromium_headless_shell-',
        ),
    );
  } catch {
    return false;
  }
}

export async function browserExecutablePath() {
  /*
   * Если Playwright browser уже лежит рядом с Helper,
   * ничего не переопределяем — chromium.launch()
   * использует штатный runtime.
   */
  if (await bundledBrowserAvailable()) {
    return null;
  }

  for (
    const candidate
    of windowsBrowserCandidates()
  ) {
    if (await usableFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function browserAvailable() {
  if (await bundledBrowserAvailable()) {
    return true;
  }

  return (
    await browserExecutablePath()
  ) !== null;
}
