import { useEffect, useRef } from 'react';
import { computeCircularMorphRadius, computePhaseSpeed } from '../lib/orbMath';

export type OrbState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface LiveVoiceOrbProps {
  state: OrbState;
  inputLevel: number;
  outputLevel: number;
  onClick?: () => void;
  disabled?: boolean;
}

export function LiveVoiceOrb({
  state,
  inputLevel,
  outputLevel,
  onClick,
  disabled = false,
}: LiveVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const inputLevelRef = useRef<number>(inputLevel);
  const outputLevelRef = useRef<number>(outputLevel);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    inputLevelRef.current = inputLevel;
  }, [inputLevel]);

  useEffect(() => {
    outputLevelRef.current = outputLevel;
  }, [outputLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let phase = 0;
    let smoothEnergy = 0;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = 520; // High resolution canvas for maximum crispness
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const currentState = stateRef.current;
      const rawEnergy =
        currentState === 'speaking'
          ? Math.max(0.22, outputLevelRef.current)
          : currentState === 'listening'
            ? inputLevelRef.current
            : currentState === 'thinking'
              ? 0.32
              : currentState === 'connecting'
                ? 0.18
                : 0;

      const lerpRate = rawEnergy > smoothEnergy ? 0.36 : 0.12;
      smoothEnergy += (rawEnergy - smoothEnergy) * lerpRate;

      const speed = computePhaseSpeed(currentState, smoothEnergy, prefersReducedMotion);
      phase += speed;

      const cx = size / 2;
      const cy = size / 2;
      const idleBreath = prefersReducedMotion ? 0 : Math.sin(phase * 0.85) * 2.2;
      const baseRadius = 138 + smoothEnergy * 32 + idleBreath;

      // Soft ambient aura around the pure morph structure
      const haloRadius = baseRadius * (1.42 + smoothEnergy * 0.3);
      const haloGradient = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.6,
        cx,
        cy,
        haloRadius,
      );
      if (currentState === 'speaking') {
        haloGradient.addColorStop(0, `rgba(2, 132, 199, ${(0.26 + smoothEnergy * 0.22).toFixed(3)})`);
        haloGradient.addColorStop(0.55, `rgba(56, 189, 248, ${(0.1 + smoothEnergy * 0.14).toFixed(3)})`);
        haloGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else if (currentState === 'listening') {
        haloGradient.addColorStop(0, `rgba(14, 165, 233, ${(0.18 + smoothEnergy * 0.28).toFixed(3)})`);
        haloGradient.addColorStop(0.58, `rgba(56, 189, 248, ${(0.08 + smoothEnergy * 0.15).toFixed(3)})`);
        haloGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else if (currentState === 'thinking') {
        haloGradient.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
        haloGradient.addColorStop(0.58, 'rgba(59, 130, 246, 0.1)');
        haloGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        haloGradient.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
        haloGradient.addColorStop(0.65, 'rgba(186, 230, 253, 0.05)');
        haloGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }

      ctx.fillStyle = haloGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // Concentric wavelength ripples during active voice
      const showWaves =
        currentState === 'connecting' ||
        currentState === 'speaking' ||
        (currentState === 'listening' && smoothEnergy > 0.05);

      if (showWaves && !prefersReducedMotion) {
        const waveCount = smoothEnergy > 0.32 ? 2 : 1;
        for (let w = 0; w < waveCount; w++) {
          const ringProgress = (phase * 0.26 + w * 0.48) % 1;
          const ringRadius = baseRadius + 6 + ringProgress * (22 + smoothEnergy * 36);
          const ringAlpha =
            (1 - ringProgress) *
            (currentState === 'connecting' ? 0.22 : 0.16 + smoothEnergy * 0.36);
          ctx.strokeStyle = `rgba(2, 132, 199, ${ringAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.6 + smoothEnergy * 1.6;
          ctx.beginPath();
          const ringPoints = 120;
          for (let i = 0; i <= ringPoints; i++) {
            const angle = (i / ringPoints) * Math.PI * 2;
            const rippleOffset =
              smoothEnergy *
              (Math.sin(angle * 4 + phase * 1.7 + w) * 4.2 +
                Math.cos(angle * 3 - phase * 1.3) * 3);
            const rr = ringRadius + rippleOffset;
            const rx = cx + Math.cos(angle) * rr;
            const ry = cy + Math.sin(angle) * rr;
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Main pure morph contour (no rigid circle background; organic fluid shape)
      const points = 144;
      const drawPureMorphPath = (radiusScale: number) => {
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const r = computeCircularMorphRadius({
            baseRadius: baseRadius * radiusScale,
            angle,
            phase,
            energy: smoothEnergy,
            reducedMotion: prefersReducedMotion,
          });
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      ctx.save();
      drawPureMorphPath(1);
      ctx.clip();

      // Spherical fluid gradient inside the pure morph shape
      const driftX = Math.cos(phase * 0.6) * (8 + smoothEnergy * 12);
      const driftY = Math.sin(phase * 0.5) * (8 + smoothEnergy * 12);
      const morphGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.22 + driftX,
        cy - baseRadius * 0.26 + driftY,
        baseRadius * 0.1,
        cx + baseRadius * 0.16,
        cy + baseRadius * 0.2,
        baseRadius * 1.28,
      );

      if (currentState === 'thinking') {
        morphGrad.addColorStop(0, '#F0F9FF');
        morphGrad.addColorStop(0.28, '#7DD3FC');
        morphGrad.addColorStop(0.64, '#0284C7');
        morphGrad.addColorStop(1, '#1E40AF');
      } else if (currentState === 'speaking') {
        morphGrad.addColorStop(0, '#FFFFFF');
        morphGrad.addColorStop(0.24, '#BAE6FD');
        morphGrad.addColorStop(0.6, '#0EA5E9');
        morphGrad.addColorStop(1, '#0369A1');
      } else if (currentState === 'listening') {
        morphGrad.addColorStop(0, '#FFFFFF');
        morphGrad.addColorStop(0.28, '#E0F2FE');
        morphGrad.addColorStop(0.62, '#38BDF8');
        morphGrad.addColorStop(1, '#0284C7');
      } else {
        morphGrad.addColorStop(0, '#FFFFFF');
        morphGrad.addColorStop(0.35, '#E0F2FE');
        morphGrad.addColorStop(0.72, '#7DD3FC');
        morphGrad.addColorStop(1, '#0EA5E9');
      }

      ctx.fillStyle = morphGrad;
      ctx.fillRect(0, 0, size, size);

      // Internal fluid lobes that swirl dynamically with voice energy
      const swirlRadius = baseRadius * (0.22 + smoothEnergy * 0.16);
      for (let lobe = 0; lobe < 4; lobe++) {
        const lobeAngle =
          phase * (0.42 + lobe * 0.16 + smoothEnergy * 0.22) + (lobe * Math.PI) / 2;
        const lx = cx + Math.cos(lobeAngle) * swirlRadius;
        const ly = cy + Math.sin(lobeAngle * 1.12) * (swirlRadius * 0.88);
        const lobeSize = baseRadius * (0.72 + smoothEnergy * 0.18);
        const lobeGrad = ctx.createRadialGradient(lx, ly, 4, lx, ly, lobeSize);
        lobeGrad.addColorStop(
          0,
          lobe === 0
            ? 'rgba(255, 255, 255, 0.86)'
            : lobe === 1
              ? 'rgba(186, 230, 253, 0.64)'
              : lobe === 2
                ? 'rgba(56, 189, 248, 0.46)'
                : 'rgba(2, 132, 199, 0.32)',
        );
        lobeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = lobeGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, lobeSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Crisp outer contour rim highlight
      drawPureMorphPath(1);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.8 + smoothEnergy * 0.2).toFixed(2)})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.restore();
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const stateAriaLabel: Record<OrbState, string> = {
    idle: 'Start live Amharic voice session with Lucy AI',
    connecting: 'Connecting to Lucy AI voice session',
    listening: 'Lucy AI is listening to your voice',
    thinking: 'Lucy AI is thinking',
    speaking: 'Lucy AI is speaking in Amharic',
  };

  return (
    <div
      className="relative flex items-center justify-center shrink-0 w-full"
      data-testid="lucy-voice-orb-container"
      data-orb-state={state}
      data-voice-energy={(state === 'speaking' ? outputLevel : inputLevel).toFixed(2)}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={stateAriaLabel[state]}
        className="group relative flex h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] md:h-[420px] md:w-[420px] lg:h-[460px] lg:w-[460px] [@media(max-height:750px)]:h-[250px] [@media(max-height:750px)]:w-[250px] items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700 disabled:cursor-not-allowed cursor-pointer transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
      >
        <canvas
          ref={canvasRef}
          data-testid="lucy-voice-orb"
          className="h-full w-full pointer-events-none drop-shadow-[0_12px_40px_rgba(2,132,199,0.22)]"
        />
      </button>
    </div>
  );
}
