import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createConverterServer} from '../converter/server.mjs';
import {validateProfile} from '../converter/profiles.mjs';

test('localhost API: auth, CORS, invalid JSON, binary output',async()=>{
  const {server,token}=createConverterServer({convertFile:async()=>({bytes:Buffer.from('%PDF-test'),profile:null})});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/health')).status,401);
    assert.equal((await fetch(base+'/health',{headers:{Origin:'https://unrelated.example'}})).status,403);
    const pre=await fetch(base+'/convert',{method:'OPTIONS',headers:{Origin:'null'}});
    assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),'null');
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:'null'};
    assert.equal((await fetch(base+'/convert',{method:'POST',headers,body:'{'})).status,400);
    const result=await fetch(base+'/convert',{method:'POST',headers,body:'{}'});
    assert.equal(result.status,200);assert.equal(Buffer.from((await result.json()).base64,'base64').toString(),'%PDF-test');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('ICC header rejects RGB and corrupt tag offsets',()=>{
  assert.throws(()=>validateProfile(Buffer.alloc(132)),/ICC/);
  const bytes=Buffer.alloc(144);bytes.writeUInt32BE(144,0);bytes.write('prtr',12);bytes.write('CMYK',16);bytes.write('acsp',36);
  bytes.writeUInt32BE(1,128);bytes.writeUInt32BE(200,136);bytes.writeUInt32BE(8,140);
  assert.throws(()=>validateProfile(bytes),/Повреждены/);
});
