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
import {
  detectChannels,
  visibleChannelList,
} from "../../utilts/channel-detect.utilts";
import { rgbToLab } from "../../utilts/color.utilts";
import { applyLevels } from "../../utilts/levels.utilts";
import { LevelsSettings } from "./models/levels.model";
import {
  getInterpolation,
  InterpolationId,
  DEFAULT_INTERPOLATION,
} from "../../utilts/interpolation.utilts";
import { MIN_SCALE, MAX_SCALE } from "./models/scale.model";
import { EditorToolbarComponent } from "./components/editor-toolbar/editor-toolbar.component";
import { EditorStatusBarComponent } from "./components/editor-status-bar/editor-status-bar.component";
import { ChannelsPanelComponent } from "./components/channels-panel/channels-panel.component";
import { ColorPickerInfoComponent } from "./components/color-picker-info/color-picker-info.component";
import { LevelsDialogComponent } from "./components/levels-dialog/levels-dialog.component";
import {
  ResizeDialogComponent,
  ResizeRequest,
} from "./components/resize-dialog/resize-dialog.component";
import { ConvolutionDialogComponent } from "./components/convolution-dialog/convolution-dialog.component";
import { ConvolutionSettings } from "./models/convolution.model";
import { applyConvolutionAsync } from "../../utilts/convolution.utilts";

@Component({
  selector: "app-image-editor",
  standalone: true,
  imports: [
    EditorToolbarComponent,
    EditorStatusBarComponent,
    ChannelsPanelComponent,
    ColorPickerInfoComponent,
    LevelsDialogComponent,
    ResizeDialogComponent,
    ConvolutionDialogComponent,
  ],
  templateUrl: "./image-editor.component.html",
  styleUrl: "./image-editor.component.less",
})
export class ImageEditorComponent {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");
  private readonly canvasAreaRef =
    viewChild.required<ElementRef<HTMLElement>>("canvasArea");

  readonly info = signal<ImageInfo | null>(null);
  readonly hasImage = computed(() => this.info() !== null);
  readonly hasMask = computed(() => this.info()?.hasMask ?? false);
  readonly showMasked = signal(false);

  readonly currentInterpolation = signal<InterpolationId>(
    DEFAULT_INTERPOLATION
  );
  private scaleDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeTool = signal<Tool>("none");
  readonly pixelInfo = signal<PixelInfo | null>(null);

  readonly availableChannels = signal<readonly ChannelKey[]>([
    "r",
    "g",
    "b",
    "a",
  ]);
  readonly hasAlphaChannel = computed(() =>
    this.availableChannels().includes("a")
  );
  readonly isGrayscaleImage = signal<boolean>(false);

  readonly channelState = signal<ChannelState>({
    r: true,
    g: true,
    b: true,
    a: true,
  });
  readonly channelThumbs = signal<readonly ChannelThumb[]>([]);

  readonly scale = signal<number>(100);

  readonly levelsOpen = signal(false);
  readonly levelsSource = signal<ImageData | null>(null);
  readonly previewImageData = signal<ImageData | null>(null);

  readonly resizeOpen = signal(false);

  readonly convolutionOpen = signal(false);
  readonly convolutionProcessing = signal(false);
  private convPreviewToken = 0;

  private originalImageData: ImageData | null = null;
  private lastGb7Buffer: ArrayBuffer | null = null;
  private forceGrayscale: boolean = false;

  readonly downloadButtons: readonly DownloadButton[] = [
    { label: "Скачать PNG", action: () => this.savePng() },
    { label: "Скачать JPG", action: () => this.saveJpg() },
    { label: "Скачать GB7", action: () => this.saveGb7() },
  ];

  constructor() {
    effect(() => {
      const show = this.showMasked();
      if (this.lastGb7Buffer) {
        const { imageData, depth, hasMask } = decodeGB7(
          this.lastGb7Buffer,
          show
        );
        this.setOriginal(imageData, depth, hasMask, true);
      }
    });

    effect(() => {
      this.channelState();
      this.previewImageData();
      this.resampleAndDraw();
    });

    effect(() => {
      this.scale();
      this.currentInterpolation();
      this.scheduleResampleAndDraw();
    });
  }

  get sourceWidth(): number {
    return this.originalImageData?.width ?? 0;
  }
  get sourceHeight(): number {
    return this.originalImageData?.height ?? 0;
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
    this.pixelInfo.set(null);
    this.previewImageData.set(null);

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
    if (!this.availableChannels().includes(key)) return;
    this.channelState.update((s) => ({ ...s, [key]: !s[key] }));
  }

