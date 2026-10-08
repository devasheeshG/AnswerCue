import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { registerChatInterview } = require('../../../dist-electron/electron/services/ChatInterviewRegistration.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const workspace = (messages = []) => ({id:'workspace-1',status:'draft',messages,selectedDocumentIds:[],createdAt:'2026-10-08T10:00:00Z',updatedAt:'2026-10-08T10:00:00Z'});
const user = {id:'message-1',role:'user',content:'Preparing for a Northstar backend interview',createdAt:Date.parse('2026-10-08T10:00:00Z')};
function fixture(generateTitle = async () => 'Northstar Backend Interview') {
  const rows = new Map(); let saves = 0, notifications = 0, titles = 0;
  const deps = {
    getMeeting: id => rows.get(id) || null,
    saveMeeting: meeting => {saves++; rows.set(meeting.id, structuredClone(meeting));},
    saveWorkspace: state => structuredClone(state),
    updateAutoTitle: (id,title) => {const row=rows.get(id); if(!row || row.source!=='chat' || row.titleSource==='manual')return false; row.title=title; return true;},
    generateTitle: async context => {titles++; return generateTitle(context);},
    notify: () => notifications++,
  };
  return {deps,rows,counts:()=>({saves,notifications,titles})};
}
test('empty drafts and assistant-only messages do not create sidebar interviews', async () => {
  const f=fixture();
  registerChatInterview(workspace(),f.deps);
  registerChatInterview(workspace([{...user,role:'assistant'}]),f.deps);
  await tick(); assert.equal(f.rows.size,0); assert.equal(f.counts().titles,0);
});
test('first user message registers once and produces an automatic title without blocking persistence', async () => {
  let resolveTitle; const f=fixture(()=>new Promise(resolve=>resolveTitle=resolve));
  const first=registerChatInterview(workspace([user]),f.deps);
  assert.equal(first.state.meetingId,'chat-workspace-1'); assert.equal(first.state.status,'draft');
  assert.equal(first.meeting.source,'chat'); assert.equal(f.rows.size,1);
  registerChatInterview({...first.state,messages:[user,{...user,id:'message-2'}]},f.deps);
  // Even an old renderer retry cannot create a second row or title request.
  registerChatInterview(workspace([user]),f.deps);
  await tick(); assert.equal(f.counts().saves,1); assert.equal(f.counts().titles,1);
  resolveTitle('Title: "Northstar Backend Preparation"'); await tick();
  assert.equal(f.rows.get(first.meeting.id).title,'Northstar Backend Preparation');
});
test('title provider failures retain the saved chat and useful fallback title', async () => {
  const f=fixture(async()=>{throw new Error('offline');});
  const result=registerChatInterview(workspace([user]),f.deps); await tick();
  assert.equal(f.rows.get(result.meeting.id).title,user.content); assert.equal(f.rows.size,1);
});
test('delayed titles preserve manual renames and cannot overwrite a resumed live interview', async () => {
  for(const protect of [row=>row.titleSource='manual',row=>row.source='manual']) {
    let resolveTitle; const f=fixture(()=>new Promise(resolve=>resolveTitle=resolve));
    const {meeting}=registerChatInterview(workspace([user]),f.deps); await tick();
    const row=f.rows.get(meeting.id); row.title='My chosen title'; protect(row);
    resolveTitle('Different generated title'); await tick(); assert.equal(row.title,'My chosen title');
  }
});
test('existing live interview messages retain their identity and do not generate another chat title', async () => {
  const f=fixture(); f.rows.set('live-1',{id:'live-1',source:'manual',title:'Existing interview'});
  const result=registerChatInterview({...workspace([user]),meetingId:'live-1',status:'complete'},f.deps);
  await tick(); assert.equal(result.meeting.id,'live-1'); assert.equal(f.rows.size,1); assert.equal(f.counts().titles,0);
});
