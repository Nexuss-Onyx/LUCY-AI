import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  InteractionStatus,
  LiveConnectConfig,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
} from '@google/genai';
import { LUCY_SYSTEM_INSTRUCTION } from './src/lib/prompts.ts';
import {
  estimateAudioChunkTokens,
  estimateTextTokens,
  FRONTIER_TIER_MODELS,
  TieredRateAwareRouter,
  TierModelConfig,
} from './src/lib/rateRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

interface StartSessionPayload {
  type: 'start';
  cycleStep?: number;
}

interface CycleModelPayload {
  type: 'cycle_model';
  cycleStep?: number;
}

interface AudioPayload {
  type: 'audio';
  data: string;
}

interface TextPayload {
  type: 'text';
  text: string;
}

interface StopPayload {
  type: 'stop';
}

type ClientWsMessage =
  | StartSessionPayload
  | CycleModelPayload
  | AudioPayload
  | TextPayload
  | StopPayload;

const globalRouter = new TieredRateAwareRouter(FRONTIER_TIER_MODELS);

function createGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Lucy AI voice service is not configured yet.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildLucyLiveConfig(tier: TierModelConfig): LiveConnectConfig {
  const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Zephyr',
        },
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: LUCY_SYSTEM_INSTRUCTION,
  };

  if (tier.supportsThinkingConfig) {
    config.thinkingConfig = {
      thinkingLevel: ThinkingLevel.MEDIUM,
    };
  }

  return config;
}

