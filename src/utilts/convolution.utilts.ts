export type EdgeMode = "black" | "white" | "copy";

export interface ConvolutionChannels {
  r: boolean;
  g: boolean;
  b: boolean;
}

export interface KernelPreset {
  id: string;
  label: string;
  description: string;
  kernel: number[];
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
    description: "Гауссово размытие с σ≈1.",
    kernel: [
      1 / 16,
      2 / 16,
      1 / 16,
      2 / 16,
      4 / 16,
      2 / 16,
      1 / 16,
      2 / 16,
      1 / 16,
    ],
  },
  {
    id: "box",
    label: "Прямоугольное размытие",
    description: "Простое усреднение по окну 3×3.",
    kernel: [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9],
  },
  {
    id: "prewitt_x",
    label: "Прюитт по X",
    description: "Оператор Прюитта — детектор горизонтальных границ.",
    kernel: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
  },
  {
    id: "prewitt_y",
    label: "Прюитт по Y",
    description: "Оператор Прюитта — детектор вертикальных границ.",
    kernel: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
  },
];

/**
 * Расширяет изображение на 1 пиксель по краям согласно стратегии.
 */
function padImage(src: ImageData, mode: EdgeMode): ImageData {
  const sw = src.width;
  const sh = src.height;
  const pw = sw + 2;
  const ph = sh + 2;
  const out = new ImageData(pw, ph);
  const sd = src.data;
  const od = out.data;

  // Сначала залить рамку
  const fill = (i: number) => {
    if (mode === "black") {
      od[i] = 0;
      od[i + 1] = 0;
      od[i + 2] = 0;
      od[i + 3] = 255;
    } else if (mode === "white") {
      od[i] = 255;
      od[i + 1] = 255;
      od[i + 2] = 255;
      od[i + 3] = 255;
    }
  };

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
      } else {
        fill(oi);
      }
    }
  }
  return out;
}

/**
 * Применяет ядро 3×3 к выбранным каналам.
 * Возвращает НОВЫЙ ImageData того же размера, что и src.
 */
export function applyConvolution(
  src: ImageData,
  kernel: number[],
  channels: ConvolutionChannels,
  edge: EdgeMode
): ImageData {
  if (kernel.length !== 9) throw new Error("Kernel must be 3x3");
  const padded = padImage(src, edge);
  const pw = padded.width;
  const pd = padded.data;
  const sw = src.width;
  const sh = src.height;

  const out = new ImageData(new Uint8ClampedArray(src.data), sw, sh);
  const od = out.data;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let sr = 0,
        sg = 0,
        sb = 0;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const px = x + kx;
          const py = y + ky;
          const pi = (py * pw + px) * 4;
          const k = kernel[ky * 3 + kx];
          sr += pd[pi] * k;
          sg += pd[pi + 1] * k;
          sb += pd[pi + 2] * k;
        }
      }
      const oi = (y * sw + x) * 4;
      if (channels.r) od[oi] = Math.max(0, Math.min(255, sr));
      if (channels.g) od[oi + 1] = Math.max(0, Math.min(255, sg));
      if (channels.b) od[oi + 2] = Math.max(0, Math.min(255, sb));
      // alpha не трогаем (как в Photoshop custom)
    }
  }
  return out;
}

/**
 * Асинхронная версия с разбиением на чанки — UI не блокируется.
 */
export async function applyConvolutionAsync(
  src: ImageData,
  kernel: number[],
  channels: ConvolutionChannels,
  edge: EdgeMode,
  chunkRows = 64
): Promise<ImageData> {
  const padded = padImage(src, edge);
  const pw = padded.width;
  const pd = padded.data;
  const sw = src.width;
  const sh = src.height;

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
            const k = kernel[ky * 3 + kx];
            sr += pd[pi] * k;
            sg += pd[pi + 1] * k;
            sb += pd[pi + 2] * k;
          }
        }
        const oi = (y * sw + x) * 4;
        if (channels.r) od[oi] = Math.max(0, Math.min(255, sr));
        if (channels.g) od[oi + 1] = Math.max(0, Math.min(255, sg));
        if (channels.b) od[oi + 2] = Math.max(0, Math.min(255, sb));
      }
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}
