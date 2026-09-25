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

const SOURCE =
  join(
    ROOT,
    'installer-windows-web',
  );

const PAYLOAD =
  join(
    SOURCE,
    'payload',
  );

const PAYLOAD_ROOT =
  join(
    PAYLOAD,
    'root',
  );

const OUTPUT =
  join(
    ROOT,
    '.runtime',
    'windows-web-installer',
  );

const SETUP =
  join(
    OUTPUT,
    'Layer Export Helper Web Setup.exe',
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
  PAYLOAD_ROOT,
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
  'Cross-build Windows launcher…',
);

execFileSync(
  'go',
  [
    'build',
    '-trimpath',
    '-ldflags=-s -w -H=windowsgui',
    '-o',
    join(
      PAYLOAD_ROOT,
      'LayerExportLauncher.exe',
    ),
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

await mkdir(
  join(
    PAYLOAD_ROOT,
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
      PAYLOAD_ROOT,
      'converter',
      name,
    ),
  );
}

await cp(
  join(
    ROOT,
    'package.json',
  ),
  join(
    PAYLOAD_ROOT,
    'package.json',
  ),
);

await cp(
  join(
    ROOT,
    'package-lock.json',
  ),
  join(
    PAYLOAD_ROOT,
    'package-lock.json',
  ),
);

await mkdir(
  join(
    PAYLOAD_ROOT,
    '.runtime',
    'profiles',
  ),
  {
    recursive:
      true,
  },
);

await cp(
  join(
    ROOT,
    '.runtime',
    'profiles',
    'default_cmyk.icc',
  ),

  join(
    PAYLOAD_ROOT,
    '.runtime',
    'profiles',
    'default_cmyk.icc',
  ),
);

console.log(
  'Сжатие минимального runtime…',
);

execFileSync(
  'zip',
  [
    '-qry',
    '-9',
    join(
      PAYLOAD,
      'runtime.zip',
    ),
    '.',
  ],
  {
    cwd:
      PAYLOAD_ROOT,

    stdio:
      'inherit',
  },
);

await rm(
  PAYLOAD_ROOT,
  {
    recursive:
      true,
    force:
      true,
  },
);

console.log(
  'Cross-build Web Setup.exe…',
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
console.log('WINDOWS WEB INSTALLER READY');
console.log('==========================================');
console.log(`Setup: ${SETUP}`);
