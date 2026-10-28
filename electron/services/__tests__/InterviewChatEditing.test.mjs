import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../..');
const managerSource = fs.readFileSync(path.join(root,'electron/services/InterviewWorkspaceStateManager.ts'),'utf8');
function managerAt(dir) {
 const exports={}; const module={exports}; vm.runInNewContext(transformSync(managerSource,{loader:'ts',format:'cjs'}).code,{exports,module,require:name=>name==='electron'?{app:{getPath:()=>dir}}:require(name),console});
 return module.exports.InterviewWorkspaceStateManager.getInstance();
}
test('deleted chat content and excluded transcript turns remain excluded after disk reload',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'answercue-edit-'));
 try {
 const manager=managerAt(dir);
 manager.saveWorkspace({id:'one',meetingId:'meeting',status:'complete',messages:[{id:'keep',role:'user',content:'Keep this',createdAt:1}],selectedDocumentIds:[],chatContextEdited:true,excludedTimelineIds:['speech-0-123'],contextMarkdown:'Keep this'});
 const saved=managerAt(dir).getWorkspaceForMeeting('meeting');
 assert.deepEqual(Array.from(saved.excludedTimelineIds),['speech-0-123']);assert.equal(saved.chatContextEdited,true);assert.equal(saved.messages[0].content,'Keep this');
 const updated=manager.saveWorkspace({id:'one',messages:[]});assert.equal(updated.chatContextEdited,true);assert.equal(updated.excludedTimelineIds[0],'speech-0-123');assert.equal(updated.messages.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const ipc=fs.readFileSync(path.join(root,'electron/ipcHandlers.ts'),'utf8');
const forkSource=ipc.slice(ipc.indexOf("  safeHandle('interview-workspace:fork'"),ipc.indexOf("  safeHandle('start-meeting'"));
function forkHandler(original) {
 let handler, savedMeeting, savedWorkspace;
 const meeting={id:'original',title:'Original interview',source:'manual',duration:'1:30',date:new Date().toISOString(),summary:'Removed information',transcript:[{speaker:'interviewer',text:'Question',timestamp:1}],usage:[]};
 vm.runInNewContext(transformSync(forkSource,{loader:'ts',format:'cjs'}).code,{
 safeHandle:(_,fn)=>handler=fn,require,Date,InterviewWorkspaceStateManager:{getInstance:()=>({getWorkspace:()=>original,saveWorkspace:s=>{savedWorkspace=structuredClone(s);return structuredClone(s);}})},DatabaseManager:{getInstance:()=>({getMeetingDetails:()=>meeting,saveMeeting:s=>savedMeeting=structuredClone(s)})},BrowserWindow:{getAllWindows:()=>[]}});
 return {run:()=>handler(null,'workspace'),meeting,get savedMeeting(){return savedMeeting;},get savedWorkspace(){return savedWorkspace;}};
}
test('fork snapshots history and context exclusions into an independent interview',async()=>{
 const original={id:'workspace',meetingId:'original',status:'complete',messages:[{id:'m',role:'user',content:'Retained chat'}],chatContextEdited:true,excludedTimelineIds:['speech-0-1'],selectedDocumentIds:['doc']};
 const f=forkHandler(original);const result=await f.run();assert.equal(result.success,true);assert.notEqual(result.meeting.id,'original');assert.equal(result.meeting.title,'Original interview (fork)');assert.equal(result.meeting.summary,'');assert.equal(f.meeting.summary,'Removed information');assert.equal(f.savedWorkspace.excludedTimelineIds[0],'speech-0-1');
 result.state.messages[0].content='Changed fork';assert.equal(original.messages[0].content,'Retained chat');
});
test('fork rejects a missing workspace or active capture',async()=>{
 for(const state of [null,{status:'active'}]) assert.equal((await forkHandler(state).run()).success,false);
});
