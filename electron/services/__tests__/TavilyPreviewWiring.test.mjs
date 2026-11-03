import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../ipcHandlers.ts',import.meta.url),'utf8');
const marker='          }, () => {\n            const { CredentialsManager }';
const start=source.indexOf(marker)+ '          }, '.length;
const end=source.indexOf('\n          });',start);
assert.ok(start>10 && end>start);
const expression=source.slice(start,end)+'\n}';
function factory(key,fetch) {return vm.runInNewContext(`(${expression})`,{require:()=>({CredentialsManager:{getInstance:()=>({getTavilyApiKey:()=>key})}}),fetch,AbortSignal})()}
test('actual IPC search resolver stays disabled without a key',()=>{assert.equal(factory('',()=>assert.fail('unexpected network')),null);});
test('actual IPC search provider sends only the key, query and limit, and reads Tavily results',async()=>{
 let request;
 const provider=factory('test-only-key',async(url,options)=>{request={url,body:JSON.parse(options.body)};return{ok:true,json:async()=>({results:[{title:'Test source',url:'https://example.com',content:'Evidence'}]})}});
 const results=await provider.search('public search query',5);
 assert.deepEqual(request,{url:'https://api.tavily.com/search',body:{api_key:'test-only-key',query:'public search query',max_results:5}});
 assert.equal(results[0].title,'Test source');
});
