import { Plus, History, X, Trash2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { AMHARIC_STARTER_PROMPTS } from '../lib/prompts';

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface SessionRecord {
  id: string;
  title: string;
  timestamp: string;
  messages: TranscriptMessage[];
}

interface TranscriptAndHistoryViewProps {
  messages: TranscriptMessage[];
  interimUserText: string;
  interimAssistantText: string;
  onClear: () => void;
  onSelectStarterPrompt: (promptText: string) => void;
  onNewSession: () => void;
  sessions: SessionRecord[];
  onSelectSession: (session: SessionRecord) => void;
  onClose: () => void;
}

export function TranscriptAndHistoryView({
  messages,
  interimUserText,
  interimAssistantText,
  onClear,
  onSelectStarterPrompt,
  onNewSession,
  sessions,
  onSelectSession,
  onClose,
}: TranscriptAndHistoryViewProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');

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
      // Clipboard blocked
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto h-full min-h-0 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 bg-white rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'current'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Session{messages.length > 0 ? ` (${messages.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>History{sessions.length > 0 ? ` (${sessions.length})` : ''}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'current' && (
            <>
              <button
                type="button"
                onClick={onNewSession}
                title="Start New Session (+)"
                className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={messages.length === 0}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={messages.length === 0 && !interimUserText && !interimAssistantText}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close transcript and return to live morph"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {viewMode === 'history' ? (
          <div className="flex flex-col gap-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <History className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-900">No saved sessions yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  When you start a new session (+) or end a conversation, transcripts are safely archived here.
                </p>
              </div>
            ) : (
              sessions.map((sess) => (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    onSelectSession(sess);
                    setViewMode('current');
                  }}
                  className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-sky-50 hover:border-sky-300 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{sess.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sess.messages.length} messages · {sess.timestamp}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-sky-700 bg-sky-100 px-2.5 py-1 rounded-lg">
                    View
                  </span>
                </button>
              ))
            )}
          </div>
        ) : messages.length === 0 && !interimUserText && !interimAssistantText ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              ገና ውይይት አልተጀመረም · No transcript yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Real-time voice and text exchanges will appear here as they happen, or tap a prompt below to start.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 text-left">
              {AMHARIC_STARTER_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectStarterPrompt(item.amharic);
                    onClose();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition-colors hover:bg-sky-50 hover:border-sky-300 cursor-pointer shadow-xs"
                >
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {item.amharic}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.englishGloss}</p>
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
                    : 'bg-white border-slate-200 mr-6 sm:mr-16'
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
