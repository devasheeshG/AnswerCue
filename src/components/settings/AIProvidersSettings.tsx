import { SearchableSelect as ModelSelect } from '../ui/SearchableSelect';
import { OPENAI_SERVICE_TIERS, type OpenAiServiceTier } from '../../../electron/llm/openAiServiceTier';
import React, { useEffect, useMemo, useState } from 'react';
import { STANDARD_CLOUD_MODELS, prettifyModelId } from '../../utils/modelUtils';
import { TranscriptionProvidersSettings } from './TranscriptionProvidersSettings';
import { ProviderCard } from './ProviderCard';

type ProviderId = 'openai' | 'gemini' | 'claude';
type ProviderDataScopeKey = 'transcript' | 'screenshots' | 'reference_files' | 'profile_history' | 'embeddings' | 'post_call_summary';
type ProviderDataScopes = Partial<Record<ProviderDataScopeKey, boolean>>;

interface ModelOption {
    id: string;
    name: string;
}

interface ModelSelectProps {
    value: string;
    options: ModelOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const PROVIDER_ORDER: ProviderId[] = ['openai', 'gemini', 'claude'];
const PROVIDER_DATA_SCOPE_OPTIONS: Array<{ key: ProviderDataScopeKey; label: string; description: string }> = [
    { key: 'transcript', label: 'Transcript', description: 'Live interview and meeting text.' },
    { key: 'screenshots', label: 'Screenshots', description: 'Screen context used for visual answers.' },
    { key: 'reference_files', label: 'Reference files', description: 'Selected docs and uploaded context.' },
    { key: 'profile_history', label: 'Profile history', description: 'Saved profile and prior interview context.' },
    { key: 'post_call_summary', label: 'Post-call summary', description: 'Finished interview summaries.' },
];

const PROVIDER_LABELS: Record<ProviderId, string> = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
};

const PROVIDER_KEY_PLACEHOLDERS: Record<ProviderId, string> = {
    openai: 'sk-...',
    gemini: 'AIzaSy...',
    claude: 'sk-ant-...',
};

const PROVIDER_KEY_URLS: Record<ProviderId, string> = {
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/app/apikey',
    claude: 'https://console.anthropic.com/settings/keys',
};

