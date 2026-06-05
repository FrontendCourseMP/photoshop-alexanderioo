import { ChannelKey } from "../app/image-editor/models/channel.model";
// test
export interface DetectedChannels {
  r: boolean;
  g: boolean;
  b: boolean;
  a: boolean;
  grayscale: boolean;
}

export function detectChannels(
  src: ImageData,
  forceGrayscale: boolean = false
): DetectedChannels {
  const d = src.data;
  let hasAlpha = false;
  let isGrayscale = true;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 255) {
      hasAlpha = true;
    }

    if (!forceGrayscale && a > 0 && isGrayscale) {
      if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) {
        isGrayscale = false;
      }
    }
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
