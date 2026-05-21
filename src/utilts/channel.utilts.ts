import { ChannelKey, ChannelState } from "../image-editor/models/channel.model";

const THUMB_SIZE = 64;

/**
 * Возвращает миниатюру одного канала в градациях серого.
 */
export function makeChannelThumb(
  source: ImageData,
  channel: ChannelKey,
  size: number = THUMB_SIZE
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Сначала уменьшим исходник
  const tmp = document.createElement("canvas");
  tmp.width = source.width;
  tmp.height = source.height;
  tmp.getContext("2d")!.putImageData(source, 0, 0);

  ctx.drawImage(tmp, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
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
  state: ChannelState
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height
  );
  const data = out.data;

  // Если оставлен ТОЛЬКО альфа-канал → показываем маску прозрачности
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

    if (!state.r) data[i] = 0;
    if (!state.g) data[i + 1] = 0;
    if (!state.b) data[i + 2] = 0;
    if (!state.a) data[i + 3] = 255;
  }

  return out;
}
