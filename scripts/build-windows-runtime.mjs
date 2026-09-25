import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  createHash,
} from 'node:crypto';

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

const BUILD_ROOT =
  join(
    ROOT,
    '.runtime',
    'windows-build',
  );

const APP =
  join(
    BUILD_ROOT,
    'Layer Export',
  );

const NODE_VERSION =
  '24.18.0';

const NODE_URL =
  `https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`;

const NODE_SHA256 =
  '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de';

const GS_VERSION =
  '10.08.0';

const GS_URL =
  'https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10080/gs10080w64.exe';

const GS_SHA256 =
  '52a91b8bf09298788d7a57b9206127026c23eacd75405f0a131e26dc381dce50';

async function downloadVerified(
  url,
  destination,
  expectedSha256,
) {
  console.log(
    `Скачивание: ${url}`,
  );

  const response =
    await fetch(
      url,
      {
        redirect:
          'follow',
      },
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`,
    );
  }

  const bytes =
    Buffer.from(
      await response.arrayBuffer(),
    );

  const actual =
    createHash(
      'sha256',
    )
      .update(
        bytes,
      )
      .digest(
        'hex',
      );

  if (
    actual !==
    expectedSha256
  ) {
    throw new Error(
      [
        'SHA256 не совпал.',
        `URL: ${url}`,
        `ожидался: ${expectedSha256}`,
        `получен: ${actual}`,
      ].join(
        '\n',
      ),
    );
  }

  await mkdir(
    dirname(
      destination,
    ),
    {
      recursive:
        true,
    },
  );

  await writeFile(
    destination,
    bytes,
  );

  console.log(
    `OK SHA256: ${destination}`,
  );
}

console.log(
  'Очистка Windows build directory…',
);

await rm(
  BUILD_ROOT,
  {
    recursive:
      true,

    force:
      true,
  },
);

await mkdir(
  APP,
  {
    recursive:
      true,
  },
);

/*
 * 1. Converter source.
 * Копируем только рабочие runtime-файлы,
 * без backup / before-* вариантов.
 */
await mkdir(
  join(
    APP,
    'converter',
  ),
  {
    recursive:
      true,
  },
);

for (
  const name
  of [
    'convert.mjs',
    'profiles.mjs',
    'runtime.mjs',
    'server.mjs',
  ]
) {
  await cp(
    join(
      ROOT,
      'converter',
      name,
    ),

    join(
      APP,
      'converter',
      name,
    ),
  );
}

/*
 * 2. package.json + lock.
 * npm ci ниже ставит только production dependencies.
 */
await cp(
  join(
    ROOT,
    'package.json',
  ),

  join(
    APP,
    'package.json',
  ),
);

await cp(
  join(
    ROOT,
    'package-lock.json',
  ),

  join(
    APP,
    'package-lock.json',
  ),
);

console.log(
  'Установка production node_modules для Windows runtime…',
);

execFileSync(
  'npm',
  [
    'ci',
    '--omit=dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ],
  {
    cwd:
      APP,

    stdio:
      'inherit',

    env: {
      ...process.env,

      npm_config_os:
        'win32',

      npm_config_cpu:
        'x64',

      npm_config_platform:
        'win32',

      npm_config_arch:
        'x64',
    },
  },
);

/*
 * 3. Собственный Node.exe.
 */
const nodeExe =
  join(
    APP,
    'runtime',
    'node',
    'node.exe',
  );

await downloadVerified(
  NODE_URL,
  nodeExe,
  NODE_SHA256,
);

/*
 * 4. Профиль CMYK.
 */
const sourceProfile =
  join(
    ROOT,
    '.runtime',
    'profiles',
    'default_cmyk.icc',
  );

const targetProfile =
  join(
    APP,
    '.runtime',
    'profiles',
    'default_cmyk.icc',
  );

await mkdir(
  dirname(
    targetProfile,
  ),
  {
    recursive:
      true,
  },
);

await cp(
  sourceProfile,
  targetProfile,
);

/*
 * 5. Windows Go launcher.
 * windowsgui = без консольного окна.
 */
const launcherExe =
  join(
    APP,
    'LayerExportLauncher.exe',
  );

console.log(
  'Cross-build LayerExportLauncher.exe…',
);

execFileSync(
  'go',
  [
    'build',
    '-trimpath',
    '-ldflags=-s -w -H=windowsgui',
    '-o',
    launcherExe,
    '.',
  ],
  {
    cwd:
      join(
        ROOT,
        'launcher-go',
      ),

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
 * 6. Ghostscript installer.
 * Позже наш Setup.exe запустит его при установке.
 */
const gsInstaller =
  join(
    BUILD_ROOT,
    'third-party',
    'gs10080w64.exe',
  );

await downloadVerified(
  GS_URL,
  gsInstaller,
  GS_SHA256,
);

/*
 * 7. Template для Windows installer.
 * Реальный launcher.conf установщик запишет
 * с абсолютными Windows-путями.
 */
await writeFile(
  join(
    APP,
    'launcher.conf.template',
  ),

  [
    'node-path=<INSTALL_DIR>\\runtime\\node\\node.exe',
    'server-path=<INSTALL_DIR>\\converter\\server.mjs',
    'work-dir=<INSTALL_DIR>',
    '',
  ].join(
    '\r\n',
  ),

  'utf8',
);

/*
 * 8. Build metadata.
 */
await writeFile(
  join(
    BUILD_ROOT,
    'build-info.json',
  ),

  JSON.stringify(
    {
      platform:
        'windows',

      arch:
        'x64',

      node:
        NODE_VERSION,

      ghostscript:
        GS_VERSION,

      launcher:
        'LayerExportLauncher.exe',
    },
    null,
    2,
  ) + '\n',

  'utf8',
);

const packageJson =
  JSON.parse(
    await readFile(
      join(
        APP,
        'package.json',
      ),
      'utf8',
    ),
  );

/*
 * Dev deps уже физически отсутствуют.
 * Убираем их и из конечного package.json,
 * чтобы runtime был самодостаточным и понятным.
 */
delete packageJson.devDependencies;
delete packageJson.scripts;

await writeFile(
  join(
    APP,
    'package.json',
  ),

  JSON.stringify(
    packageJson,
    null,
    2,
  ) + '\n',

  'utf8',
);

console.log('');
console.log('==========================================');
console.log('WINDOWS RUNTIME READY');
console.log('==========================================');
console.log(`App: ${APP}`);
console.log(`Launcher: ${launcherExe}`);
console.log(`Node: ${nodeExe}`);
console.log(`Ghostscript installer: ${gsInstaller}`);
console.log('');
console.log('Следующий этап: собрать единый Setup.exe.');
