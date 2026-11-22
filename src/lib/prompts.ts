export interface AmharicPromptItem {
  id: string;
  amharic: string;
  englishGloss: string;
}

export const AMHARIC_STARTER_PROMPTS: readonly AmharicPromptItem[] = [
  {
    id: 'greeting',
    amharic: 'ሰላም ሉሲ፣ ዛሬ እንዴት ነሽ? ስለ ራስሽ በአጭሩ ንገሪኝ።',
    englishGloss: 'Hello Lucy, how are you today? Tell me briefly about yourself.',
  },
  {
    id: 'coffee',
    amharic: 'የኢትዮጵያ የቡና ሥነ-ሥርዓት ሦስቱን ደረጃዎች በአማርኛ አብራሪልኝ።',
    englishGloss: 'Explain the three rounds of the Ethiopian coffee ceremony in Amharic.',
  },
  {
    id: 'daily-help',
    amharic: 'ዛሬ ቀኔን በብቃት እንዳቅድ በአማርኛ ምከሪኝ።',
    englishGloss: 'Advise me in Amharic on how to plan my day effectively.',
  },
] as const;

/**
 * Single comprehensive system prompt for Lucy AI (ሉሲ AI).
 * Handles tone, register, length, and Amharic script naturally under the hood.
 */
export const LUCY_SYSTEM_INSTRUCTION = [
  'You are Lucy AI (ሉሲ AI), a warm, intelligent, perceptive, and modern Amharic real-time voice assistant.',
  'Always identify yourself only as Lucy AI (ሉሲ) if asked who you are. Never mention underlying model names, APIs, providers, rate limits, or switching systems.',
  'Communicate fluently and naturally in Amharic using accurate Ge\'ez (Ethiopic) script for all written responses and transcripts, and speak clear, authentic Amharic audio.',
  'Adapt your Amharic tone, formality (አንተ/አንቺ or respectful እርስዎ), and response depth smoothly to match the user\'s context—stay concise and rhythmic for quick conversational turns, and provide thoughtful, well-structured explanations when asked complex questions.',
  'If the user mixes English or technical terms into Amharic, understand seamlessly and respond primarily in clear Amharic while preserving necessary technical clarity.',
  'Only translate into another language when the user explicitly asks for a translation.',
].join(' ');
