/**
 * Интерфейс стратегии 2D-интерполяции.
 * Можно легко добавить новые алгоритмы (bicubic, lanczos), реализовав InterpolationMethod.
 */
export type InterpolationId = "nearest" | "bilinear";

export interface InterpolationMethod {
  readonly id: InterpolationId;
  readonly label: string;
  readonly description: string;
  resample(src: ImageData, dstW: number, dstH: number): ImageData;
}

/* ---------- helpers ---------- */

function clampInt(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/* ---------- Nearest Neighbor ---------- */

export const nearestNeighbor: InterpolationMethod = {
  id: "nearest",
  label: "Метод ближайшего соседа",
  description:
    "Быстрый алгоритм: каждый пиксель берётся как ближайший из исходного. Подходит для пиксель-арта, сохраняет резкие края, но даёт ступенчатость при увеличении.",
  resample(src, dstW, dstH) {
    const out = new ImageData(dstW, dstH);
    const sw = src.width;
    const sh = src.height;
    const sd = src.data;
    const dd = out.data;

    const xRatio = sw / dstW;
    const yRatio = sh / dstH;

    for (let y = 0; y < dstH; y++) {
      const sy = clampInt(Math.floor((y + 0.5) * yRatio), 0, sh - 1);
      for (let x = 0; x < dstW; x++) {
        const sx = clampInt(Math.floor((x + 0.5) * xRatio), 0, sw - 1);
        const si = (sy * sw + sx) * 4;
        const di = (y * dstW + x) * 4;
        dd[di] = sd[si];
        dd[di + 1] = sd[si + 1];
        dd[di + 2] = sd[si + 2];
        dd[di + 3] = sd[si + 3];
      }
    }
    return out;
  },
};

/* ---------- Bilinear ---------- */

export const bilinear: InterpolationMethod = {
  id: "bilinear",
  label: "Билинейная интерполяция",
  description:
    "Усреднение 4 соседних пикселей с весами по расстоянию. Даёт плавные переходы, хорошо подходит для фотографий. При сильном уменьшении может терять детали.",
  resample(src, dstW, dstH) {
    const out = new ImageData(dstW, dstH);
    const sw = src.width;
    const sh = src.height;
    const sd = src.data;
    const dd = out.data;

    const xRatio = dstW > 1 ? (sw - 1) / (dstW - 1) : 0;
    const yRatio = dstH > 1 ? (sh - 1) / (dstH - 1) : 0;

    for (let y = 0; y < dstH; y++) {
      const fy = y * yRatio;
      const y0 = Math.floor(fy);
      const y1 = Math.min(y0 + 1, sh - 1);
      const wy = fy - y0;

      for (let x = 0; x < dstW; x++) {
        const fx = x * xRatio;
        const x0 = Math.floor(fx);
        const x1 = Math.min(x0 + 1, sw - 1);
        const wx = fx - x0;

        const i00 = (y0 * sw + x0) * 4;
        const i01 = (y0 * sw + x1) * 4;
        const i10 = (y1 * sw + x0) * 4;
        const i11 = (y1 * sw + x1) * 4;

        const di = (y * dstW + x) * 4;
        for (let c = 0; c < 4; c++) {
          const v0 = sd[i00 + c] * (1 - wx) + sd[i01 + c] * wx;
          const v1 = sd[i10 + c] * (1 - wx) + sd[i11 + c] * wx;
          dd[di + c] = v0 * (1 - wy) + v1 * wy;
        }
      }
    }
    return out;
  },
};

/* ---------- Registry ---------- */

export const INTERPOLATION_METHODS: Record<
  InterpolationId,
  InterpolationMethod
> = {
  nearest: nearestNeighbor,
  bilinear,
};

export const DEFAULT_INTERPOLATION: InterpolationId = "bilinear";

export function getInterpolation(id: InterpolationId): InterpolationMethod {
  return INTERPOLATION_METHODS[id] ?? bilinear;
}

export function listInterpolations(): InterpolationMethod[] {
  return Object.values(INTERPOLATION_METHODS);
}
