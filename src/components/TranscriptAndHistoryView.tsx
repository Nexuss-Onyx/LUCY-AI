import { Plus, History, X, Trash2, Copy, Check, Search, MessageSquare } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#FAFAFA] text-slate-950 overflow-hidden">
      {/* Top Sub-Navigation Bar with Close X icon */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transcript and return to live morph"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Transcript & History · የውይይት መዝገብ
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex items-center gap-1 h-9 px-3.5 rounded-xl bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Session</span>
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
        </div>
      </div>

      {/* Main Content Area: Split into Left Sidebar with Search & Session List, Right Current Transcript */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row max-w-6xl w-full mx-auto p-4 sm:p-6 gap-6 overflow-hidden">
        {/* Left Sidebar: Search & Past Sessions */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-sky-700" />
            <span>Saved Sessions ({sessions.length})</span>
          </h3>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history…"
              className="w-full h-9 bg-white rounded-xl pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 border border-slate-300 focus:outline-none focus:border-sky-600 shadow-xs"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
            {filteredSessions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-500">No previous sessions found.</p>
              </div>
            ) : (
              filteredSessions.map((sess) => (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => onSelectSession(sess)}
                  className="w-full flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-sky-50 hover:border-sky-300 transition-colors cursor-pointer group shadow-2xs"
                >
                  <MessageSquare className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-sky-950">
                      {sess.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {sess.messages.length} msgs · {sess.timestamp}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Area: Active Transcript Feed */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Conversation Log
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            {messages.length === 0 && !interimUserText && !interimAssistantText ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  ገና ውይይት አልተጀመረም · No transcript yet
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Real-time voice and text exchanges will appear here as they happen, or tap a prompt below to start.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 text-left w-full max-w-md">
                  {AMHARIC_STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectStarterPrompt(item.amharic);
                        onClose();
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:bg-sky-50 hover:border-sky-300 cursor-pointer shadow-xs"
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
                        : 'bg-slate-50 border-slate-200 mr-6 sm:mr-16'
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
                  <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 border border-dashed border-slate-200 bg-slate-50 mr-6 sm:mr-16">
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
      </div>
    </div>
  );
}
