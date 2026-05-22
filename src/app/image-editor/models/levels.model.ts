export type LevelsChannel = "master" | "r" | "g" | "b" | "a";
export type HistogramScale = "linear" | "log";

export interface LevelsChannelSettings {
  blackPoint: number; // 0..255
  whitePoint: number; // 0..255
  gamma: number; // 0.1..9.9
}

export type LevelsSettings = Record<LevelsChannel, LevelsChannelSettings>;

export const DEFAULT_CHANNEL_SETTINGS: LevelsChannelSettings = {
  blackPoint: 0,
  whitePoint: 255,
  gamma: 1.0,
};

export function createDefaultLevelsSettings(): LevelsSettings {
  return {
    master: { ...DEFAULT_CHANNEL_SETTINGS },
    r: { ...DEFAULT_CHANNEL_SETTINGS },
    g: { ...DEFAULT_CHANNEL_SETTINGS },
    b: { ...DEFAULT_CHANNEL_SETTINGS },
    a: { ...DEFAULT_CHANNEL_SETTINGS },
  };
}
