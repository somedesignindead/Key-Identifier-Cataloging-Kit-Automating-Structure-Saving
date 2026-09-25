import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream,rgb} from 'pdf-lib';
import {convert} from '../converter/convert.mjs';
import {ghostscriptPath} from '../converter/runtime.mjs';
import {getProfile} from '../converter/profiles.mjs';

test('real CMYK conversion embeds chosen ICC and preserves page geometry',async t=>{
  try {await ghostscriptPath();await getProfile();}catch{t.skip('Для интеграционного теста нужны Ghostscript и CMYK ICC.');return;}
  const doc=await PDFDocument.create(),page=doc.addPage([240,180]);
  page.drawRectangle({x:10,y:10,width:90,height:60,color:rgb(1,0.2,0.1)});
  page.drawText('Editable text',{x:12,y:120,size:15,color:rgb(0.1,0.2,0.5)});
  const profile=await getProfile();
  const converted=await convert({mime:'application/pdf',base64:Buffer.from(await doc.save()).toString('base64'),colorMode:'CMYK',
    profile:{name:'test-profile.icc',base64:profile.bytes.toString('base64')}});
  const out=await PDFDocument.load(converted.bytes);
  assert.equal(out.getPageCount(),1);assert.equal(out.getPage(0).getWidth(),240);assert.equal(out.getPage(0).getHeight(),180);
  const intents=out.catalog.lookup(PDFName.of('OutputIntents'));
  const intent=out.context.lookup(intents.get(0));
  const icc=intent.lookup(PDFName.of('DestOutputProfile'));
  assert.equal(icc.dict.lookup(PDFName.of('N')).asNumber(),4);
  assert.deepEqual(Buffer.from(decodePDFRawStream(icc).decode()),profile.bytes);
  const contents=out.getPage(0).node.Contents();
  const streams=contents instanceof PDFRawStream?[contents]:contents.asArray().map(r=>out.context.lookup(r));
  const instructions=streams.map(s=>Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
  assert.match(instructions,/\bk\b/);assert.doesNotMatch(instructions,/\brg\b|\bRG\b/);assert.match(instructions,/\bBT\b/);
});