function sendSafe(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res, next) => {
      if (_req.path.startsWith('/api') || _req.path.startsWith('/live')) {
        return next();
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', (clientWs) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let activeTier: TierModelConfig | null = null;
    let sessionPromise: Promise<void> | null = null;
    let sessionGeneration = 0;
    let isClosing = false;
    let awaitingTurnResponse = false;
    let receivedTurnOutput = false;
    let lastPendingText: string | null = null;
    let failoverInProgress = false;

    const closeUpstream = () => {
      sessionGeneration += 1;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore teardown errors
        }
        liveSession = null;
      }
    };

    const dispatchTextToSession = (
      session: Awaited<ReturnType<GoogleGenAI['live']['connect']>>,
      text: string,
    ) => {
      try {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
      } catch {
        session.sendRealtimeInput({ text });
      }
    };

    const connectWithFailover = async (
      estimatedTokens: number,
      excludeIds: Set<string> = new Set(),
      replayText: string | null = null,
      preferredTier: TierModelConfig | null = null,
    ): Promise<void> => {
      const ai = createGenAIClient();
      let lastError: unknown = null;

      for (let attempt = 0; attempt < FRONTIER_TIER_MODELS.length; attempt++) {
        const tier =
          attempt === 0 && preferredTier && !excludeIds.has(preferredTier.id)
            ? preferredTier
            : globalRouter.selectModel({
                estimatedTokens,
                excludeIds,
              });
        excludeIds.add(tier.id);
        globalRouter.recordRequest(tier.id, estimatedTokens);

        const tryConnect = async (apiModelName: string) => {
          const config = buildLucyLiveConfig(tier);
          const myGeneration = ++sessionGeneration;
          let connectedSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>>;
          connectedSession = await ai.live.connect({
            model: apiModelName,
            config,
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                if (isClosing || myGeneration !== sessionGeneration) return;
                const content = message.serverContent;
                if (!content) return;

                if (content.interrupted) {
                  sendSafe(clientWs, { type: 'interrupted' });
                }

                if (content.interimInputTranscription?.text) {
                  sendSafe(clientWs, {
                    type: 'interim_input_transcript',
                    text: content.interimInputTranscription.text,
                  });
                }

                if (content.inputTranscription?.text) {
                  globalRouter.recordTokens(
                    tier.id,
                    estimateTextTokens(content.inputTranscription.text),
                  );
                  sendSafe(clientWs, {
                    type: 'input_transcript',
                    text: content.inputTranscription.text,
                  });
                }

                if (content.outputTranscription?.text) {
                  receivedTurnOutput = true;
                  globalRouter.recordTokens(
                    tier.id,
                    estimateTextTokens(content.outputTranscription.text),
                  );
                  sendSafe(clientWs, {
                    type: 'output_transcript',
                    text: content.outputTranscription.text,
                  });
                }

                for (const part of content.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    receivedTurnOutput = true;
                    globalRouter.recordTokens(
                      tier.id,
                      estimateAudioChunkTokens(part.inlineData.data.length),
                    );
                    sendSafe(clientWs, {
                      type: 'audio',
                      data: part.inlineData.data,
                    });
                  }
                  if (part.text) {
                    receivedTurnOutput = true;
                    globalRouter.recordTokens(tier.id, estimateTextTokens(part.text));
                    sendSafe(clientWs, {
                      type: 'output_text',
                      text: part.text,
                    });
                  }
                }

                if (content.interactionStatus) {
                  sendSafe(clientWs, {
                    type: 'interaction_status',
                    status:
                      content.interactionStatus === InteractionStatus.IN_PROGRESS
                        ? 'in_progress'
                        : 'idle',
                  });
                }

                if (content.turnComplete) {
                  awaitingTurnResponse = false;
                  lastPendingText = null;
                  sendSafe(clientWs, { type: 'turn_complete' });
                }
              },
              onerror: async () => {
                if (isClosing || failoverInProgress || myGeneration !== sessionGeneration) return;
                globalRouter.markErrorCooldown(tier.id);
                if (awaitingTurnResponse && !receivedTurnOutput && !failoverInProgress) {
                  failoverInProgress = true;
                  closeUpstream();
                  try {
                    await connectWithFailover(
                      estimatedTokens,
                      new Set([tier.id]),
                      lastPendingText,
                    );
                  } catch {
                    sendSafe(clientWs, {
                      type: 'error',
                      message: 'Lucy AI could not complete that response. Please try again.',
                    });
                  } finally {
                    failoverInProgress = false;
                  }
                } else {
                  sendSafe(clientWs, {
                    type: 'error',
                    message: 'Lucy AI voice connection was interrupted. Please try again.',
                  });
                }
              },
              onclose: async () => {
                if (isClosing || failoverInProgress || myGeneration !== sessionGeneration) return;
                if (awaitingTurnResponse && !receivedTurnOutput) {
                  failoverInProgress = true;
                  globalRouter.markErrorCooldown(tier.id);
                  liveSession = null;
                  try {
                    await connectWithFailover(
                      estimatedTokens,
                      new Set([tier.id]),
                      lastPendingText,
                    );
                    return;
                  } catch {
                    // Fall through to closed notice
                  } finally {
                    failoverInProgress = false;
                  }
                }
                sendSafe(clientWs, { type: 'closed' });
              },
            },
          });
          return connectedSession;
        };

        try {
          let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>>;
          try {
            session = await tryConnect(tier.apiModel);
          } catch (primaryErr) {
            if (tier.fallbackApiModel) {
              session = await tryConnect(tier.fallbackApiModel);
            } else {
              throw primaryErr;
            }
          }
          liveSession = session;
          activeTier = tier;
          if (replayText) {
            dispatchTextToSession(session, replayText);
          }
          return;
        } catch (err) {
          lastError = err;
          globalRouter.markErrorCooldown(tier.id);
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Lucy AI is temporarily unavailable. Please try again.');
    };

    const ensureCapacityForTurn = async (estimatedTokens: number) => {
      if (!activeTier || !liveSession) {
        await connectWithFailover(estimatedTokens);
        return;
      }
      if (!globalRouter.canServe(activeTier, estimatedTokens)) {
        const currentId = activeTier.id;
        isClosing = true;
        closeUpstream();
        isClosing = false;
        await connectWithFailover(estimatedTokens, new Set([currentId]));
      }
    };

    clientWs.on('message', async (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientWsMessage;
      } catch {
        sendSafe(clientWs, { type: 'error', message: 'Invalid message format.' });
        return;
      }

      if (msg.type === 'start') {
        isClosing = true;
        closeUpstream();
        isClosing = false;
        awaitingTurnResponse = false;
        receivedTurnOutput = false;
        lastPendingText = null;

        const cycleStep = typeof msg.cycleStep === 'number' ? msg.cycleStep : 0;
        const preferred = globalRouter.getTierByStep(cycleStep, {
          estimatedTokens: 400,
        });

        const startOp = (async () => {
          await connectWithFailover(400, new Set(), null, preferred);
          sendSafe(clientWs, { type: 'ready' });
        })();
        sessionPromise = startOp;
        try {
          await startOp;
        } catch {
          sendSafe(clientWs, {
            type: 'error',
            message: 'Lucy AI could not connect right now. Please try again in a moment.',
          });
        }
        return;
      }

      if (msg.type === 'cycle_model') {
        if (sessionPromise) {
          await sessionPromise.catch(() => {});
        }
        const currentId = activeTier?.id ?? null;
        const nextTier = globalRouter.selectNextTier(currentId, {
          estimatedTokens: 400,
        });
        const excludeIds = currentId ? new Set([currentId]) : new Set<string>();

        isClosing = true;
        closeUpstream();
        isClosing = false;
        awaitingTurnResponse = false;
        receivedTurnOutput = false;
        lastPendingText = null;

        const switchOp = connectWithFailover(400, excludeIds, null, nextTier).catch(() => {
          // Silent failover under the hood; keep session resilient without UI toast
        });
        sessionPromise = switchOp;
        await switchOp;
        return;
      }

      if (msg.type === 'audio') {
        if (sessionPromise) {
          await sessionPromise.catch(() => {});
        }
        const tokens = estimateAudioChunkTokens(msg.data.length);
        try {
          await ensureCapacityForTurn(tokens);
          if (!liveSession || !activeTier) return;
          globalRouter.recordTokens(activeTier.id, tokens);
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          sendSafe(clientWs, {
            type: 'error',
            message: 'Unable to stream audio right now. Please try again.',
          });
        }
        return;
      }

      if (msg.type === 'text') {
        if (sessionPromise) {
          await sessionPromise.catch(() => {});
        }
        const tokens = estimateTextTokens(msg.text);
        awaitingTurnResponse = true;
        receivedTurnOutput = false;
        lastPendingText = msg.text;

        try {
          await ensureCapacityForTurn(tokens);
          if (!liveSession || !activeTier) {
            throw new Error('No active session');
          }
          globalRouter.recordRequest(activeTier.id, tokens);
          dispatchTextToSession(liveSession, msg.text);
        } catch {
          if (activeTier) {
            globalRouter.markErrorCooldown(activeTier.id);
          }
          try {
            const exclude = activeTier ? new Set([activeTier.id]) : new Set<string>();
            isClosing = true;
            closeUpstream();
            isClosing = false;
            await connectWithFailover(tokens, exclude, msg.text);
          } catch {
            awaitingTurnResponse = false;
            sendSafe(clientWs, {
              type: 'error',
              message: 'Lucy AI could not respond right now. Please try again.',
            });
          }
        }
        return;
      }

      if (msg.type === 'stop') {
        isClosing = true;
        awaitingTurnResponse = false;
        closeUpstream();
        isClosing = false;
        sendSafe(clientWs, { type: 'closed' });
      }
    });

    clientWs.on('close', () => {
      isClosing = true;
      closeUpstream();
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Lucy AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Lucy AI server:', err);
  process.exit(1);
});
