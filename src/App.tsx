import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Keyboard,
  Menu,
  Phone,
  PhoneOff,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LiveVoiceOrb } from './components/LiveVoiceOrb';
import { TranscriptAndHistoryView, TranscriptMessage } from './components/TranscriptAndHistoryView';
import { useLucyLiveSession } from './hooks/useLucyLiveSession';

interface SessionRecord {
  id: string;
  title: string;
  timestamp: string;
  messages: TranscriptMessage[];
}

export default function App() {
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [showKeyboardInput, setShowKeyboardInput] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [floatingTranscripts, setFloatingTranscripts] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string }>
  >([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const {
    orbState,
    isConnected,
    isMicActive,
    isMuted,
    inputLevel,
    outputLevel,
    errorBanner,
    dismissError,
    messages,
    interimUserText,
    interimAssistantText,
    startSession,
    endSession,
    sendTextPrompt,
    triggerRecordWithModelSwitch,
    clearTranscript,
  } = useLucyLiveSession();

  // Archive current messages into floating TikTok-style scrolling feed items
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    setFloatingTranscripts((prev) => {
      if (prev.some((p) => p.id === latest.id)) return prev;
      return [...prev.slice(-4), { id: latest.id, role: latest.role, text: latest.text }];
    });
  }, [messages]);

  // Clean floating text after silence
  useEffect(() => {
    if (orbState === 'listening' || orbState === 'idle') {
      const timer = window.setTimeout(() => {
        setFloatingTranscripts([]);
      }, 7000);
      return () => window.clearTimeout(timer);
    }
  }, [orbState]);

  const handleStartNewSession = () => {
    if (messages.length > 0) {
      const newSession: SessionRecord = {
        id: `sess-${Date.now()}`,
        title: messages[0].text.slice(0, 32) + (messages[0].text.length > 32 ? '…' : ''),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: [...messages],
      };
      setSessions((prev) => [newSession, ...prev]);
    }
    clearTranscript();
    setFloatingTranscripts([]);
    if (isConnected) {
      startSession({ withMic: true });
    }
  };

  const handleSubmitText = (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextPrompt(textInput);
    setTextInput('');
  };

  const handleStarterPrompt = (promptText: string) => {
    sendTextPrompt(promptText);
  };

  const handleSelectSession = (session: SessionRecord) => {
    if (messages.length > 0) {
      const currentRec: SessionRecord = {
        id: `sess-${Date.now()}`,
        title: messages[0].text.slice(0, 32) + (messages[0].text.length > 32 ? '…' : ''),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: [...messages],
      };
      setSessions((prev) => [currentRec, ...prev]);
    }
    clearTranscript();
    for (const m of session.messages) {
      messages.push(m);
    }
    setFloatingTranscripts(
      session.messages.slice(-4).map((m) => ({ id: m.id, role: m.role, text: m.text })),
    );
  };

  const activeCaption =
    interimAssistantText ||
    interimUserText ||
    (floatingTranscripts.length > 0 ? floatingTranscripts[floatingTranscripts.length - 1].text : '');

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col bg-[#FAFAFA] text-slate-950 relative">
      {/* Top Header: Hamburger on left, Centered ሉሲ AI brand, + and History on the right */}
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTranscript(true)}
              aria-label="Open transcript and history sidebar"
              title="Menu / History"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 text-center">
            ሉሲ AI
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartNewSession}
              aria-label="Start new session"
              title="Start new session (+)"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 text-white hover:bg-sky-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowTranscript(true)}
              aria-label="Open transcript"
              title="History"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
            >
              <FileText className="h-4 w-4 text-sky-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Zero-Scroll Viewport taking 3/4+ space for the Prominent Pure Morph */}
      <main className="flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto px-4 py-2 gap-2 overflow-hidden relative">
        <AnimatePresence>
          {errorBanner && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              role="alert"
              className="w-full max-w-xl mx-auto z-20 shrink-0 flex items-center justify-between gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-950 shadow-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-amber-800 shrink-0" />
                <span className="truncate">{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={dismissError}
                aria-label="Dismiss notice"
                className="text-amber-900 hover:text-amber-950 p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TikTok-style Floating Real-Time Subtitles / Captions */}
        <div className="absolute inset-x-6 bottom-28 z-10 pointer-events-none flex flex-col items-center gap-2 overflow-hidden max-h-40">
          <AnimatePresence>
            {activeCaption && (
              <motion.div
                key={activeCaption.slice(0, 24)}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md w-full rounded-2xl border border-white/80 bg-white/85 backdrop-blur-md px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] text-center pointer-events-auto"
              >
                <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed line-clamp-3">
                  {activeCaption}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prominent Pure Morph Center Stage taking 3/4 space */}
        <div className="flex-[3] min-h-0 w-full flex flex-col items-center justify-center relative overflow-hidden">
          <LiveVoiceOrb
            state={orbState}
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            onClick={() => {
              if (isConnected) {
                endSession();
              } else {
                startSession({ withMic: true });
              }
            }}
          />
        </div>

        {/* Bottom Dock: Transcript Icon, Call/End, and Keyboard Toggle */}
        <div className="shrink-0 w-full max-w-xl mx-auto flex flex-col items-center gap-2.5 pb-2 z-20">
          {showKeyboardInput && (
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSubmitText}
              className="w-full flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-lg focus-within:border-sky-700"
            >
              <label htmlFor="amharic-text-input" className="sr-only">
                Message Lucy AI in Amharic
              </label>
              <input
                id="amharic-text-input"
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="በአማርኛ ይጻፉ… (Message Lucy AI in Amharic)"
                className="flex-1 h-10 bg-transparent px-3 text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none min-w-0"
                autoFocus
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                aria-label="Send Amharic message"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-950 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4 mr-1.5" />
                <span>Send</span>
              </button>
            </motion.form>
          )}

          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setShowTranscript(true)}
              aria-label="Open transcript"
              title="Transcript"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 shadow-sm transition-all cursor-pointer"
            >
              <FileText className="h-5 w-5 text-sky-700" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (isConnected) {
                  endSession();
                } else {
                  startSession({ withMic: true });
                }
              }}
              aria-label={isConnected ? 'End session' : 'Start live voice session'}
              className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                isConnected ? 'bg-red-700 hover:bg-red-800' : 'bg-sky-700 hover:bg-sky-800'
              }`}
            >
              {isConnected ? <PhoneOff className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </button>

            <button
              type="button"
              onClick={() => setShowKeyboardInput((prev) => !prev)}
              aria-label={showKeyboardInput ? 'Hide keyboard input' : 'Show keyboard input'}
              title="Keyboard input"
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all shadow-sm cursor-pointer ${
                showKeyboardInput
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400'
              }`}
            >
              <Keyboard className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Full-Screen Central Slide-Up Transcript & History View with Close X under top navigation */}
        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-50 bg-[#FAFAFA] flex flex-col"
            >
              <TranscriptAndHistoryView
                messages={messages}
                interimUserText={interimUserText}
                interimAssistantText={interimAssistantText}
                onClear={clearTranscript}
                onSelectStarterPrompt={handleStarterPrompt}
                onNewSession={handleStartNewSession}
                sessions={sessions}
                onSelectSession={handleSelectSession}
                onClose={() => setShowTranscript(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