  onScaleChanged(v: number): void {
    this.scale.set(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(v))));
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.activeTool() !== "eyedropper" || !this.originalImageData) return;

    const rect = this.canvas.getBoundingClientRect();
    // ВАЖНО: canvas теперь содержит уже масштабированное изображение,
    // поэтому пересчёт координат идёт через размеры исходника
    const src = this.originalImageData;
    const scaleX = src.width / rect.width;
    const scaleY = src.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x < 0 || y < 0 || x >= src.width || y >= src.height) return;

    const i = (y * src.width + x) * 4;
    const d = src.data;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2],
      a = d[i + 3];
    const [l, labA, labB] = rgbToLab(r, g, b);
    this.pixelInfo.set({
      x,
      y,
      r,
      g,
      b,
      a,
      l,
      labA,
      labB,
      isGrayscale: this.isGrayscaleImage(),
    });
  }

  // === Levels ===

  openLevels(): void {
    if (!this.originalImageData) return;
    this.levelsSource.set(this.originalImageData);
    this.levelsOpen.set(true);
  }

  onLevelsPreview(settings: LevelsSettings | null): void {
    if (!settings || !this.originalImageData) {
      this.previewImageData.set(null);
      return;
    }
    const result = applyLevels(
      this.originalImageData,
      settings,
      this.hasAlphaChannel()
    );
    this.previewImageData.set(result);
  }

  onLevelsApply(settings: LevelsSettings): void {
    if (!this.originalImageData) {
      this.levelsOpen.set(false);
      return;
    }
    const result = applyLevels(
      this.originalImageData,
      settings,
      this.hasAlphaChannel()
    );
    this.originalImageData = result;
    this.previewImageData.set(null);
    this.refreshChannelsFromImage(result);
    this.resampleAndDraw();
    this.levelsOpen.set(false);
  }

  onLevelsCancel(): void {
    this.previewImageData.set(null);
    this.levelsOpen.set(false);
  }

  openResize(): void {
    if (!this.originalImageData) return;
    this.resizeOpen.set(true);
  }

  onResizeApply(req: ResizeRequest): void {
    if (!this.originalImageData) {
      this.resizeOpen.set(false);
      return;
    }
    const algo = getInterpolation(req.interpolation);
    const resized = algo.resample(
      this.originalImageData,
      req.width,
      req.height
    );
    this.originalImageData = resized;
    this.previewImageData.set(null);
    this.info.update((i) =>
      i ? { ...i, width: resized.width, height: resized.height } : i
    );
    this.refreshChannelsFromImage(resized);
    this.fitToScreen(resized.width, resized.height);
    this.resampleAndDraw();
    this.resizeOpen.set(false);
  }

  onResizeCancel(): void {
    this.resizeOpen.set(false);
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
      this.setOriginal(imageData, depth, hasMask, true);
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
      this.setOriginal(data, depth, false, false);
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
    hasMask: boolean,
    forceGrayscale: boolean
  ): void {
    this.originalImageData = imageData;
    this.forceGrayscale = forceGrayscale;
    this.previewImageData.set(null);
    this.info.set({
      width: imageData.width,
      height: imageData.height,
      depth,
      hasMask,
    });
    this.refreshChannelsFromImage(imageData);
    this.fitToScreen(imageData.width, imageData.height);
    this.resampleAndDraw();
  }

  private refreshChannelsFromImage(source: ImageData): void {
    const detected = detectChannels(source, this.forceGrayscale);
    const list = visibleChannelList(detected);
    this.availableChannels.set(list);
    this.isGrayscaleImage.set(detected.grayscale);

    const prev = this.channelState();
    const next: ChannelState = { r: false, g: false, b: false, a: false };
    for (const k of list) next[k] = prev[k];

    if (list.every((k) => !next[k])) {
      for (const k of list) next[k] = true;
    }
    this.channelState.set(next);

    const labels: Record<ChannelKey, string> = {
      r: detected.grayscale ? "Gray" : "Red",
      g: "Green",
      b: "Blue",
      a: "Alpha",
    };
    const thumbs: ChannelThumb[] = list.map((key) => ({
      key,
      label: labels[key],
      dataUrl: makeChannelThumb(source, key),
    }));
    this.channelThumbs.set(thumbs);
  }

  private fitToScreen(w: number, h: number): void {
    const area = this.canvasAreaRef()?.nativeElement;
    if (!area || area.clientWidth === 0 || area.clientHeight === 0) {
      requestAnimationFrame(() => this.fitToScreen(w, h));
      return;
    }
    const padding = 50;
    const availW = Math.max(1, area.clientWidth - padding * 2);
    const availH = Math.max(1, area.clientHeight - padding * 2);
    const ratio = Math.min(availW / w, availH / h);
    let pct = Math.round(ratio * 100);
    pct = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pct));
    this.scale.set(pct);
  }

  /**
   * Главный метод отрисовки:
   * 1) Берёт текущий ImageData (preview или original)
   * 2) Ресэмплит его по текущему масштабу через выбранный алгоритм интерполяции
   * 3) Применяет маску каналов
   * 4) Рисует в canvas
   */
  private resampleAndDraw(): void {
    const orig = this.originalImageData;
    if (!orig) return;

    const src = this.previewImageData() ?? orig;
    const pct = this.scale() / 100;

    // ✅ Размеры считаем ТОЛЬКО от оригинала — пропорции сохраняются
    const dstW = Math.max(1, Math.round(orig.width * pct));
    const dstH = Math.max(1, Math.round(orig.height * pct));

    const scaled =
      src.width === dstW && src.height === dstH
        ? src
        : getInterpolation(this.currentInterpolation()).resample(
            src,
            dstW,
            dstH
          );

    const masked = applyChannelMask(
      scaled,
      this.channelState(),
      this.isGrayscaleImage()
    );
    this.drawToCanvas(masked);
  }

  /**
   * То же самое, но с debounce — для движения ползунка масштаба.
   * Избегает дикого CPU-расхода при перетаскивании.
   */
  private scheduleResampleAndDraw(delay = 120): void {
    if (this.scaleDebounceTimer !== null) clearTimeout(this.scaleDebounceTimer);
    this.scaleDebounceTimer = setTimeout(() => {
      this.scaleDebounceTimer = null;
      this.resampleAndDraw();
    }, delay);
  }

  private drawToCanvas(imageData: ImageData): void {
    const canvas = this.canvas;

    if (
      canvas.width !== imageData.width ||
      canvas.height !== imageData.height
    ) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
    }

    this.ctx.putImageData(imageData, 0, 0);

    if (canvas.style.width !== "") canvas.style.width = "";
    if (canvas.style.height !== "") canvas.style.height = "";
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

  openConvolution(): void {
    if (!this.originalImageData) return;
    this.convolutionOpen.set(true);
  }

  async onConvolutionPreview(
    settings: ConvolutionSettings | null
  ): Promise<void> {
    const token = ++this.convPreviewToken;
    if (!settings || !this.originalImageData) {
      this.previewImageData.set(null);
      this.convolutionProcessing.set(false);
      return;
    }
    this.convolutionProcessing.set(true);
    try {
      const result = await applyConvolutionAsync(this.originalImageData, {
        kernel: settings.kernel,
        channels: settings.channels,
        edge: settings.edge,
        normalize: settings.normalize,
        bias: settings.bias,
        abs: settings.abs,
        grayscale: this.isGrayscaleImage(),
      });
      if (token !== this.convPreviewToken) return;
      this.previewImageData.set(result);
    } finally {
      if (token === this.convPreviewToken) {
        this.convolutionProcessing.set(false);
      }
    }
  }

  async onConvolutionApply(settings: ConvolutionSettings): Promise<void> {
    if (!this.originalImageData) {
      this.convolutionOpen.set(false);
      return;
    }
    this.convolutionOpen.set(false);
    this.convPreviewToken++;
    this.previewImageData.set(null);
    this.convolutionProcessing.set(true);
    try {
      const result = await applyConvolutionAsync(this.originalImageData, {
        kernel: settings.kernel,
        channels: settings.channels,
        edge: settings.edge,
        normalize: settings.normalize,
        bias: settings.bias,
        abs: settings.abs,
        grayscale: this.isGrayscaleImage(),
      });
      this.originalImageData = result;
      this.refreshChannelsFromImage(result);
      this.resampleAndDraw();
    } finally {
      this.convolutionProcessing.set(false);
    }
  }

  onConvolutionCancel(): void {
    this.convPreviewToken++;
    this.previewImageData.set(null);
    this.convolutionProcessing.set(false);
    this.convolutionOpen.set(false);
  }
}
