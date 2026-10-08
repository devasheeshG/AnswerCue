import React, { useEffect, useRef, useState } from 'react';
import { Trash2, AlertCircle, CheckCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

interface ProviderCardProps {
    providerId: 'gemini' | 'groq' | 'openai' | 'claude' | 'deepseek' | 'elevenlabs';
    providerName: string;
    apiKey: string;
    hasStoredKey: boolean;
    onKeyChange: (key: string) => void;
    onSaveKey: () => Promise<void>;
    onRemoveKey: () => void;
    onTestConnection: () => void;
    testStatus: 'idle' | 'testing' | 'success' | 'error';
    testError?: string;
    savingStatus: boolean;
    savedStatus: boolean;
    keyPlaceholder: string;
    keyUrl: string;
    children?: React.ReactNode;
    showFetchModels?: boolean;
    disabled?: boolean;
    canRemoveKey?: boolean;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ providerId, providerName, apiKey, hasStoredKey, onKeyChange, onSaveKey, onRemoveKey, onTestConnection, testStatus, testError, savingStatus, savedStatus, keyPlaceholder, keyUrl, children, showFetchModels = true, disabled = false, canRemoveKey = hasStoredKey }) => {
    const [fetching, setFetching] = useState(false);
    const [fetchMessage, setFetchMessage] = useState('');
    const [fetchError, setFetchError] = useState('');
    const saveRef = useRef(onSaveKey);
    saveRef.current = onSaveKey;
    useEffect(() => {
        if (!apiKey.trim() || disabled) return;
        const timer = setTimeout(() => { void saveRef.current().catch(console.error); }, 5000);
        return () => clearTimeout(timer);
    }, [apiKey, disabled]);
    const fetchModels = async () => {
        setFetching(true); setFetchError(''); setFetchMessage('');
        try {
            if (apiKey.trim()) await onSaveKey();
            const result = await window.electronAPI.fetchProviderModels(providerId as 'openai' | 'gemini' | 'claude', apiKey.trim());
            if (!result.success) throw new Error(result.error || 'Could not fetch models');
            setFetchMessage(`${result.models?.length || 0} models cached. Choose one in Active Model above.`);
        } catch (error: any) { setFetchError(error.message || 'Could not fetch models'); }
        finally { setFetching(false); }
    };
    return <fieldset disabled={disabled} className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
        <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-text-primary uppercase tracking-wide">{providerName} API Key{hasStoredKey && <span className="ml-2 text-green-500 normal-case">✓ Saved</span>}</label>
            <button type="button" onClick={() => window.electronAPI.openExternal(keyUrl)} className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary">Get Key <ExternalLink size={12} /></button>
        </div>
        <div className="flex gap-2 mb-3">
            <input type="password" aria-label={`${providerName} API key`} value={apiKey} onChange={event => onKeyChange(event.target.value)} placeholder={hasStoredKey ? '••••••••••••' : keyPlaceholder} className="min-w-0 flex-1 bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary" />
            <button type="button" onClick={() => { void onSaveKey().catch(console.error); }} disabled={savingStatus || !apiKey.trim()} className="px-5 py-2.5 rounded-lg text-xs font-medium bg-bg-input hover:bg-bg-elevated border border-border-subtle text-text-primary disabled:opacity-50">{savingStatus ? 'Saving…' : savedStatus ? 'Saved!' : 'Save'}</button>
            {canRemoveKey && <button type="button" onClick={onRemoveKey} aria-label={`Remove ${providerName} key`} className="px-2.5 text-text-tertiary hover:text-red-500"><Trash2 size={16} /></button>}
        </div>
        <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onTestConnection} disabled={(!apiKey.trim() && !hasStoredKey) || testStatus === 'testing'} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border border-border-subtle bg-bg-input hover:bg-bg-elevated ${testStatus === 'error' ? 'text-red-400' : testStatus === 'success' ? 'text-green-500' : 'text-text-primary'}`}>
                {testStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : testStatus === 'error' ? <AlertCircle size={12} /> : testStatus === 'success' ? <CheckCircle size={12} /> : null}
                {testStatus === 'testing' ? 'Testing…' : testStatus === 'success' ? 'Connected' : 'Test Connection'}
            </button>
            {showFetchModels && <button type="button" onClick={() => void fetchModels()} disabled={fetching || (!apiKey.trim() && !hasStoredKey)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border border-accent-primary/20 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 disabled:opacity-50"><RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />{fetching ? 'Fetching…' : 'Fetch Models'}</button>}
        </div>
        {fetchMessage && <p role="status" className="mt-2 text-[11px] text-text-secondary">{fetchMessage}</p>}
        {(testError || fetchError) && <p role="alert" className="mt-2 text-[11px] text-red-400">{testError || fetchError}</p>}
        {children}
    </fieldset>;
};
