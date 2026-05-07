export interface Gb7Image {
  imageData: ImageData;
  depth: number;
  hasMask: boolean;
}

const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const;
const GB7_VERSION = 0x01;
const GB7_HEADER_SIZE = 12;
const MASK_BIT = 0b10000000;
const GRAY_MASK = 0b01111111;

export function decodeGB7(buffer: ArrayBuffer, showMasked = false): Gb7Image {
  const view = new DataView(buffer);

  for (let i = 0; i < GB7_SIGNATURE.length; i++) {
    if (view.getUint8(i) !== GB7_SIGNATURE[i]) {
      throw new Error("Not a GB7 file");
    }
  }

  const version = view.getUint8(4);

  if (version !== GB7_VERSION) {
    throw new Error(`Unsupported GB7 version: ${version}`);
  }

  const flag = view.getUint8(5);
  const width = view.getUint16(6);
  const height = view.getUint16(8);
  const hasMask = Boolean(flag & 1);

  const expectedSize = GB7_HEADER_SIZE + width * height;

  if (buffer.byteLength < expectedSize) {
    throw new Error(
      `Invalid GB7: expected ${expectedSize} bytes, got ${buffer.byteLength}`
    );
  }

  const imageData = new ImageData(width, height);

  let offset = GB7_HEADER_SIZE;

  for (let i = 0; i < width * height; i++) {
    const byte = view.getUint8(offset++);

    const gray = byte & GRAY_MASK;
    const value = Math.round((gray * 255) / 127);
    const alpha = hasMask && !showMasked ? (byte & MASK_BIT ? 255 : 0) : 255;

    const index = i * 4;

    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = alpha;
  }

  return {
    imageData,
    depth: hasMask ? 8 : 7,
    hasMask,
  };
}

export function encodeGB7(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ArrayBuffer {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let hasMask = false;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      hasMask = true;
      break;
    }
  }

  const buffer = new ArrayBuffer(GB7_HEADER_SIZE + width * height);
  const view = new DataView(buffer);

  for (let i = 0; i < GB7_SIGNATURE.length; i++) {
    view.setUint8(i, GB7_SIGNATURE[i]);
  }

  view.setUint8(4, GB7_VERSION);
  view.setUint8(5, hasMask ? 0x01 : 0x00);
  view.setUint16(6, width);
  view.setUint16(8, height);
  view.setUint16(10, 0x0000);

  let offset = GB7_HEADER_SIZE;

  for (let i = 0; i < width * height; i++) {
    const index = i * 4;

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const value = Math.round((gray * 127) / 255);
    const maskBit = hasMask ? (a > 0 ? MASK_BIT : 0) : 0;

    view.setUint8(offset++, value | maskBit);
  }

  return buffer;
}
