/**
 * Under-the-hood RPM, TPM, and RPD aware tiered model router for Lucy AI.
 * Always selects the highest-capability tier (Gemini 3.8 Live by default) and
 * only steps down to a smaller capable tier when a quota is about to be exceeded
 * or when an unexpected upstream rate-limit/error occurs.
 */

export interface TierModelConfig {
  id: string;
  apiModel: string;
  fallbackApiModel?: string;
  tierOrder: number;
  /** Maximum requests per minute (null = unlimited) */
  rpmLimit: number | null;
  /** Maximum tokens per minute (null = unlimited) */
  tpmLimit: number | null;
  /** Maximum requests per day (null = unlimited) */
  rpdLimit: number | null;
  supportsThinkingConfig: boolean;
}

export const FRONTIER_TIER_MODELS: readonly TierModelConfig[] = [
  {
    id: 'gemini-3.8-live',
    apiModel: 'gemini-3.8-live',
    tierOrder: 1,
    rpmLimit: null,
    tpmLimit: 65_000,
    rpdLimit: null,
    supportsThinkingConfig: false,
  },
  {
    id: 'gemini-3.8-live-extended-thinking',
    apiModel: 'gemini-3.8-live-extended-thinking',
    tierOrder: 2,
    rpmLimit: null,
    tpmLimit: 65_000,
    rpdLimit: null,
    supportsThinkingConfig: true,
  },
  {
    id: 'gemini-3-flash-live',
    apiModel: 'gemini-3.1-flash-live-preview',
    fallbackApiModel: 'gemini-3.8-live',
    tierOrder: 3,
    rpmLimit: null,
    tpmLimit: 65_000,
    rpdLimit: null,
    supportsThinkingConfig: false,
  },
  {
    id: 'gemini-2.5-flash-native-audio-dialog',
    apiModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
    fallbackApiModel: 'gemini-2.5-flash-preview-native-audio-dialog',
    tierOrder: 4,
    rpmLimit: null,
    tpmLimit: 1_000_000,
    rpdLimit: null,
    supportsThinkingConfig: false,
  },
] as const;

interface TokenEntry {
  timestamp: number;
  tokens: number;
}

interface ModelUsageWindow {
  minuteRequests: number[];
  dayRequests: number[];
  minuteTokens: TokenEntry[];
  cooldownUntil: number;
}

