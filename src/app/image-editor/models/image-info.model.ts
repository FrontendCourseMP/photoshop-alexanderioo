export interface ImageInfo {
  width: number;
  height: number;
  depth: number;
  hasMask: boolean;
}

export interface DownloadButton {
  label: string;
  action: () => void;
}

export type Tool = "none" | "eyedropper";
