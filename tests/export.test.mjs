import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
async function load(path) {
  const r = await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const {selectionRoots,uniqueName,exportSelection} = await load('src/core/export.ts');
const {makeZip} = await load('src/ui/download.ts');
const {isUiMessage} = await load('src/shared/messages.ts');
const options = {format:'SVG',colorMode:'RGB',outlineText:false};
let calls=[];
function node(id,name,parent=null) {
  return {id,name,parent,exportAsync:async settings => {calls.push(settings);return new Uint8Array([1,2,3]);}};
}
test('deduplicates selected descendants',()=>{
  const frame=node('1','frame'),child=node('2','text',frame);
  assert.deepEqual(selectionRoots([child,frame]),[frame]);
});
test('safe unique names',()=>{
  const used=new Set();
  assert.equal(uniqueName('../','svg',used),'.._.svg');
  assert.equal(uniqueName('CON','svg',used),'_CON.svg');
  assert.equal(uniqueName('   ','svg',used),'layer.svg');
  assert.equal(uniqueName('Layer','svg',used),'Layer-2.svg');
});
test('SVG text and sRGB settings, progress',async()=>{
  calls=[]; const progress=[];
  const files=await exportSelection([node('1','A'),node('2','A')],options,(...p)=>progress.push(p));
  assert.deepEqual(files.map(f=>f.name),['A.svg','A-2.svg']);
  assert.equal(calls[0].svgOutlineText,false);assert.equal(calls[0].colorProfile,'SRGB');
  assert.deepEqual(progress,[[0,2],[1,2],[2,2]]);
});
test('outlined PDF uses native PDF, editable PDF uses SVG source',async()=>{
  calls=[];
  const pdf=await exportSelection([node('1','A')],{...options,format:'PDF',outlineText:true},()=>{});
  assert.equal(calls[0].format,'PDF');assert.equal(pdf[0].mime,'application/pdf');
  calls=[];
  const editable=await exportSelection([node('1','A')],{...options,format:'PDF'},()=>{});
  assert.equal(calls[0].format,'SVG');assert.equal(editable[0].mime,'image/svg+xml');
  assert.equal(editable[0].name,'A.pdf');
});
test('rejects empty selection, CMYK SVG and malformed messages',async()=>{
  await assert.rejects(exportSelection([],options,()=>{}),/Выберите/);
  await assert.rejects(exportSelection([node('1','A')],{...options,colorMode:'CMYK'},()=>{}),/PDF/);
  assert.equal(isUiMessage({type:'export',options:{format:'AI'}}),false);
});
test('independent ZIP roundtrip with Cyrillic filename',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'figma-zip-test-'));
  try {
    await writeFile(join(dir,'files.zip'),makeZip([{name:'Тест.svg',bytes:new Uint8Array([0,255,17]),mime:'image/svg+xml'}]));
    execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.namelist()==["Тест.svg"]; assert z.read("Тест.svg")==bytes([0,255,17]); assert z.testzip() is None',join(dir,'files.zip')]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
