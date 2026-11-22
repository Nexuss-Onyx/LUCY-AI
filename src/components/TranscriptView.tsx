import { Copy, Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AMHARIC_STARTER_PROMPTS } from '../lib/prompts';

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface TranscriptViewProps {
  messages: TranscriptMessage[];
  interimUserText: string;
  interimAssistantText: string;
  onClear: () => void;
  onSelectStarterPrompt: (promptText: string) => void;
}

export function TranscriptView({
  messages,
  interimUserText,
  interimAssistantText,
  onClear,
  onSelectStarterPrompt,
}: TranscriptViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (messages.length === 0) return;
    const text = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'You' : 'Lucy AI'}: ${m.text}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in non-secure context
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto h-full min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 shrink-0">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">
            የውይይት መዝገብ · Transcript
          </h2>
          <p className="text-xs text-slate-500">
            Amharic voice & text history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={messages.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={messages.length === 0 && !interimUserText && !interimAssistantText}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lucy-scroll pr-1">
        {messages.length === 0 && !interimUserText && !interimAssistantText ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 text-center">
            <p className="text-sm font-semibold text-slate-900">
              ገና ውይይት አልተጀመረም · No messages yet
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
              Tap a prompt below or switch to Voice to speak with Lucy AI in Amharic.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 text-left">
              {AMHARIC_STARTER_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectStarterPrompt(item.amharic)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:bg-sky-50 hover:border-sky-400 cursor-pointer"
                >
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {item.amharic}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{item.englishGloss}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 rounded-2xl px-4 py-3 border ${
                  msg.role === 'user'
                    ? 'bg-sky-50/70 border-sky-100 ml-6 sm:ml-16'
                    : 'bg-white border-slate-200/90 mr-6 sm:mr-16'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {msg.role === 'user' ? 'You (እርስዎ)' : 'Lucy AI (ሉሲ)'}
                  </span>
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                </div>
                <p className="text-sm sm:text-[15px] text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            ))}

            {interimUserText && (
              <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 border border-dashed border-sky-200 bg-sky-50/30 ml-6 sm:ml-16">
                <span className="text-xs font-medium text-sky-700">Listening…</span>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">{interimUserText}</p>
              </div>
            )}

            {interimAssistantText && (
              <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 border border-dashed border-slate-200 bg-white mr-6 sm:mr-16">
                <span className="text-xs font-medium text-slate-600">Lucy AI speaking…</span>
                <p className="text-sm sm:text-[15px] text-slate-800 leading-relaxed">
                  {interimAssistantText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
