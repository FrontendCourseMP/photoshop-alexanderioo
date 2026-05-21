import {
  Component,
  ElementRef,
  computed,
  effect,
  signal,
  viewChild,
} from "@angular/core";
import { decodeGB7, encodeGB7 } from "../../utilts/gb7.utilts";
import { ImageInfo, DownloadButton, Tool } from "./models/image-info.model";
import {
  ChannelKey,
  ChannelState,
  ChannelThumb,
  PixelInfo,
} from "./models/channel.model";
import {
  applyChannelMask,
  makeChannelThumb,
} from "../../utilts/channel.utilts";
import { rgbToLab } from "../../utilts/color.utilts";
import { EditorToolbarComponent } from "./components/editor-toolbar/editor-toolbar.component";
import { EditorStatusBarComponent } from "./components/editor-status-bar/editor-status-bar.component";
import { ChannelsPanelComponent } from "./components/channels-panel/channels-panel.component";
import { ColorPickerInfoComponent } from "./components/color-picker-info/color-picker-info.component";

@Component({
  selector: "app-image-editor",
  standalone: true,
  imports: [
    EditorToolbarComponent,
    EditorStatusBarComponent,
    ChannelsPanelComponent,
    ColorPickerInfoComponent,
  ],
  templateUrl: "./image-editor.component.html",
  styleUrl: "./image-editor.component.less",
})
export class ImageEditorComponent {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");

  readonly info = signal<ImageInfo | null>(null);
  readonly hasImage = computed(() => this.info() !== null);
  readonly hasMask = computed(() => this.info()?.hasMask ?? false);
  readonly showMasked = signal(false);

  readonly activeTool = signal<Tool>("none");
  readonly pixelInfo = signal<PixelInfo | null>(null);

  readonly channelState = signal<ChannelState>({
    r: true,
    g: true,
    b: true,
    a: true,
  });
  readonly channelThumbs = signal<readonly ChannelThumb[]>([]);

  private originalImageData: ImageData | null = null;
  private lastGb7Buffer: ArrayBuffer | null = null;

  readonly downloadButtons: readonly DownloadButton[] = [
    { label: "Скачать PNG", action: () => this.savePng() },
    { label: "Скачать JPG", action: () => this.saveJpg() },
    { label: "Скачать GB7", action: () => this.saveGb7() },
  ];

  constructor() {
    // Перерисовка GB7 при переключении маски
    effect(() => {
      const show = this.showMasked();
      if (this.lastGb7Buffer) {
        const { imageData, depth, hasMask } = decodeGB7(
          this.lastGb7Buffer,
          show
        );
        this.setOriginal(imageData, depth, hasMask);
      }
    });

    // Перерисовка при изменении состояния каналов
    effect(() => {
      const state = this.channelState();
      if (this.originalImageData) {
        const masked = applyChannelMask(this.originalImageData, state);
        this.drawToCanvas(masked);
      }
    });
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef().nativeElement;
  }

  private get ctx(): CanvasRenderingContext2D {
    const c = this.canvas.getContext("2d");
    if (!c) throw new Error("Canvas 2D context is not available");
    return c;
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.showMasked.set(false);
    this.channelState.set({ r: true, g: true, b: true, a: true });
    this.pixelInfo.set(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "gb7") this.loadGb7(file);
    else {
      this.lastGb7Buffer = null;
      this.loadDefaultImage(file);
    }
    input.value = "";
  }

  toggleMask(): void {
    this.showMasked.update((v) => !v);
  }

  onToolSelected(tool: Tool): void {
    this.activeTool.set(tool);
    if (tool !== "eyedropper") this.pixelInfo.set(null);
  }

  onChannelToggle(key: ChannelKey): void {
    this.channelState.update((s) => ({ ...s, [key]: !s[key] }));
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.activeTool() !== "eyedropper" || !this.originalImageData) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height)
      return;

    const i = (y * this.canvas.width + x) * 4;
    const d = this.originalImageData.data;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2],
      a = d[i + 3];
    const [l, labA, labB] = rgbToLab(r, g, b);

    this.pixelInfo.set({ x, y, r, g, b, a, l, labA, labB });
  }

  private loadGb7(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      this.lastGb7Buffer = buffer;
      const { imageData, depth, hasMask } = decodeGB7(
        buffer,
        this.showMasked()
      );
      this.setOriginal(imageData, depth, hasMask);
    };
    reader.readAsArrayBuffer(file);
  }

  private loadDefaultImage(file: File): void {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width = image.width;
      tmp.height = image.height;
      tmp.getContext("2d")!.drawImage(image, 0, 0);
      const data = tmp
        .getContext("2d")!
        .getImageData(0, 0, image.width, image.height);
      const depth = this.detectColorDepth(data);
      this.setOriginal(data, depth, false);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  }

  private detectColorDepth(data: ImageData): number {
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] < 255) return 32;
    }
    return 24;
  }

  private setOriginal(
    imageData: ImageData,
    depth: number,
    hasMask: boolean
  ): void {
    this.originalImageData = imageData;
    this.info.set({
      width: imageData.width,
      height: imageData.height,
      depth,
      hasMask,
    });
    this.regenerateThumbs(imageData);
    // Применяем текущее состояние каналов
    this.drawToCanvas(applyChannelMask(imageData, this.channelState()));
  }

  private drawToCanvas(imageData: ImageData): void {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx.clearRect(0, 0, imageData.width, imageData.height);
    this.ctx.putImageData(imageData, 0, 0);
  }

  private regenerateThumbs(source: ImageData): void {
    const thumbs: ChannelThumb[] = [
      { key: "r", label: "Red", dataUrl: makeChannelThumb(source, "r") },
      { key: "g", label: "Green", dataUrl: makeChannelThumb(source, "g") },
      { key: "b", label: "Blue", dataUrl: makeChannelThumb(source, "b") },
      { key: "a", label: "Alpha", dataUrl: makeChannelThumb(source, "a") },
    ];
    this.channelThumbs.set(thumbs);
  }

  private savePng(): void {
    this.download(this.canvas.toDataURL("image/png"), "image.png");
  }
  private saveJpg(): void {
    this.download(this.canvas.toDataURL("image/jpeg"), "image.jpg");
  }
  private saveGb7(): void {
    const buffer = encodeGB7(this.ctx, this.canvas.width, this.canvas.height);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    this.download(url, "image.gb7");
    URL.revokeObjectURL(url);
  }
  private download(url: string, fileName: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  }
}
