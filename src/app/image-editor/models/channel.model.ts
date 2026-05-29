export type ChannelKey = "r" | "g" | "b" | "a";

export type ChannelMode = 1 | 2 | 3 | 4;

export interface ChannelState {
  r: boolean;
  g: boolean;
  b: boolean;
  a: boolean;
}

export interface ChannelThumb {
  key: ChannelKey;
  label: string;
  dataUrl: string;
}

export interface PixelInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  l: number;
  labA: number;
  labB: number;
  isGrayscale: boolean;
}
