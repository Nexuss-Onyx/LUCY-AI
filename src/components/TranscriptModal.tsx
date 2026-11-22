import { X } from 'lucide-react';
import { TranscriptView, TranscriptMessage } from './TranscriptView';

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TranscriptMessage[];
  interimUserText: string;
  interimAssistantText: string;
  onClear: () => void;
  onSelectStarterPrompt: (promptText: string) => void;
}

export function TranscriptModal({
  isOpen,
  onClose,
  messages,
  interimUserText,
  interimAssistantText,
  onClear,
  onSelectStarterPrompt,
}: TranscriptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-[#FAFAFA] flex flex-col animate-in fade-in duration-200">
      {/* Top Navigation Subbar with Close X Icon at Top Right */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">
          Transcript · የውይይት መዝገብ
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transcript window"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Transcript Content Window */}
      <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto p-4 sm:p-6 overflow-hidden flex flex-col">
        <TranscriptView
          messages={messages}
          interimUserText={interimUserText}
          interimAssistantText={interimAssistantText}
          onClear={onClear}
          onSelectStarterPrompt={onSelectStarterPrompt}
        />
      </div>
    </div>
  );
}
