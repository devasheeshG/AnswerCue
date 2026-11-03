import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
const require=createRequire(import.meta.url);const module={exports:{}};
const source=fs.readFileSync(new URL('../../../src/lib/overlayCustomButtons.ts',import.meta.url),'utf8');
vm.runInNewContext(transformSync(source,{loader:'ts',format:'cjs'}).code,{module,exports:module.exports,require});
const actions=module.exports;
test('upstream action normalizer rejects malformed entries, duplicates and oversized collections',()=>{
 const button={id:'custom:one',name:'Long action name',prompt:'Do this',instruction:'',screenshot:false};
 const result=actions.normalizeOverlayCustomButtons([null,{},button,button,...Array.from({length:8},(_,i)=>({...button,id:`custom:action-${i}`}))]);
 assert.equal(result.length,4);assert.equal(result[0].name,'Long actio');assert.equal(new Set(result.map(x=>x.id)).size,4);
 assert.equal(actions.normalizeOverlayCustomButtons('bad').length,0);
});
test('action instructions survive round-trip storage normalization',()=>{
 const input=[{id:'custom:recap',name:'Recap',prompt:'Summarize the conversation',instruction:'Use three bullets.',screenshot:false}];
 assert.equal(JSON.stringify(actions.normalizeOverlayCustomButtons(JSON.parse(JSON.stringify(input)))),JSON.stringify(input));
});
