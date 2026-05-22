import {
  LevelsChannel,
  LevelsChannelSettings,
  LevelsSettings,
} from "../app/image-editor/models/levels.model";

/**
 * Светлота пикселя (luma BT.601).
 */
export function computeLuma(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Гистограмма по 256 бинам для выбранного канала.
 * channel = "master" → luma по RGB.
 */
export function computeHistogram(
  source: ImageData,
  channel: LevelsChannel
): Uint32Array {
  const hist = new Uint32Array(256);
  const data = source.data;

  if (channel === "master") {
    for (let i = 0; i < data.length; i += 4) {
      const l = computeLuma(data[i], data[i + 1], data[i + 2]);
      hist[l]++;
    }
    return hist;
  }

  const offset = { r: 0, g: 1, b: 2, a: 3 }[channel];
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i + offset]]++;
  }
  return hist;
}

/**
 * LUT для одного канала по настройкам (blackPoint, whitePoint, gamma).
 */
export function buildLut(settings: LevelsChannelSettings): Uint8ClampedArray {
  const { blackPoint, whitePoint, gamma } = settings;
  const lut = new Uint8ClampedArray(256);
  const range = Math.max(1, whitePoint - blackPoint);
  const invGamma = 1 / gamma;

  for (let i = 0; i < 256; i++) {
    let v = (i - blackPoint) / range;
    if (v <= 0) {
      lut[i] = 0;
      continue;
    }
    if (v >= 1) {
      lut[i] = 255;
      continue;
    }
    v = Math.pow(v, invGamma);
    lut[i] = Math.round(v * 255);
  }
  return lut;
}

/**
 * Композиция master + per-channel LUT в финальные LUT для R, G, B, A.
 * Сначала применяется master к каждому из R/G/B, затем — канальный LUT.
 * Alpha обрабатывается только своим каналом (master её не трогает).
 */
export function buildComposedLuts(settings: LevelsSettings): {
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
  a: Uint8ClampedArray;
} {
  const lutMaster = buildLut(settings.master);
  const lutR = buildLut(settings.r);
  const lutG = buildLut(settings.g);
  const lutB = buildLut(settings.b);
  const lutA = buildLut(settings.a);

  const r = new Uint8ClampedArray(256);
  const g = new Uint8ClampedArray(256);
  const b = new Uint8ClampedArray(256);

  for (let i = 0; i < 256; i++) {
    r[i] = lutR[lutMaster[i]];
    g[i] = lutG[lutMaster[i]];
    b[i] = lutB[lutMaster[i]];
  }

  return { r, g, b, a: lutA };
}

/**
 * Применяет уровни к ImageData и возвращает НОВЫЙ ImageData.
 */
export function applyLevels(
  source: ImageData,
  settings: LevelsSettings
): ImageData {
  const { r: lutR, g: lutG, b: lutB, a: lutA } = buildComposedLuts(settings);
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height
  );
  const d = out.data;

  for (let i = 0; i < d.length; i += 4) {
    d[i] = lutR[d[i]];
    d[i + 1] = lutG[d[i + 1]];
    d[i + 2] = lutB[d[i + 2]];
    d[i + 3] = lutA[d[i + 3]];
  }
  return out;
}