export interface RouterSelectionOptions {
  estimatedTokens?: number;
  excludeIds?: ReadonlySet<string>;
  now?: number;
}

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 86_400_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export class TieredRateAwareRouter {
  private readonly tiers: readonly TierModelConfig[];
  private readonly usage = new Map<string, ModelUsageWindow>();

  constructor(tiers: readonly TierModelConfig[] = FRONTIER_TIER_MODELS) {
    this.tiers = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);
  }

  private getWindow(modelId: string, now: number): ModelUsageWindow {
    let win = this.usage.get(modelId);
    if (!win) {
      win = {
        minuteRequests: [],
        dayRequests: [],
        minuteTokens: [],
        cooldownUntil: 0,
      };
      this.usage.set(modelId, win);
    }
    const minuteCutoff = now - ONE_MINUTE_MS;
    const dayCutoff = now - ONE_DAY_MS;
    win.minuteRequests = win.minuteRequests.filter((ts) => ts > minuteCutoff);
    win.dayRequests = win.dayRequests.filter((ts) => ts > dayCutoff);
    win.minuteTokens = win.minuteTokens.filter((entry) => entry.timestamp > minuteCutoff);
    return win;
  }

  public getCurrentUsage(modelId: string, now: number = Date.now()) {
    const win = this.getWindow(modelId, now);
    const tpm = win.minuteTokens.reduce((sum, entry) => sum + entry.tokens, 0);
    return {
      rpm: win.minuteRequests.length,
      tpm,
      rpd: win.dayRequests.length,
      inCooldown: win.cooldownUntil > now,
    };
  }

  /**
   * Checks whether sending `estimatedTokens` + 1 request would stay within
   * the model's RPM, TPM, and RPD limits (switching proactively right before exceeding).
   */
  public canServe(
    tier: TierModelConfig,
    estimatedTokens: number = 0,
    now: number = Date.now(),
  ): boolean {
    const win = this.getWindow(tier.id, now);
    if (win.cooldownUntil > now) {
      return false;
    }
    if (tier.rpmLimit !== null && win.minuteRequests.length + 1 > tier.rpmLimit) {
      return false;
    }
    if (tier.rpdLimit !== null && win.dayRequests.length + 1 > tier.rpdLimit) {
      return false;
    }
    if (tier.tpmLimit !== null) {
      const currentTpm = win.minuteTokens.reduce((sum, e) => sum + e.tokens, 0);
      if (currentTpm + estimatedTokens > tier.tpmLimit) {
        return false;
      }
    }
    return true;
  }

  /**
   * Picks the highest-capability tier (starting at Gemini 3.8 Live) that has not
   * reached its RPM, TPM, RPD, or cooldown threshold.
   */
  public selectModel(options: RouterSelectionOptions = {}): TierModelConfig {
    const now = options.now ?? Date.now();
    const estimatedTokens = options.estimatedTokens ?? 500;
    const excludeIds = options.excludeIds;

    for (const tier of this.tiers) {
      if (excludeIds?.has(tier.id)) continue;
      if (this.canServe(tier, estimatedTokens, now)) {
        return tier;
      }
    }

    // If all tiers are saturated/cooled down, pick the first non-excluded tier as last resort
    for (const tier of this.tiers) {
      if (!excludeIds?.has(tier.id)) {
        return tier;
      }
    }
    return this.tiers[0];
  }

  /**
   * Selects a tier starting from a given cycle step offset while still honoring
   * RPM, TPM, RPD, and error cooldown limits. Step 0 uses default frontier-first order.
   */
  public getTierByStep(
    cycleStep: number = 0,
    options: RouterSelectionOptions = {},
  ): TierModelConfig {
    if (cycleStep <= 0) {
      return this.selectModel(options);
    }
    const now = options.now ?? Date.now();
    const estimatedTokens = options.estimatedTokens ?? 500;
    const excludeIds = options.excludeIds;
    const startIdx = Math.abs(Math.trunc(cycleStep)) % this.tiers.length;

    for (let offset = 0; offset < this.tiers.length; offset++) {
      const candidate = this.tiers[(startIdx + offset) % this.tiers.length];
      if (excludeIds?.has(candidate.id)) continue;
      if (this.canServe(candidate, estimatedTokens, now)) {
        return candidate;
      }
    }

    return this.tiers[startIdx];
  }

  /**
   * Advances silently to the next available tier after `currentModelId`
   * while honoring RPM, TPM, RPD, and cooldown constraints.
   */
  public selectNextTier(
    currentModelId: string | null,
    options: RouterSelectionOptions = {},
  ): TierModelConfig {
    const currentIndex = currentModelId
      ? this.tiers.findIndex((t) => t.id === currentModelId)
      : -1;
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const now = options.now ?? Date.now();
    const estimatedTokens = options.estimatedTokens ?? 500;
    const excludeIds = options.excludeIds;

    for (let offset = 1; offset <= this.tiers.length; offset++) {
      const candidate = this.tiers[(baseIndex + offset) % this.tiers.length];
      if (excludeIds?.has(candidate.id)) continue;
      if (this.canServe(candidate, estimatedTokens, now)) {
        return candidate;
      }
    }

    return this.tiers[(baseIndex + 1) % this.tiers.length];
  }

  public recordRequest(modelId: string, estimatedTokens: number = 0, now: number = Date.now()): void {
    const win = this.getWindow(modelId, now);
    win.minuteRequests.push(now);
    win.dayRequests.push(now);
    if (estimatedTokens > 0) {
      win.minuteTokens.push({ timestamp: now, tokens: estimatedTokens });
    }
  }

  public recordTokens(modelId: string, tokens: number, now: number = Date.now()): void {
    if (tokens <= 0) return;
    const win = this.getWindow(modelId, now);
    win.minuteTokens.push({ timestamp: now, tokens });
  }

  public markErrorCooldown(
    modelId: string,
    cooldownMs: number = DEFAULT_COOLDOWN_MS,
    now: number = Date.now(),
  ): void {
    const win = this.getWindow(modelId, now);
    win.cooldownUntil = Math.max(win.cooldownUntil, now + cooldownMs);
  }
}

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  // Conservative estimate for Ethiopic UTF-8 / mixed text + prompt framing
  return Math.max(16, Math.ceil(text.length * 0.75));
}

export function estimateAudioChunkTokens(base64BytesLength: number): number {
  if (base64BytesLength <= 0) return 0;
  // 16kHz 16-bit PCM = 32,000 bytes/sec (~42,667 base64 chars/sec); ~32 tokens/sec
  const approxSeconds = base64BytesLength / 42_667;
  return Math.max(1, Math.ceil(approxSeconds * 32));
}
