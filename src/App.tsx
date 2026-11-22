import { FormEvent, useState } from 'react';
import {
  AlertCircle,
  FileText,
  History,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LiveVoiceOrb } from './components/LiveVoiceOrb';
import { TranscriptView } from './components/TranscriptView';
import { useLucyLiveSession } from './hooks/useLucyLiveSession';

type ActiveTab = 'live' | 'transcript';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [textInput, setTextInput] = useState<string>('');

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

  const handleToggleLive = () => {
    if (isConnected) {
      endSession();
    } else {
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
    setActiveTab('live');
    sendTextPrompt(promptText);
  };

  const latestCaption =
    interimAssistantText ||
    interimUserText ||
    (messages.length > 0 ? messages[messages.length - 1].text : '');

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col bg-[#FAFAFA] text-slate-900">
      {/* Minimal Header with ሉሲ AI brand and Centered Navigation */}
      <header className="shrink-0 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('live');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ሉሲ AI <span className="text-slate-500 font-normal">· Lucy</span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'live'
                  ? 'border-sky-700 text-slate-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
            >
              Voice
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === 'transcript'
                  ? 'border-sky-700 text-slate-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Transcript{messages.length > 0 ? ` (${messages.length})` : ''}</span>
            </button>
          </nav>

          <button
            type="button"
            onClick={handleToggleLive}
            className={`h-9 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs ${
              isConnected
                ? 'bg-red-700 text-white hover:bg-red-800'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isConnected ? 'End' : 'Start Live'}
          </button>
        </div>
      </header>

      {/* Main Zero-Scroll Viewport with Maximum Prominent Morph Orb */}
      <main className="flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 py-2 sm:py-3 gap-2 overflow-hidden">
        <AnimatePresence>
          {errorBanner && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              role="alert"
              className="w-full max-w-xl mx-auto shrink-0 flex items-center justify-between gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-950"
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

        {activeTab === 'live' && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-between gap-2 py-1">
            {/* Extremely Prominent Pure Morph Center Stage */}
            <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-3 text-center overflow-hidden">
              <LiveVoiceOrb
                state={orbState}
                inputLevel={inputLevel}
                outputLevel={outputLevel}
                onClick={handleToggleLive}
              />

              <AnimatePresence mode="wait">
                {latestCaption && (
                  <motion.div
                    key={latestCaption.slice(0, 24)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="max-w-lg w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] shrink-0"
                  >
                    <p className="text-sm text-slate-900 leading-relaxed line-clamp-2">
                      {latestCaption}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Clean Bottom Voice Dock with History Icon & Amharic Input */}
            <div className="w-full max-w-xl shrink-0 flex flex-col items-center gap-2.5 pt-1">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={triggerRecordWithModelSwitch}
                  aria-label="Record voice"
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-95 cursor-pointer shadow-sm ${
                    isConnected && isMicActive
                      ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                      : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleToggleLive}
                  aria-label={isConnected ? 'End live voice session' : 'Start live voice session'}
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                    isConnected
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-sky-700 hover:bg-sky-800'
                  }`}
                >
                  {isConnected ? <PhoneOff className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('transcript')}
                  aria-label="Open conversation history"
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 shadow-sm transition-colors cursor-pointer"
                >
                  <History className="h-4 w-4" />
                  {messages.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-700 text-[10px] font-bold text-white shadow-xs">
                      {messages.length}
                    </span>
                  )}
                </button>
              </div>

              <form
                onSubmit={handleSubmitText}
                className="w-full flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-sky-700"
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
                  className="flex-1 h-9 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  aria-label="Send Amharic message"
                  className="inline-flex items-center justify-center h-9 px-4 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:border disabled:border-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="flex-1 min-h-0">
            <TranscriptView
              messages={messages}
              interimUserText={interimUserText}
              interimAssistantText={interimAssistantText}
              onClear={clearTranscript}
              onSelectStarterPrompt={handleStarterPrompt}
            />
          </div>
        )}
      </main>
    </div>
  );
}