export const AIProvidersSettings: React.FC = () => {
    const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
        openai: '',
        gemini: '',
        claude: '',
    });
    const [hasStoredKey, setHasStoredKey] = useState<Record<ProviderId, boolean>>({
        openai: false,
        gemini: false,
        claude: false,
    });
    const [defaultModel, setDefaultModel] = useState('');
    const [modelCache, setModelCache] = useState<Record<string, Array<{ id: string; label: string }>>>({});
    const [credentialsLoaded, setCredentialsLoaded] = useState(false);
    const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
    const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
    const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
    const [testError, setTestError] = useState<Record<string, string>>({});
    const [openAiTier, setOpenAiTier] = useState<OpenAiServiceTier>('auto');
    const [tierLoaded, setTierLoaded] = useState(false);
    const [tierSaving, setTierSaving] = useState(false);
    const [tierError, setTierError] = useState('');
    const [providerDataScopes, setProviderDataScopes] = useState<ProviderDataScopes>({});

    useEffect(() => {
        const loadCredentials = async () => {
            try {
                const creds = await window.electronAPI?.getStoredCredentials?.();
                if (creds) {
                    setHasStoredKey({
                        openai: !!creds.hasOpenaiKey,
                        gemini: !!creds.hasGeminiKey,
                        claude: !!creds.hasClaudeKey,
                    });


                }

                const result = await window.electronAPI?.getDefaultModel?.();
                if (result?.model && result.model !== 'natively') {
                    setDefaultModel(result.model);
                }
            } catch (error) {
                console.error('Failed to load AI provider settings:', error);
            } finally {
                setCredentialsLoaded(true);
            }
        };

        loadCredentials();
    }, []);

    useEffect(() => {
        window.electronAPI?.getProviderDataScopes?.().then(setProviderDataScopes).catch(console.error);
        const unsubscribeProviderDataScopes = window.electronAPI?.onProviderDataScopesChanged
            ? window.electronAPI.onProviderDataScopesChanged(setProviderDataScopes)
            : undefined;
        return () => unsubscribeProviderDataScopes?.();
    }, []);

    useEffect(() => {
        window.electronAPI.getOpenAiServiceTier()
            .then(result => { setOpenAiTier(result.tier); setTierLoaded(true); })
            .catch(() => setTierError('Could not load your saved response tier. Reopen Settings to retry.'));
        return window.electronAPI.onOpenAiServiceTierChanged(setOpenAiTier);
    }, []);

    const handleTierChange = async (tier: OpenAiServiceTier) => {
        setTierSaving(true);
        setTierError('');
        try {
            const result = await window.electronAPI.setOpenAiServiceTier(tier);
            if (!result.success) throw new Error(result.error || 'Could not save response tier');
            setOpenAiTier(tier);
            setTestStatus(prev => ({ ...prev, openai: 'idle' }));
            setTestError(prev => ({ ...prev, openai: '' }));
        } catch (error: any) {
            setTierError(error.message || 'Could not save response tier');
        } finally {
            setTierSaving(false);
        }
    };

    useEffect(() => {
        const refresh = () => window.electronAPI.getProviderModelCache().then(setModelCache).catch(console.error);
        void refresh();
        return window.electronAPI.onProviderModelCacheChanged(refresh);
    }, []);

    const defaultModelOptions = useMemo<ModelOption[]>(() => {
        const options: ModelOption[] = [];

        for (const provider of PROVIDER_ORDER) {
            const config = STANDARD_CLOUD_MODELS[provider];
            if (!config || !hasStoredKey[provider]) continue;

            const available = modelCache[provider] ?? config.ids.map((id, index) => ({ id, label: config.names[index] || prettifyModelId(id) }));
            available.forEach(model => options.push({ id: model.id, name: `${model.label} · ${PROVIDER_LABELS[provider]}` }));
        }

        return options;
    }, [hasStoredKey, modelCache]);

    useEffect(() => {
        if (!credentialsLoaded || defaultModelOptions.length === 0) return;
        if (defaultModel) return;

        const nextModel = defaultModelOptions[0].id;
        setDefaultModel(nextModel);
        window.electronAPI?.setDefaultModel?.(nextModel).catch(console.error);
    }, [credentialsLoaded, defaultModel, defaultModelOptions]);

    const setProviderKey = (provider: ProviderId, value: string) => {
        setApiKeys(prev => ({ ...prev, [provider]: value }));
    };

    const handleSaveKey = async (provider: ProviderId) => {
        const key = apiKeys[provider].trim();
        if (!key) return;

        setSavingStatus(prev => ({ ...prev, [provider]: true }));
        try {
            let result;
            if (provider === 'openai') result = await window.electronAPI?.setOpenaiApiKey?.(key);
            if (provider === 'gemini') result = await window.electronAPI?.setGeminiApiKey?.(key);
            if (provider === 'claude') result = await window.electronAPI?.setClaudeApiKey?.(key);

            if (result?.success) {
                setSavedStatus(prev => ({ ...prev, [provider]: true }));
                setHasStoredKey(prev => ({ ...prev, [provider]: true }));
                setProviderKey(provider, '');
                setTimeout(() => setSavedStatus(prev => ({ ...prev, [provider]: false })), 2000);
            }
        } catch (error) {
            console.error(`Failed to save ${provider} API key:`, error);
        } finally {
            setSavingStatus(prev => ({ ...prev, [provider]: false }));
        }
    };

    const handleRemoveKey = async (provider: ProviderId) => {
        if (!confirm(`Are you sure you want to remove the ${PROVIDER_LABELS[provider]} API key?`)) return;

        try {
            let result;
            if (provider === 'openai') result = await window.electronAPI?.setOpenaiApiKey?.('');
            if (provider === 'gemini') result = await window.electronAPI?.setGeminiApiKey?.('');
            if (provider === 'claude') result = await window.electronAPI?.setClaudeApiKey?.('');

            if (result?.success) {
                setHasStoredKey(prev => ({ ...prev, [provider]: false }));
                setProviderKey(provider, '');
            }
        } catch (error) {
            console.error(`Failed to remove ${provider} API key:`, error);
        }
    };

    const handleTestConnection = async (provider: ProviderId) => {
        const key = apiKeys[provider].trim();
        if (!key && !hasStoredKey[provider]) return;

        setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
        setTestError(prev => ({ ...prev, [provider]: '' }));

        try {
            const result = await window.electronAPI?.testLlmConnection?.(provider, key);
            if (result?.success) {
                setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
                setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: 'idle' })), 3000);
            } else {
                setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
                setTestError(prev => ({ ...prev, [provider]: result?.error || 'Connection failed' }));
            }
        } catch (error: any) {
            setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
            setTestError(prev => ({ ...prev, [provider]: error.message || 'Connection failed' }));
        }
    };

    const handleProviderDataScopeChange = (scope: ProviderDataScopeKey, enabled: boolean) => {
        const next = { ...providerDataScopes, [scope]: enabled };
        setProviderDataScopes(next);
        window.electronAPI?.setProviderDataScopes?.(next).catch(console.error);
    };

    return (
        <div className="space-y-5 animated fadeIn pb-10">
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Default Model for Chat</h3>
                    <p className="text-xs text-text-secondary mb-2">Choose from configured OpenAI, Google, and Anthropic models.</p>
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between">
                    <div>
                        <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0">Active Model</label>
                        <p className="text-[10px] text-text-secondary">Applies to new chats instantly.</p>
                    </div>
                    <ModelSelect
                        value={defaultModel}
                        label="Active model"
                        searchable
                        className="w-64"
                        options={defaultModelOptions}
                        placeholder={defaultModelOptions.length ? 'Select model' : 'Add a provider key first'}
                        onChange={(value) => {
                            setDefaultModel(value);
                            window.electronAPI?.setDefaultModel?.(value).catch(console.error);
                        }}
                    />
                </div>
            </div>

            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">LLM providers</h3>
                    <p className="text-xs text-text-secondary mb-2">Add one or more provider keys. Only OpenAI, Google, and Anthropic are shown here.</p>
                </div>

                <div className="space-y-4">
                    {PROVIDER_ORDER.map(provider => (
                        <ProviderCard
                            key={provider}
                            providerId={provider}
                            providerName={PROVIDER_LABELS[provider]}
                            apiKey={apiKeys[provider]}
                            hasStoredKey={hasStoredKey[provider]}
                            onKeyChange={(value) => setProviderKey(provider, value)}
                            onSaveKey={() => handleSaveKey(provider)}
                            onRemoveKey={() => handleRemoveKey(provider)}
                            onTestConnection={() => handleTestConnection(provider)}
                            testStatus={testStatus[provider] || 'idle'}
                            testError={testError[provider]}
                            savingStatus={!!savingStatus[provider]}
                            savedStatus={!!savedStatus[provider]}
                            keyPlaceholder={PROVIDER_KEY_PLACEHOLDERS[provider]}
                            keyUrl={PROVIDER_KEY_URLS[provider]}
                        >
                            {provider === 'openai' && (
                                <div className="mt-4 pt-4 border-t border-border-subtle">
                                    <div className="flex items-center justify-between gap-4">
                                        <label htmlFor="openai-response-tier" className="text-xs font-medium text-text-primary uppercase tracking-wide">Default response tier</label>
                                        <ModelSelect
                                            label="Default response tier"
                                            value={openAiTier}
                                            disabled={!tierLoaded || tierSaving}
                                            className="w-48"
                                            onChange={value => void handleTierChange(value as OpenAiServiceTier)}
                                            options={OPENAI_SERVICE_TIERS.map(tier => ({ id: tier, name: ({ auto: 'Auto (project default)', default: 'Standard', fast: 'Fast (Priority)' })[tier] }))}
                                        />
                                    </div>
                                    <p id="openai-tier-description" className="text-[11px] text-text-secondary leading-relaxed mt-2">
                                        {openAiTier === 'auto' && 'Uses your OpenAI project’s default tier.'}
                                        {openAiTier === 'default' && 'Uses standard OpenAI pricing and performance.'}
                                        {openAiTier === 'fast' && 'Requests faster processing for your selected OpenAI model, at a higher token price.'}
                                        {' '}Saved automatically for future OpenAI requests. Other providers and transcription keep their own settings.
                                    </p>
                                    {tierSaving && <p className="text-[11px] text-text-secondary mt-1" role="status">Saving…</p>}
                                    {tierError && <p className="text-[11px] text-red-400 mt-1" role="alert">{tierError}</p>}
                                </div>
                            )}
                        </ProviderCard>
                    ))}
                </div>
            </div>

            <TranscriptionProvidersSettings />

            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Cloud provider data scopes</h3>
                    <p className="text-xs text-text-secondary mb-2">Choose what app context cloud providers may receive.</p>
                </div>
                <div className="bg-bg-item-surface rounded-xl p-4 border border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PROVIDER_DATA_SCOPE_OPTIONS.map(option => (
                        <label
                            key={option.key}
                            className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-input/70 px-3 py-3 cursor-pointer hover:bg-bg-elevated transition-colors"
                        >
                            <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-accent-primary"
                                checked={providerDataScopes[option.key] !== false}
                                onChange={(event) => handleProviderDataScopeChange(option.key, event.target.checked)}
                            />
                            <span className="min-w-0">
                                <span className="block text-xs font-semibold text-text-primary">{option.label}</span>
                                <span className="block text-[10px] leading-snug text-text-secondary">{option.description}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};
