import { Plus, X, Search, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TranscriptMessage } from './TranscriptView';

interface SessionRecord {
  id: string;
  title: string;
  timestamp: string;
  messages: TranscriptMessage[];
}

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionRecord[];
  onSelectSession: (session: SessionRecord) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function HistorySidebar({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
        onClick={onClose}
        aria-label="Close sidebar backdrop"
      />

      {/* Sidebar Panel sliding from left to right */}
      <div className="relative w-80 sm:w-96 h-full bg-white shadow-2xl border-r border-slate-200 flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900">Chat History · የውይይት ታሪክ</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onNewSession();
                onClose();
              }}
              title="New Chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search at top */}
        <div className="p-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat history…"
              className="w-full h-9 bg-slate-50 rounded-xl pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-sky-600"
            />
          </div>
        </div>

        {/* List of chat threads separated by dividers */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 flex flex-col divide-y divide-slate-100">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No saved chat threads yet.
            </div>
          ) : (
            filteredSessions.map((sess) => (
              <div
                key={sess.id}
                className="py-3 flex items-center justify-between gap-2 group hover:bg-sky-50/50 rounded-xl px-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(sess);
                    onClose();
                  }}
                  className="flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {sess.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {sess.messages.length} messages · {sess.timestamp}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(sess.id);
                  }}
                  title="Delete chat thread"
                  aria-label="Delete chat thread"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
