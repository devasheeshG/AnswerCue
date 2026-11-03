import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const main=fs.readFileSync(new URL('../PreviewProfile.ts',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../../main.ts',import.meta.url),'utf8');
assert.ok(entry.startsWith("import './services/PreviewProfile';"), 'Preview isolation must run before any imported storage module');
const start=main.indexOf("if (app.getVersion().includes('-upstream.'))");
const block=main.slice(start);
test('a fresh preview creates an isolated profile before setting the Electron userData path',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'answercue-profile-'));let chosen;
 try{vm.runInNewContext(block,{app:{getVersion:()=> '2.9.0-upstream.1',getPath:()=>dir,setPath:(_,value)=>{assert.equal(fs.existsSync(value),true);chosen=value;}},path,fs});assert.equal(chosen,path.join(dir,'AnswerCue-UpstreamPreview'));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('the stable version leaves the existing userData path untouched',()=>{
 vm.runInNewContext(block,{app:{getVersion:()=> '2.8.12',setPath:()=>assert.fail('Stable profile overridden')},path,fs});
});

test('real credential module resolves its import-time path inside the preview profile',async()=>{
 const {build}=await import('esbuild');
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'answercue-credential-isolation-'));
 const stable=path.join(dir,'StableAnswerCue');fs.mkdirSync(stable);let selected=stable;
 const {fileURLToPath}=await import('node:url');
 const bootstrap=fileURLToPath(new URL('../PreviewProfile.ts',import.meta.url));
 const credentials=fileURLToPath(new URL('../CredentialsManager.ts',import.meta.url));
 try{
 const compiled=await build({stdin:{contents:`import ${JSON.stringify(bootstrap)}; import {CredentialsManager} from ${JSON.stringify(credentials)}; CredentialsManager.getInstance().setTavilyApiKey('test-only-preview-key');`,resolveDir:dir,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'test-electron',setup(build){build.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'test-electron'}));build.onLoad({filter:/.*/,namespace:'test-electron'},()=>({contents:'module.exports = globalThis.testElectron;',loader:'js'}));}}]});
 const testElectron={app:{getVersion:()=> '2.9.0-upstream.1',getPath:name=>name==='appData'?dir:selected,setPath:(_,value)=>selected=value},safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value)}};
 vm.runInNewContext(compiled.outputFiles[0].text,{testElectron,require,Buffer,console});
 assert.equal(fs.existsSync(path.join(stable,'credentials.enc')),false);
 assert.equal(fs.existsSync(path.join(dir,'AnswerCue-UpstreamPreview','credentials.enc')),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
