import React, { useEffect, useState } from 'react';
import { TRANSCRIPTION_MODELS } from '../../../electron/audio/transcriptionModels';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ProviderCard } from './ProviderCard';

type Provider = 'openai' | 'elevenlabs';
export function TranscriptionProvidersSettings() {
    const [model, setModel] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [active, setActive] = useState(false);
    const [keys, setKeys] = useState({ openai: '', elevenlabs: '' });
    const [stored, setStored] = useState({ openai: false, elevenlabs: false });
    const [hasLlmKey, setHasLlmKey] = useState(false);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [testing, setTesting] = useState<Partial<Record<Provider, 'idle' | 'testing' | 'success' | 'error'>>>({});
    const [testErrors, setTestErrors] = useState<Partial<Record<Provider, string>>>({});
    const load = async () => {
        const [config, credentials] = await Promise.all([window.electronAPI.getTranscriptionConfig(), window.electronAPI.getStoredCredentials()]);
        setModel(config.model); setStored({ openai: credentials.hasSttOpenaiKey, elevenlabs: credentials.hasElevenLabsKey });
        setHasLlmKey(credentials.hasOpenaiKey); setLoaded(true);
    };
    useEffect(() => {
        void load().catch(() => setError('Could not load transcription settings. Reopen Settings to retry.'));
        void window.electronAPI.getMeetingActive().then(setActive);
        const credentials = window.electronAPI.onCredentialsChanged(() => { void load().catch(console.error); });
        const meeting = window.electronAPI.onMeetingStateChanged(state => setActive(state.isActive));
        return () => { credentials?.(); meeting?.(); };
    }, []);
    const save = async (provider: Provider, value = keys[provider]) => {
        if (active) throw new Error('Stop the interview before changing transcription keys');
        setSaving(provider); setError('');
        try {
            const result = provider === 'openai' ? await window.electronAPI.setOpenAiSttApiKey(value.trim()) : await window.electronAPI.setElevenLabsApiKey(value.trim());
            if (!result.success) throw new Error(result.error || 'Could not save key');
            setKeys(previous => ({ ...previous, [provider]: '' }));
            setTesting(previous => ({ ...previous, [provider]: 'idle' }));
            await load();
        } catch (error: any) { setError(error.message || 'Could not save key'); throw error; }
        finally { setSaving(''); }
    };
    const test = async (provider: Provider) => {
        setTesting(previous => ({ ...previous, [provider]: 'testing' }));
        setTestErrors(previous => ({ ...previous, [provider]: '' }));
        try {
            const result = await window.electronAPI.testTranscriptionConnection(provider, keys[provider].trim());
            setTesting(previous => ({ ...previous, [provider]: result.success ? 'success' : 'error' }));
            if (!result.success) setTestErrors(previous => ({ ...previous, [provider]: result.error || 'Connection failed' }));
        } catch { setTesting(previous => ({ ...previous, [provider]: 'error' })); setTestErrors(previous => ({ ...previous, [provider]: 'Connection failed' })); }
    };
    const options = TRANSCRIPTION_MODELS.filter(item => item.provider === 'openai' ? stored.openai || hasLlmKey : stored.elevenlabs)
        .map(item => ({ id: item.id, name: `${item.name} · ${item.provider === 'openai' ? 'OpenAI' : 'ElevenLabs'}` }));
    return <div className="space-y-4">
        <div><h3 className="text-sm font-bold text-text-primary mb-1">Transcription providers</h3><p className="text-xs text-text-secondary">Stream microphone and meeting audio to OpenAI or ElevenLabs. Internet and API usage are required.</p></div>
        <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-xs font-medium text-text-primary uppercase tracking-wide">Active transcription model</p><p className="text-[11px] text-text-secondary mt-1">Used for both audio channels on the next interview start.</p></div>
            <SearchableSelect label="Active transcription model" className="w-72 max-w-full" value={model} options={options} searchable disabled={!loaded || active || !!saving} placeholder="Save a transcription key" onChange={async next => {
                setSaving('model'); setError('');
                try { const result = await window.electronAPI.setTranscriptionModel(next); if (!result.success) throw new Error(result.error); setModel(next); }
                catch (error: any) { setError(error.message || 'Could not save transcription model'); }
                finally { setSaving(''); }
            }} />
        </div>
        {active && <p className="text-xs text-text-secondary">Stop the interview to change transcription settings.</p>}
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {(['openai', 'elevenlabs'] as const).map(provider => <ProviderCard key={provider} providerId={provider} providerName={provider === 'openai' ? 'OpenAI transcription' : 'ElevenLabs transcription'}
            apiKey={keys[provider]} hasStoredKey={stored[provider] || (provider === 'openai' && hasLlmKey)} onKeyChange={value => setKeys(previous => ({ ...previous, [provider]: value }))}
            onSaveKey={() => save(provider)} onRemoveKey={() => { void save(provider, '').catch(() => {}); }} onTestConnection={() => { void test(provider); }}
            testStatus={testing[provider] || 'idle'} testError={testErrors[provider]} savingStatus={saving === provider} savedStatus={false} canRemoveKey={stored[provider]}
            keyPlaceholder="API key" keyUrl={provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://elevenlabs.io/app/settings/api-keys'} showFetchModels={false} disabled={!loaded || active || saving === 'model'}>
            {provider === 'openai' && <p className="text-[11px] text-text-secondary mt-2">If no separate transcription key is saved, uses your saved OpenAI LLM key.</p>}
            <p className="text-[11px] text-text-tertiary mt-2">Test Connection checks session access; it does not record audio.</p>
        </ProviderCard>)}
    </div>;
}
