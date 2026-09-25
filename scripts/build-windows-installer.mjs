import {
  cp,
  mkdir,
  rm,
} from 'node:fs/promises';

import {
  execFileSync,
} from 'node:child_process';

import {
  dirname,
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

const ROOT =
  dirname(
    dirname(
      fileURLToPath(
        import.meta.url,
      ),
    ),
  );

const WINDOWS_BUILD =
  join(
    ROOT,
    '.runtime',
    'windows-build',
  );

const APP =
  join(
    WINDOWS_BUILD,
    'Layer Export',
  );

const GS =
  join(
    WINDOWS_BUILD,
    'third-party',
    'gs10080w64.exe',
  );

const SOURCE =
  join(
    ROOT,
    'installer-windows',
  );

const PAYLOAD =
  join(
    SOURCE,
    'payload',
  );

const OUTPUT =
  join(
    ROOT,
    '.runtime',
    'windows-installer',
  );

const RUNTIME_ZIP =
  join(
    PAYLOAD,
    'runtime.zip',
  );

const GS_PAYLOAD =
  join(
    PAYLOAD,
    'gs10080w64.exe',
  );

const SETUP =
  join(
    OUTPUT,
    'Layer Export Helper Setup.exe',
  );

console.log(
  'Подготовка payload Windows installer…',
);

await rm(
  PAYLOAD,
  {
    recursive:
      true,

    force:
      true,
  },
);

await rm(
  OUTPUT,
  {
    recursive:
      true,

    force:
      true,
  },
);

await mkdir(
  PAYLOAD,
  {
    recursive:
      true,
  },
);

await mkdir(
  OUTPUT,
  {
    recursive:
      true,
  },
);

console.log(
  'Сжатие Windows runtime…',
);

execFileSync(
  'zip',
  [
    '-qry',
    '-9',
    RUNTIME_ZIP,
    '.',
  ],
  {
    cwd:
      APP,

    stdio:
      'inherit',
  },
);

await cp(
  GS,
  GS_PAYLOAD,
);

console.log(
  'Cross-build Setup.exe…',
);

execFileSync(
  'go',
  [
    'build',
    '-trimpath',
    '-ldflags=-s -w -H=windowsgui',
    '-o',
    SETUP,
    'main.go',
  ],
  {
    cwd:
      SOURCE,

    stdio:
      'inherit',

    env: {
      ...process.env,

      GOOS:
        'windows',

      GOARCH:
        'amd64',

      CGO_ENABLED:
        '0',
    },
  },
);

/*
 * Embedded payload больше не нужен после go build:
 * он уже находится внутри Setup.exe.
 */
await rm(
  PAYLOAD,
  {
    recursive:
      true,

    force:
      true,
  },
);

console.log('');
console.log('==========================================');
console.log('WINDOWS INSTALLER READY');
console.log('==========================================');
console.log(`Setup: ${SETUP}`);
console.log('');
console.log('Установка: обычный двойной клик.');
console.log('Удаление: "Layer Export Helper Setup.exe" /uninstall');
