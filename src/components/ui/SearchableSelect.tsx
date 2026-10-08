import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption { id: string; name: string }

export function SearchableSelect({ value, options, onChange, placeholder = 'Select', label = 'Select', searchable = false, disabled = false, className = '' }: {
    value: string; options: SelectOption[]; onChange: (value: string) => void;
    placeholder?: string; label?: string; searchable?: boolean; disabled?: boolean; className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const listId = useId();
    const selected = options.find(option => option.id === value);
    const filtered = options.filter(option => `${option.id} ${option.name}`.toLowerCase().includes(query.toLowerCase()));
    useEffect(() => {
        const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    useEffect(() => { if (!open) setQuery(''); }, [open]);
    const choose = (id: string) => { onChange(id); setOpen(false); trigger.current?.focus(); };
    return <div className={`relative ${className}`} ref={container} onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { setOpen(true); return; }
            const buttons = Array.from(container.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
            buttons[next]?.focus();
        }
    }}>
        <button type="button" ref={trigger} aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}
            disabled={disabled || !options.length} onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-accent-primary/40 disabled:opacity-50">
            <span className="truncate">{selected?.name || value || placeholder}</span><ChevronDown size={14} className={`shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div className="absolute right-0 top-full z-[100] mt-1 min-w-full w-80 max-w-[calc(100vw-3rem)] rounded-lg border border-border-subtle bg-bg-elevated shadow-xl">
            {searchable && <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2"><Search size={14} className="text-text-tertiary" /><input autoFocus aria-label="Search models" placeholder="Search models or providers…" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none" /></div>}
            <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
                {filtered.map(option => <button type="button" role="option" aria-selected={option.id === value} key={option.id} onClick={() => choose(option.id)} className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs focus:bg-bg-input focus:outline-none hover:bg-bg-input ${option.id === value ? 'text-text-primary bg-bg-input' : 'text-text-secondary'}`}><span>{option.name}</span>{option.id === value && <Check size={14} className="shrink-0 text-accent-primary" />}</button>)}
                {!filtered.length && <p className="px-3 py-3 text-xs text-text-tertiary">No matching models</p>}
            </div>
        </div>}
    </div>;
}
