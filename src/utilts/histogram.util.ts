export type HistogramChannel = "master" | "r" | "g" | "b" | "a";

export interface Histograms {
  master: Uint32Array;
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  a: Uint32Array;
}

/**
 * Считает гистограммы для всех каналов за один проход.
 * master — светлота L = 0.299R + 0.587G + 0.114B
 */
export function computeHistograms(imageData: ImageData): Histograms {
  const data = imageData.data;
  const master = new Uint32Array(256);
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const a = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const R = data[i];
    const G = data[i + 1];
    const B = data[i + 2];
    const A = data[i + 3];
    const L = (0.299 * R + 0.587 * G + 0.114 * B) | 0;

    r[R]++;
    g[G]++;
    b[B]++;
    a[A]++;
    master[L]++;
  }

  return { master, r, g, b, a };
}

/**
 * Рисует гистограмму на canvas.
 * scale: linear | log
 */
export function drawHistogram(
  canvas: HTMLCanvasElement,
  bins: Uint32Array,
  scale: "linear" | "log",
  color: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  let max = 0;
  for (let i = 0; i < 256; i++) {
    if (bins[i] > max) max = bins[i];
  }
  if (max === 0) return;

  const scaled = new Float32Array(256);
  if (scale === "log") {
    const logMax = Math.log(1 + max);
    for (let i = 0; i < 256; i++) {
      scaled[i] = Math.log(1 + bins[i]) / logMax;
    }
  } else {
    for (let i = 0; i < 256; i++) {
      scaled[i] = bins[i] / max;
    }
  }

  ctx.fillStyle = color;
  const barW = w / 256;
  for (let i = 0; i < 256; i++) {
    const barH = scaled[i] * h;
    ctx.fillRect(i * barW, h - barH, Math.max(1, barW), barH);
  }
}
