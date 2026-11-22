import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeRmsAmplitude,
  downsampleFloat32,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from '../lib/audio';
import { mapRmsToVoiceEnergy } from '../lib/orbMath';
import type { OrbState } from '../components/LiveVoiceOrb';
import type { TranscriptMessage } from '../components/TranscriptView';

function formatNowTime(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function useLucyLiveSession() {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [interimUserText, setInterimUserText] = useState('');
  const [interimAssistantText, setInterimAssistantText] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const isMicActiveRef = useRef<boolean>(false);
  const interimUserRef = useRef<string>('');
  const interimAssistantRef = useRef<string>('');
  const pendingTextRef = useRef<string | null>(null);
  const cycleStepRef = useRef<number>(0);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    if (!isConnected) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isConnected]);

  const stopPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setOutputLevel(0);
  }, []);

  const stopMicCapture = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // Ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    setIsMicActive(false);
    setInputLevel(0);
  }, []);

  const flushAssistantTranscript = useCallback(() => {
    const finalAssistant = interimAssistantRef.current.trim();
    if (finalAssistant) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: finalAssistant,
          timestamp: formatNowTime(),
        },
      ]);
      interimAssistantRef.current = '';
      setInterimAssistantText('');
    }
  }, []);

  const flushUserTranscript = useCallback(() => {
    const finalUser = interimUserRef.current.trim();
    if (finalUser) {
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          text: finalUser,
          timestamp: formatNowTime(),
        },
      ]);
      interimUserRef.current = '';
      setInterimUserText('');
    }
  }, []);

  const playPcm24kChunk = useCallback((base64Pcm: string) => {
    const samples = pcm16Base64ToFloat32(base64Pcm);
    if (samples.length === 0) return;

    const rms = computeRmsAmplitude(samples);
    setOutputLevel(mapRmsToVoiceEnergy(rms));
    setOrbState('speaking');

    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
      audioBuffer.copyToChannel(new Float32Array(samples), 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      activeSourcesRef.current.add(source);

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          setOutputLevel(0);
          setOrbState(isMicActiveRef.current ? 'listening' : 'idle');
        }
      };
    } catch {
      // Ignore AudioContext playback failures in restricted/headless environments
    }
  }, []);

  const endSession = useCallback(() => {
    pendingTextRef.current = null;
    stopMicCapture();
    stopPlayback();
    flushUserTranscript();
    flushAssistantTranscript();

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    setIsConnected(false);
    setIsMuted(false);
    setOrbState('idle');
  }, [flushAssistantTranscript, flushUserTranscript, stopMicCapture, stopPlayback]);

  const startMicPipeline = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorBanner(
        'Microphone is unavailable in this browser. You can still type in Amharic below.',
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (event) => {
        if (isMutedRef.current) {
          setInputLevel(0);
          return;
        }
        const raw = event.inputBuffer.getChannelData(0);
        const resampled = downsampleFloat32(raw, inputCtx.sampleRate, 16000);
        const rms = computeRmsAmplitude(resampled);
        setInputLevel(mapRmsToVoiceEnergy(rms));

        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const base64 = float32ToPcm16Base64(resampled);
          ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      setIsMicActive(true);
      setOrbState('listening');
      return true;
    } catch {
      setErrorBanner(
        'Microphone access was denied. You can still type in Amharic below to talk with Lucy AI.',
      );
      return false;
    }
  }, []);

  const startSession = useCallback(
    async (
      options: { withMic?: boolean; initialText?: string; cycleStep?: number } = {
        withMic: true,
      },
    ) => {
      endSession();
      pendingTextRef.current = options.initialText ?? null;
      const requestedStep = options.cycleStep ?? 0;
      setErrorBanner(null);
      setOrbState('connecting');

      try {
        outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
        if (outputAudioCtxRef.current.state === 'suspended') {
          await outputAudioCtxRef.current.resume();
        }
      } catch {
        // Ignore AudioContext restriction in headless environments
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', cycleStep: requestedStep }));
      };

      ws.onmessage = async (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const msgType = data.type as string;
        if (msgType === 'ready') {
          setIsConnected(true);
          if (options.withMic) {
            const micOk = await startMicPipeline();
            if (!micOk) {
              setOrbState('idle');
            }
          } else {
            setOrbState('thinking');
          }

          if (pendingTextRef.current && ws.readyState === WebSocket.OPEN) {
            const queued = pendingTextRef.current;
            pendingTextRef.current = null;
            ws.send(JSON.stringify({ type: 'text', text: queued }));
          }
        } else if (msgType === 'audio' && typeof data.data === 'string') {
          flushUserTranscript();
          playPcm24kChunk(data.data);
        } else if (msgType === 'interim_input_transcript' && typeof data.text === 'string') {
          interimUserRef.current = data.text;
          setInterimUserText(data.text);
        } else if (msgType === 'input_transcript' && typeof data.text === 'string') {
          interimUserRef.current = (interimUserRef.current + ' ' + data.text).trim();
          setInterimUserText(interimUserRef.current);
        } else if (msgType === 'output_transcript' && typeof data.text === 'string') {
          flushUserTranscript();
          interimAssistantRef.current = (interimAssistantRef.current + data.text).trimStart();
          setInterimAssistantText(interimAssistantRef.current);
        } else if (msgType === 'output_text' && typeof data.text === 'string') {
          flushUserTranscript();
          interimAssistantRef.current = (interimAssistantRef.current + data.text).trimStart();
          setInterimAssistantText(interimAssistantRef.current);
        } else if (msgType === 'interaction_status') {
          if (data.status === 'in_progress') {
            setOrbState((prev) => (prev === 'speaking' ? prev : 'thinking'));
          } else if (data.status === 'idle') {
            flushAssistantTranscript();
            if (activeSourcesRef.current.size === 0) {
              setOrbState(isMicActiveRef.current ? 'listening' : 'idle');
            }
          }
        } else if (msgType === 'turn_complete') {
          flushUserTranscript();
          flushAssistantTranscript();
          if (activeSourcesRef.current.size === 0) {
            setOrbState(isMicActiveRef.current ? 'listening' : 'idle');
          }
        } else if (msgType === 'interrupted') {
          stopPlayback();
          flushAssistantTranscript();
          setOrbState(isMicActiveRef.current ? 'listening' : 'idle');
        } else if (msgType === 'error' && typeof data.message === 'string') {
          setErrorBanner(data.message);
          setOrbState(isMicActiveRef.current ? 'listening' : 'idle');
        } else if (msgType === 'closed') {
          flushUserTranscript();
          flushAssistantTranscript();
          setIsConnected(false);
          setOrbState('idle');
        }
      };

      ws.onerror = () => {
        setErrorBanner('Connection error. Please check your network and try again.');
        setIsConnected(false);
        setOrbState('idle');
      };

      ws.onclose = () => {
        setIsConnected(false);
        stopMicCapture();
        if (activeSourcesRef.current.size === 0) {
          setOrbState('idle');
        }
      };
    },
    [
      endSession,
      flushAssistantTranscript,
      flushUserTranscript,
      playPcm24kChunk,
      startMicPipeline,
      stopMicCapture,
      stopPlayback,
    ],
  );

  const sendTextPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setErrorBanner(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          text: trimmed,
          timestamp: formatNowTime(),
        },
      ]);

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
        setOrbState('thinking');
        ws.send(JSON.stringify({ type: 'text', text: trimmed }));
        return;
      }

      await startSession({ withMic: false, initialText: trimmed });
    },
    [isConnected, startSession],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const clearTranscript = useCallback(() => {
    setMessages([]);
    interimUserRef.current = '';
    interimAssistantRef.current = '';
    setInterimUserText('');
    setInterimAssistantText('');
  }, []);

  const triggerRecordWithModelSwitch = useCallback(async () => {
    cycleStepRef.current += 1;
    const nextStep = cycleStepRef.current;
    const ws = wsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
      ws.send(JSON.stringify({ type: 'cycle_model', cycleStep: nextStep }));
      if (!isMicActiveRef.current) {
        await startMicPipeline();
      } else if (isMutedRef.current) {
        setIsMuted(false);
      }
      return;
    }

    await startSession({ withMic: true, cycleStep: nextStep });
  }, [isConnected, startMicPipeline, startSession]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return {
    orbState,
    isConnected,
    isMicActive,
    isMuted,
    inputLevel,
    outputLevel,
    elapsedSeconds,
    errorBanner,
    dismissError: () => setErrorBanner(null),
    messages,
    interimUserText,
    interimAssistantText,
    startSession,
    endSession,
    sendTextPrompt,
    toggleMute,
    triggerRecordWithModelSwitch,
    clearTranscript,
  };
}
