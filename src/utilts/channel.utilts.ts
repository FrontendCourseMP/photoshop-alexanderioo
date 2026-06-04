import {
  ChannelKey,
  ChannelState,
} from "../app/image-editor/models/channel.model";

const THUMB_MAX = 64;

/**
 * Возвращает миниатюру одного канала в градациях серого.
 * Размер вписывается в THUMB_MAX × THUMB_MAX с сохранением пропорций.
 */
export function makeChannelThumb(
  source: ImageData,
  channel: ChannelKey,
  maxSize: number = THUMB_MAX
): string {
  // Сохраняем пропорции
  const ratio = source.width / source.height;
  let w: number, h: number;
  if (ratio >= 1) {
    w = maxSize;
    h = Math.max(1, Math.round(maxSize / ratio));
  } else {
    h = maxSize;
    w = Math.max(1, Math.round(maxSize * ratio));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Сначала ставим исходник на временный canvas
  const tmp = document.createElement("canvas");
  tmp.width = source.width;
  tmp.height = source.height;
  tmp.getContext("2d")!.putImageData(source, 0, 0);

  // Ужимаем с сохранением соотношения
  ctx.drawImage(tmp, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const offset = { r: 0, g: 1, b: 2, a: 3 }[channel];

  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + offset];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Применяет состояние каналов к ImageData (создаёт копию, оригинал не трогает).
 */
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
