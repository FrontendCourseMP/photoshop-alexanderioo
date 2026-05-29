import { ChannelKey } from "../app/image-editor/models/channel.model";

export interface DetectedChannels {
  r: boolean;
  g: boolean;
  b: boolean;
  a: boolean;
  grayscale: boolean;
}

/**
 * Анализирует реальные каналы изображения.
 * - alpha считается "присутствующим", если есть хотя бы один прозрачный пиксель
 * - grayscale = картинка является монохромной (R==G==B)
 *
 * forceGrayscale=true — для форматов где grayscale известен из заголовка (GB7)
 */
export function detectChannels(
  src: ImageData,
  forceGrayscale: boolean = false,
): DetectedChannels {
  const d = src.data;
  let hasAlpha = false;
  let isGrayscale = true;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 255) hasAlpha = true;
    if (!forceGrayscale && (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2])) {
      isGrayscale = false;
    }
    if (hasAlpha && !isGrayscale && !forceGrayscale) break;
  }

  if (forceGrayscale) isGrayscale = true;

  return {
    r: true,
    g: !isGrayscale,
    b: !isGrayscale,
    a: hasAlpha,
    grayscale: isGrayscale,
  };
}

export function visibleChannelList(d: DetectedChannels): ChannelKey[] {
  const list: ChannelKey[] = [];
  if (d.r) list.push("r");
  if (d.g) list.push("g");
  if (d.b) list.push("b");
  if (d.a) list.push("a");
  return list;
}
