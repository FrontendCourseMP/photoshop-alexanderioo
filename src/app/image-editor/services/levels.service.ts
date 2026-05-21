import { Injectable } from "@angular/core";

export type LevelsChannel = "master" | "r" | "g" | "b" | "a";

export interface ChannelLevels {
  black: number; // 0..255
  white: number; // 0..255
  gamma: number; // 0.1..9.9
}

export type LevelsState = Record<LevelsChannel, ChannelLevels>;

export const DEFAULT_CHANNEL_LEVELS: ChannelLevels = {
  black: 0,
  white: 255,
  gamma: 1.0,
};

export function createDefaultLevels(): LevelsState {
  return {
    master: { ...DEFAULT_CHANNEL_LEVELS },
    r: { ...DEFAULT_CHANNEL_LEVELS },
    g: { ...DEFAULT_CHANNEL_LEVELS },
    b: { ...DEFAULT_CHANNEL_LEVELS },
    a: { ...DEFAULT_CHANNEL_LEVELS },
  };
}

@Injectable({ providedIn: "root" })
export class LevelsService {
  /**
   * Строит LUT для одного канала.
   * out = ((in - black) / (white - black))^(1/gamma) * 255
   */
  buildLut(levels: ChannelLevels): Uint8ClampedArray {
    const { black, white, gamma } = levels;
    const lut = new Uint8ClampedArray(256);
    const range = Math.max(1, white - black);
    const invGamma = 1 / gamma;

    for (let i = 0; i < 256; i++) {
      if (i <= black) {
        lut[i] = 0;
      } else if (i >= white) {
        lut[i] = 255;
      } else {
        const norm = (i - black) / range;
        lut[i] = Math.round(Math.pow(norm, invGamma) * 255);
      }
    }
    return lut;
  }

  /**
   * Применяет уровни ко всем каналам.
   * Master LUT применяется к R, G, B (alpha не трогаем в master).
   * Затем поверх накладываются индивидуальные LUT для каждого канала.
   */
  applyLevels(source: ImageData, target: ImageData, state: LevelsState): void {
    const src = source.data;
    const dst = target.data;
    const len = src.length;

    const lutM = this.buildLut(state.master);
    const lutR = this.buildLut(state.r);
    const lutG = this.buildLut(state.g);
    const lutB = this.buildLut(state.b);
    const lutA = this.buildLut(state.a);

    for (let i = 0; i < len; i += 4) {
      dst[i] = lutR[lutM[src[i]]];
      dst[i + 1] = lutG[lutM[src[i + 1]]];
      dst[i + 2] = lutB[lutM[src[i + 2]]];
      dst[i + 3] = lutA[src[i + 3]];
    }
  }

  cloneImageData(src: ImageData): ImageData {
    const copy = new ImageData(src.width, src.height);
    copy.data.set(src.data);
    return copy;
  }
}
