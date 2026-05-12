import React from 'react';

// Parse WhatsApp-style markdown into React nodes
function parseWA(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Split by bold (*text*), italic (_text_), strike (~text~)
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Simple URL detector
    const urlRegex = /https?:\/\/\S+/g;
    const boldRegex = /\*([^*]+)\*/g;
    const italicRegex = /_([^_]+)_/g;

    // Tokenize: bold → italic → urls → plain
    const tokens: { type: 'bold' | 'italic' | 'url' | 'text'; value: string; href?: string }[] = [];
    let i = 0;
    const src = line;
    while (i < src.length) {
      if (src[i] === '*') {
        const end = src.indexOf('*', i + 1);
        if (end !== -1) { tokens.push({ type: 'bold', value: src.slice(i + 1, end) }); i = end + 1; continue; }
      }
      if (src[i] === '_') {
        const end = src.indexOf('_', i + 1);
        if (end !== -1) { tokens.push({ type: 'italic', value: src.slice(i + 1, end) }); i = end + 1; continue; }
      }
      if (src.slice(i, i + 4) === 'http') {
        const spaceIdx = src.indexOf(' ', i);
        const end = spaceIdx === -1 ? src.length : spaceIdx;
        const url = src.slice(i, end);
        tokens.push({ type: 'url', value: url, href: url });
        i = end; continue;
      }
      // Plain text — accumulate
      const lastToken = tokens[tokens.length - 1];
      if (lastToken?.type === 'text') { lastToken.value += src[i]; }
      else { tokens.push({ type: 'text', value: src[i] }); }
      i++;
    }

    const rendered = tokens.map((tok, ti) => {
      if (tok.type === 'bold')   return <strong key={ti} className="font-bold">{tok.value}</strong>;
      if (tok.type === 'italic') return <em key={ti} className="italic">{tok.value}</em>;
      if (tok.type === 'url')    return (
        <a key={ti} href={tok.href} className="text-[#0a7cff] underline underline-offset-2 break-all text-xs" target="_blank" rel="noopener noreferrer">
          {tok.value.replace(/^https?:\/\//, '')}
        </a>
      );
      return <span key={ti}>{tok.value}</span>;
    });

    // Divider line
    if (/^─{4,}$/.test(line.trim())) {
      return <hr key={li} className="border-[#e0e0e0] dark:border-slate-600 my-1.5" />;
    }

    return (
      <React.Fragment key={li}>
        {rendered}
        {li < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

interface MessageCardProps {
  /** Sender label (shown as contact name header) */
  from?: string;
  /** Message body — supports WhatsApp markdown */
  body: string;
  /** Timestamp label shown in message footer */
  time?: string;
  /** If true, renders compact (no from header) */
  compact?: boolean;
}

export default function MessageCard({ from, body, time, compact }: MessageCardProps) {
  return (
    <div className="flex flex-col items-end w-full">
      <div className="max-w-[90%] w-full">
        {/* Sender label */}
        {!compact && from && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <span className="text-green-700 dark:text-green-300 font-bold text-xs">{from.charAt(0)}</span>
            </div>
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">{from}</span>
          </div>
        )}

        {/* Bubble */}
        <div className="relative bg-[#dcf8c6] dark:bg-[#1a3a2a] rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm">
          {/* Tail */}
          <div className="absolute -top-0 right-[-6px] w-0 h-0 border-l-[6px] border-l-[#dcf8c6] dark:border-l-[#1a3a2a] border-b-[6px] border-b-transparent" />

          <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed break-words">
            {parseWA(body)}
          </div>

          {/* Footer: time + tick */}
          <div className="flex items-center justify-end gap-1 mt-1.5">
            {time && <span className="text-[10px] text-slate-400 dark:text-slate-500">{time}</span>}
            {/* Double tick (sent indicator) */}
            <svg className="w-3.5 h-3.5 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
              <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-5.5 5.75a.75.75 0 0 1-1.09-.005L2.4 5.087a.75.75 0 0 1 1.1-1.022l1.64 1.762 4.97-5.2a.75.75 0 0 1 1.06-.025l-.1.051Z"/>
              <path d="M15.071.653a.75.75 0 0 1 .025 1.06l-5.5 5.75a.75.75 0 0 1-1.085 0L6.9 5.81a.75.75 0 0 1 1.1-1.022l1.14 1.228 4.97-5.2a.75.75 0 0 1 1.06-.025l-.1.062Z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
