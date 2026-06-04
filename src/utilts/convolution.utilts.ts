export type EdgeMode = "black" | "white" | "copy";

export interface ConvolutionChannels {
  r: boolean;
  g: boolean;
  b: boolean;
}

export interface ConvolutionOptions {
  kernel: number[]; // 9 значений
  channels: ConvolutionChannels;
  edge: EdgeMode;
  divisor?: number; // если undefined → 1
  bias?: number; // смещение, по умолчанию 0
  normalize?: boolean; // если true → divisor = sum(kernel) (или 1, если sum=0)
  grayscale?: boolean; // если true → результат пишется во все R=G=B
}

export interface KernelPreset {
  id: string;
  label: string;
  description: string;
  kernel: number[];
  bias?: number;
  normalize?: boolean;
}

export const KERNEL_PRESETS: KernelPreset[] = [
  {
    id: "identity",
    label: "Тождественное отображение",
    description: "Не меняет изображение.",
    kernel: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  },
  {
    id: "sharpen",
    label: "Повышение резкости",
    description: "Усиливает резкость изображения.",
    kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0],
  },
  {
    id: "gauss3",
    label: "Фильтр Гаусса 3×3",
    description: "Гауссово размытие, σ≈1. Нормализовано (сумма = 16).",
    kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1],
    normalize: true,
  },
  {
    id: "box",
    label: "Прямоугольное размытие",
    description: "Усреднение по окну 3×3.",
    kernel: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    normalize: true,
  },
  {
    id: "prewitt_x",
    label: "Прюитт по X",
    description:
      "Детектор вертикальных границ. Bias=128 для отображения отрицательных значений.",
    kernel: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
    bias: 128,
  },
  {
    id: "prewitt_y",
    label: "Прюитт по Y",
    description:
      "Детектор горизонтальных границ. Bias=128 для отображения отрицательных значений.",
    kernel: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
    bias: 128,
  },
];

export function getKernelSum(kernel: number[]): number {
  let s = 0;
  for (let i = 0; i < kernel.length; i++) s += kernel[i];
  return s;
}

export function parseKernelValue(raw: string): number {
  if (raw == null) return 0;
  const trimmed = raw.toString().trim();
  if (trimmed === "" || trimmed === "-") return 0;
  // поддержка дробей вида "1/16"
  if (trimmed.includes("/")) {
    const [a, b] = trimmed.split("/").map((s) => parseFloat(s));
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
    return 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- padding ---------- */

function padImage(src: ImageData, mode: EdgeMode): ImageData {
  const sw = src.width;
  const sh = src.height;
  const pw = sw + 2;
  const ph = sh + 2;
  const out = new ImageData(pw, ph);
  const sd = src.data;
  const od = out.data;

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const oi = (y * pw + x) * 4;
      const inside = x >= 1 && x <= sw && y >= 1 && y <= sh;
      if (inside) {
        const si = ((y - 1) * sw + (x - 1)) * 4;
        od[oi] = sd[si];
        od[oi + 1] = sd[si + 1];
        od[oi + 2] = sd[si + 2];
        od[oi + 3] = sd[si + 3];
      } else if (mode === "copy") {
        const cx = Math.min(Math.max(x - 1, 0), sw - 1);
        const cy = Math.min(Math.max(y - 1, 0), sh - 1);
        const si = (cy * sw + cx) * 4;
        od[oi] = sd[si];
        od[oi + 1] = sd[si + 1];
        od[oi + 2] = sd[si + 2];
        od[oi + 3] = sd[si + 3];
      } else if (mode === "black") {
        od[oi] = 0;
        od[oi + 1] = 0;
        od[oi + 2] = 0;
        od[oi + 3] = 255;
      } else {
        od[oi] = 255;
        od[oi + 1] = 255;
        od[oi + 2] = 255;
        od[oi + 3] = 255;
      }
    }
  }
  return out;
}

/* ---------- helpers ---------- */

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function resolveDivisor(opts: ConvolutionOptions): number {
  if (opts.normalize) {
    const sum = getKernelSum(opts.kernel);
    return sum === 0 ? 1 : sum;
  }
  if (opts.divisor !== undefined && opts.divisor !== 0) return opts.divisor;
  return 1;
}

/* ---------- sync ---------- */

export function applyConvolution(
  src: ImageData,
  opts: ConvolutionOptions,
): ImageData {
  if (opts.kernel.length !== 9) throw new Error("Kernel must be 3x3");
  const padded = padImage(src, opts.edge);
  const pw = padded.width;
  const pd = padded.data;
  const sw = src.width;
  const sh = src.height;
  const div = resolveDivisor(opts);
  const bias = opts.bias ?? 0;
  const k = opts.kernel;
  const gray = opts.grayscale === true;

  const out = new ImageData(new Uint8ClampedArray(src.data), sw, sh);
  const od = out.data;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let sr = 0,
        sg = 0,
        sb = 0;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const pi = ((y + ky) * pw + (x + kx)) * 4;
          const kv = k[ky * 3 + kx];
          sr += pd[pi] * kv;
          sg += pd[pi + 1] * kv;
          sb += pd[pi + 2] * kv;
        }
      }
      sr = sr / div + bias;
      sg = sg / div + bias;
      sb = sb / div + bias;

      const oi = (y * sw + x) * 4;

      if (gray) {
        // grayscale-изображение: один результат на все RGB
        const v = clamp255(sr);
        od[oi] = v;
        od[oi + 1] = v;
        od[oi + 2] = v;
      } else {
        if (opts.channels.r) od[oi] = clamp255(sr);
        if (opts.channels.g) od[oi + 1] = clamp255(sg);
        if (opts.channels.b) od[oi + 2] = clamp255(sb);
      }
      // alpha не трогаем (берётся из src.data из конструктора out)
    }
  }
  return out;
}

/* ---------- async (UI не зависает) ---------- */

export async function applyConvolutionAsync(
  src: ImageData,
  opts: ConvolutionOptions,
  chunkRows = 32,
): Promise<ImageData> {
  if (opts.kernel.length !== 9) throw new Error("Kernel must be 3x3");
  const padded = padImage(src, opts.edge);
  const pw = padded.width;
  const pd = padded.data;
  const sw = src.width;
  const sh = src.height;
  const div = resolveDivisor(opts);
  const bias = opts.bias ?? 0;
  const k = opts.kernel;
  const gray = opts.grayscale === true;

  const out = new ImageData(new Uint8ClampedArray(src.data), sw, sh);
  const od = out.data;

  for (let yStart = 0; yStart < sh; yStart += chunkRows) {
    const yEnd = Math.min(yStart + chunkRows, sh);
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < sw; x++) {
        let sr = 0,
          sg = 0,
          sb = 0;
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const pi = ((y + ky) * pw + (x + kx)) * 4;
            const kv = k[ky * 3 + kx];
            sr += pd[pi] * kv;
            sg += pd[pi + 1] * kv;
            sb += pd[pi + 2] * kv;
          }
        }
        sr = sr / div + bias;
        sg = sg / div + bias;
        sb = sb / div + bias;

        const oi = (y * sw + x) * 4;
        if (gray) {
          const v = clamp255(sr);
          od[oi] = v;
          od[oi + 1] = v;
          od[oi + 2] = v;
        } else {
          if (opts.channels.r) od[oi] = clamp255(sr);
          if (opts.channels.g) od[oi + 1] = clamp255(sg);
          if (opts.channels.b) od[oi + 2] = clamp255(sb);
        }
      }
    }
    // отдаём управление браузеру
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}
