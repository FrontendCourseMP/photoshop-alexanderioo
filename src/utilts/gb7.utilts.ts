export function decodeGB7(buffer: ArrayBuffer): ImageData {
  const view = new DataView(buffer);

  if (
    view.getUint8(0) !== 0x47 ||
    view.getUint8(1) !== 0x42 ||
    view.getUint8(2) !== 0x37 ||
    view.getUint8(3) !== 0x1d
  ) {
    throw new Error('Not GB7');
  }

  const width = view.getUint16(6);
  const height = view.getUint16(8);
  const flag = view.getUint8(5);
  const hasMask = Boolean(flag & 1);

  const imageData = new ImageData(width, height);
  let offset = 12;

  for (let i = 0; i < width * height; i++) {
    const byte = view.getUint8(offset++);

    const gray = byte & 0b01111111;
    const value = Math.round((gray * 255) / 127);
    const alpha = hasMask ? (byte & 0b10000000 ? 255 : 0) : 255;

    const index = i * 4;

    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = alpha;
  }

  return imageData;
}

export function encodeGB7(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ArrayBuffer {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const buffer = new ArrayBuffer(12 + width * height);
  const view = new DataView(buffer);

  view.setUint8(0, 0x47);
  view.setUint8(1, 0x42);
  view.setUint8(2, 0x37);
  view.setUint8(3, 0x1d);

  view.setUint8(4, 0x01);
  view.setUint8(5, 0x00);

  view.setUint16(6, width);
  view.setUint16(8, height);
  view.setUint16(10, 0);

  let offset = 12;

  for (let i = 0; i < width * height; i++) {
    const index = i * 4;

    const gray = Math.round(
      (data[index] + data[index + 1] + data[index + 2]) / 3
    );

    const value = Math.round((gray * 127) / 255);

    view.setUint8(offset++, value);
  }

  return buffer;
}
