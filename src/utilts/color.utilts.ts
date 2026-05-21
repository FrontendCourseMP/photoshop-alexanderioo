function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const fx = f(x / Xn);
  const fy = f(y / Yn);
  const fz = f(z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [L, a, b];
}

function f(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3)
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

export function rgbToLab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;

  return xyzToLab(x, y, z);
}
