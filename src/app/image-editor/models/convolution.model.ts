import {
  ConvolutionChannels,
  EdgeMode,
} from "../../../utilts/convolution.utilts";

export interface ConvolutionSettings {
  presetId: string; // "identity" | "sharpen" | ... | "custom"
  kernel: number[]; // 9 значений
  channels: ConvolutionChannels;
  edge: EdgeMode;
  normalize: boolean;
  bias: number;
  abs: boolean;
}

export function createDefaultConvolutionSettings(): ConvolutionSettings {
  return {
    presetId: "identity",
    kernel: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    channels: { r: true, g: true, b: true },
    edge: "copy",
    normalize: false,
    bias: 0,
    abs: false,
  };
}
