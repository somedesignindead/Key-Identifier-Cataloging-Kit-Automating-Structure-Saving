import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

if (process.platform !== 'darwin') {
  throw new Error('Layer Export Helper сейчас собирается только на macOS.');
}

const buildDir = join(ROOT, '.runtime', 'helper-build');
const app = join(buildDir, 'Layer Export Helper.app');
const contents = join(app, 'Contents');
const macOS = join(contents, 'MacOS');
const resources = join(contents, 'Resources');
const executable = join(macOS, 'LayerExportHelper');
const zip = join(buildDir, 'Layer Export Helper.zip');

const windowsSetup = join(
  ROOT,
  '.runtime',
  'windows-web-installer',
  'Layer Export Helper Web Setup.exe',
);

const generated = join(ROOT, 'src', 'ui', 'helper-package.generated.ts');

await rm(buildDir, { recursive: true, force: true });
await Promise.all([
  mkdir(macOS, { recursive: true }),
  mkdir(resources, { recursive: true }),
]);

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Layer Export Helper</string>
  <key>CFBundleDisplayName</key>
  <string>Layer Export Helper</string>
  <key>CFBundleIdentifier</key>
  <string>com.layerexport.helper</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>LayerExportHelper</string>
  <key>LSUIElement</key>
  <true/>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>Layer Export Helper</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>layerexport</string>
      </array>
    </dict>
  </array>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;

await writeFile(join(contents, 'Info.plist'), plist, 'utf8');
await writeFile(join(resources, 'project-root.txt'), `${ROOT}\n`, 'utf8');
await writeFile(join(resources, 'node-path.txt'), `${process.execPath}\n`, 'utf8');

try {
  execFileSync(
    '/usr/bin/xcrun',
    [
      'swiftc',
      join(ROOT, 'helper-macos', 'main.swift'),
      '-O',
      '-framework',
      'AppKit',
      '-o',
      executable,
    ],
    { stdio: 'inherit' },
  );
} catch {
  throw new Error(
    'Не удалось собрать Helper. Установите Command Line Tools командой: xcode-select --install',
  );
}

execFileSync('/usr/bin/codesign', [
  '--force',
  '--deep',
  '--sign',
  '-',
  app,
], { stdio: 'inherit' });

execFileSync('/usr/bin/ditto', [
  '-c',
  '-k',
  '--sequesterRsrc',
  '--keepParent',
  app,
  zip,
], { stdio: 'inherit' });

const bytes = await readFile(zip);

let windowsBytes = null;

try {
  windowsBytes =
    await readFile(
      windowsSetup,
    );
} catch {
  console.warn(
    'Windows Web Setup не найден. Сначала выполните: node scripts/build-windows-web-installer.mjs',
  );
}

await writeFile(
  generated,
  [
    '/* GENERATED — DO NOT EDIT */',
    `export const HELPER_ZIP_BASE64 = ${JSON.stringify(bytes.toString('base64'))};`,
    `export const HELPER_WINDOWS_SETUP_BASE64 = ${JSON.stringify(windowsBytes ? windowsBytes.toString('base64') : '')};`,
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Mac Helper собран: ${zip}`);

if (windowsBytes) {
  console.log(`Windows Helper подключён: ${windowsSetup}`);
}

console.log('Helper-пакеты встроены внутрь сборки Figma-плагина.');
