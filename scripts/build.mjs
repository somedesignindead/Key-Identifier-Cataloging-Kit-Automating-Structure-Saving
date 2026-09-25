import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const watching = process.argv.includes('--watch');
async function compile() {
  await mkdir('dist', { recursive: true });
  await build({ entryPoints: ['src/code.ts'], bundle: true, outfile: 'dist/code.js', target: 'es2017', format: 'iife' });
  const ui = await build({ entryPoints: ['src/ui.ts'], bundle: true, write: false, target: 'es2017', format: 'iife' });
  const html = await readFile('src/ui.html', 'utf8');
  const script = ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  await writeFile('dist/ui.html', html.replace('<!-- UI_SCRIPT -->', () => `<script>${script}</script>`));
  console.log('Сборка готова: dist/code.js и dist/ui.html');
}
await compile();
if (watching) {
  let pending = Promise.resolve();
  let timer;
  watch('src', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = pending.then(compile).catch(error => console.error(error));
    }, 100);
  });
  console.log('Ожидание изменений в src/. После сборки перезапустите плагин в Figma.');
}
