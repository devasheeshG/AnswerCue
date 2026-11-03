import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const main=fs.readFileSync(new URL('../../main.ts',import.meta.url),'utf8');
const start=main.indexOf("if (app.getVersion().includes('-upstream.'))");
const block=main.slice(start,main.indexOf('\nconst APP_NAME',start));
test('a fresh preview creates an isolated profile before setting the Electron userData path',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'answercue-profile-'));let chosen;
 try{vm.runInNewContext(block,{app:{getVersion:()=> '2.9.0-upstream.1',getPath:()=>dir,setPath:(_,value)=>{assert.equal(fs.existsSync(value),true);chosen=value;}},path,fs});assert.equal(chosen,path.join(dir,'AnswerCue-UpstreamPreview'));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('the stable version leaves the existing userData path untouched',()=>{
 vm.runInNewContext(block,{app:{getVersion:()=> '2.8.12',setPath:()=>assert.fail('Stable profile overridden')},path,fs});
});
