import React, { useState } from 'react';
import { useOverlayCustomButtons, setOverlayCustomButtons, OVERLAY_CUSTOM_MAX, cleanOverlayCustomName } from '../../lib/overlayCustomButtons';

export function UpstreamPreviewSettings() {
 const buttons = useOverlayCustomButtons();
 const [name,setName]=useState(''); const [prompt,setPrompt]=useState('');
 const [key,setKey]=useState(''); const [notice,setNotice]=useState('');
 return <section className="space-y-4 bg-bg-item-surface border border-border-subtle rounded-xl p-5">
  <h3 className="font-semibold text-text-primary">Preview features</h3>
  <h4 className="text-sm text-text-primary">Tavily Search</h4>
  <p className="text-xs text-text-secondary">Web search for explicit requests in typed chat while the interview is stopped. Only the search query is sent to Tavily; your documents and transcript are not. Provider charges may apply.</p>
  <div className="flex gap-2"><input aria-label="Tavily API key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="Paste a Tavily key to save or replace it" className="flex-1 bg-bg-input border border-border-subtle rounded px-3 py-2 text-text-primary"/>
   <button disabled={!key.startsWith('tvly-')} onClick={async()=>{try {const result=await window.electronAPI.setTavilyApiKey(key);setNotice(result.success?'Search key saved.':result.error||'Could not save key.');if(result.success)setKey('');}catch{setNotice('Could not save search key.');}}}>Save key</button><button onClick={async()=>{try{const result=await window.electronAPI.setTavilyApiKey('');setNotice(result.success?'Search disabled.':'Could not remove key.');}catch{setNotice('Could not remove key.');}}}>Remove key</button></div>
  <h4 className="text-sm text-text-primary">Custom overlay actions</h4>
  <p className="text-xs text-text-secondary">Describe an action in plain language. Its button runs a typed request using your selected model, interview context, custom instructions, and Persona.</p>
  {buttons.map(button=><div key={button.id} className="flex justify-between gap-3 text-sm text-text-primary"><span>{button.name}: {button.prompt}</span><button aria-label={`Delete ${button.name}`} onClick={()=>setOverlayCustomButtons(buttons.filter(b=>b.id!==button.id))}>Delete</button></div>)}
  <input aria-label="Action name" maxLength={10} placeholder="Action name" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-bg-input border border-border-subtle rounded px-3 py-2 text-text-primary"/>
  <textarea aria-label="Action instructions" maxLength={2000} placeholder="What should this action do?" value={prompt} onChange={e=>setPrompt(e.target.value)} className="w-full bg-bg-input border border-border-subtle rounded px-3 py-2 text-text-primary"/>
  <button disabled={!name.trim()||!prompt.trim()||buttons.length>=OVERLAY_CUSTOM_MAX} onClick={()=>{setOverlayCustomButtons([...buttons,{id:`custom:${crypto.randomUUID()}`,name:cleanOverlayCustomName(name),prompt:prompt.trim(),instruction:'',screenshot:false}]);setName('');setPrompt('');}}>Add action ({buttons.length}/{OVERLAY_CUSTOM_MAX})</button>
  {notice&&<p role="status" className="text-xs text-text-secondary">{notice}</p>}
 </section>;
}
