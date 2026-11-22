# Gemini Live API voice model rate limits

Peak usage per model compared with its limit over the last 28 days. Limits below are recorded as provided.

| Model | Category | RPM (peak / limit) | TPM (peak / limit) | RPD (peak / limit) | Live API endpoint |
|---|---|---:|---:|---:|---|
| Gemini 2.5 Flash Native Audio Dialog | Live API | 0 / Unlimited | 0 / 1M | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3 Flash Live | Live API | 0 / Unlimited | 0 / 65K | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3.5 Live Translate | Live API | 0 / Unlimited | 0 / 20K | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3.5 Transcribe | Live API | 0 / 3 | 0 / 10K | 0 / 25 | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3.5 Transcribe Live | Live API | 0 / Unlimited | 0 / 20K | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3.8 Live | Live API | 0 / Unlimited | 0 / 65K | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |
| Gemini 3.8 Live Extended Thinking | Live API | 0 / Unlimited | 0 / 65K | 0 / Unlimited | `WSS wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` |

For Live API, the model is selected in the initial WebSocket `setup` message rather than in the URL path. See Google's [Live API endpoint reference](https://aistudio.google.com/api-reference/live/bidi-generate-content).
