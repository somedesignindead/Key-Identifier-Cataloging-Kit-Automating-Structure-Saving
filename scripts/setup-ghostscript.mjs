import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, ghostscriptPath, run } from '../converter/runtime.mjs';
const version='10.08.0';
const expected='caf199e3f233f1290b27d0972d636f66c303355f2353309b7bfddf1edda06b3d';
if(!['darwin','linux'].includes(process.platform)) {
  console.error('Для Windows установите Ghostscript с ghostscript.com и укажите GS_BIN — путь к gswin64c.exe.');
  process.exit(1);
}
try {
  const executable=await ghostscriptPath();
  const {stdout}=await run(executable,['--version']);
  if(parseFloat(stdout)>=10.08) {console.log(`Ghostscript уже установлен: ${stdout.trim()}`);process.exit(0);}
} catch { /* Install a current local version. */ }
const sourceRoot=join(ROOT,'.runtime/gs-source'), install=join(ROOT,'.runtime/ghostscript');
await mkdir(sourceRoot,{recursive:true});
console.log('Скачивание Ghostscript с официального GitHub Artifex…');
const response=await fetch(`https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10080/ghostscript-${version}.tar.gz`);
if(!response.ok)throw new Error(`Ошибка загрузки: ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Контрольная сумма Ghostscript не совпала.');
const archive=join(sourceRoot,'source.tar.gz');
await writeFile(archive,bytes);
async function command(bin,args,cwd) {
  await new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{cwd,stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`${bin}: ошибка ${code}`)));
  });
}
await command('tar',['-xzf',archive,'-C',sourceRoot],ROOT);
const source=join(sourceRoot,`ghostscript-${version}`);
console.log('Сборка локального Ghostscript. Нужны make и C-компилятор; это займёт несколько минут.');
await command('./configure',[`--prefix=${install}`,'--without-x','--disable-cups','--disable-gtk','--without-tesseract','--disable-fontconfig'],source);
await command('make',['-j4'],source);
await command('make',['install'],source);
await mkdir(join(ROOT,'.runtime/profiles'),{recursive:true});
await copyFile(join(source,'iccprofiles/default_cmyk.icc'),join(ROOT,'.runtime/profiles/default_cmyk.icc'));
console.log('Ghostscript готов. Исходники и лицензия сохранены в .runtime/gs-source.');
