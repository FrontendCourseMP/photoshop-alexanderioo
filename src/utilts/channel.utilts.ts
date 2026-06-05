import {
  ChannelKey,
  ChannelState,
} from "../app/image-editor/models/channel.model";

const THUMB_MAX = 64;

export function makeChannelThumb(
  source: ImageData,
  channel: ChannelKey,
  maxSize: number = THUMB_MAX
): string {
  const ratio = source.width / source.height;
  let w: number, h: number;
  if (ratio >= 1) {
    w = maxSize;
    h = Math.max(1, Math.round(maxSize / ratio));
  } else {
    h = maxSize;
    w = Math.max(1, Math.round(maxSize * ratio));
  }

  const sw = source.width;
  const sh = source.height;
  const sd = source.data;
  const offset = { r: 0, g: 1, b: 2, a: 3 }[channel];

  const out = new ImageData(w, h);
  const od = out.data;
  const xRatio = sw / w;
  const yRatio = sh / h;

  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * yRatio));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * xRatio));
      const si = (sy * sw + sx) * 4;
      const di = (y * w + x) * 4;
      const v = sd[si + offset];
      od[di] = v;
      od[di + 1] = v;
      od[di + 2] = v;
      od[di + 3] = 255;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL("image/png");
}

export function applyChannelMask(
  source: ImageData,
  state: ChannelState,
  isGrayscale: boolean = false
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height
  );
  const data = out.data;

  const onlyAlpha = !state.r && !state.g && !state.b && state.a;

  for (let i = 0; i < data.length; i += 4) {
    if (onlyAlpha) {
      const a = data[i + 3];
      data[i] = a;
      data[i + 1] = a;
      data[i + 2] = a;
      data[i + 3] = 255;
      continue;
    }

    if (isGrayscale) {
      if (!state.r) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
      if (!state.a) data[i + 3] = 255;
    } else {
      if (!state.r) data[i] = 0;
      if (!state.g) data[i + 1] = 0;
      if (!state.b) data[i + 2] = 0;
      if (!state.a) data[i + 3] = 255;
    }
  }
  return out;
}
