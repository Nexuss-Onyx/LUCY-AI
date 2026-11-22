export interface CircularMorphParams {
  baseRadius: number;
  angle: number;
  phase: number;
  /** Normalized vocal/audio strength in [0, 1] */
  energy: number;
  /** Reduced-motion accessibility flag */
  reducedMotion?: boolean;
}

/**
 * Maps raw PCM RMS amplitude [0, 1] to perceptual vocal strength [0, 1]
 * with a soft ambient noise gate so silence stays calm while speech drives
 * prominent circular morphing.
 */
export function mapRmsToVoiceEnergy(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0.006) {
    return 0;
  }
  const normalized = (rms - 0.006) * 5.8;
  return Math.min(1, Math.max(0, Math.pow(normalized, 0.78)));
}

/**
 * Computes the continuous circular wavelength radius at a given polar angle.
 * Integer angular harmonics (2θ, 3θ, 4θ, 5θ) guarantee a seamless closed loop
 * around the circle while scaling displacement directly with vocal strength.
 */
export function computeCircularMorphRadius({
  baseRadius,
  angle,
  phase,
  energy,
  reducedMotion = false,
}: CircularMorphParams): number {
  if (reducedMotion) {
    return baseRadius;
  }
  const clampedEnergy = Math.min(1, Math.max(0, energy));

  // Calm baseline circular drift when idle/silent
  const calmDrift =
    Math.sin(angle * 2 + phase * 0.75) * 1.1 +
    Math.cos(angle * 3 - phase * 0.55) * 0.85;

  // Prominent circular ChatGPT-style multi-harmonic wavelength deformation driven by voice strength
  const strengthWave =
    clampedEnergy *
    (Math.sin(angle * 2 + phase * 1.15) * 8.5 +
      Math.cos(angle * 3 - phase * 1.65) * 7.2 +
      Math.sin(angle * 4 + phase * 2.25) * 4.8 +
      Math.cos(angle * 5 - phase * 2.85) * 3.1);

  return baseRadius + calmDrift + strengthWave;
}

/**
 * Computes the phase speed per animation frame based on current orb state
 * and vocal strength so stronger speech noticeably energizes circular motion.
 */
export function computePhaseSpeed(
  state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking',
  energy: number,
  reducedMotion: boolean = false,
): number {
  if (reducedMotion) return 0.008;
  const clamped = Math.min(1, Math.max(0, energy));
  if (state === 'speaking' || state === 'listening') {
    return 0.018 + clamped * 0.088;
  }
  if (state === 'thinking') {
    return 0.042;
  }
  if (state === 'connecting') {
    return 0.032;
  }
  return 0.014;
}
