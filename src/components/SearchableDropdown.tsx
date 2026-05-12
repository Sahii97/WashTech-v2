import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
}

export default function SearchableDropdown({
  options, value, onChange,
  placeholder = '— اختر —',
  searchPlaceholder = 'بحث...',
  className = '',
  id,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = query.trim()
    ? options.filter(o => o.label.includes(query) || (o.sublabel || '').includes(query))
    : options;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Keyboard: Escape closes
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all text-sm"
      >
        <span className={selected ? 'font-medium' : 'text-slate-400 dark:text-slate-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-xl overflow-hidden"
          style={{ maxHeight: '260px' }}
        >
          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: options.length > 5 ? '200px' : '260px' }}>
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">لا نتائج</p>
            )}
            {filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-right transition-colors ${
                  value === opt.value
                    ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                }`}
              >
                <div>
                  <span className="font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{opt.sublabel}</span>
                  )}
                </div>
                {value === opt.value && <Check size={14} className="text-brand-600 dark:text-brand-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
