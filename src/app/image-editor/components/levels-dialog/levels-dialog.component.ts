import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  LevelsChannel,
  LevelsSettings,
  HistogramScale,
  createDefaultLevelsSettings,
} from "../../models/levels.model";
import { computeHistogram } from "../../../../utilts/levels.utilts";
import { ChannelKey } from "../../models/channel.model";

@Component({
  selector: "app-levels-dialog",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./levels-dialog.component.html",
  styleUrl: "./levels-dialog.component.less",
})
export class LevelsDialogComponent implements AfterViewInit, OnDestroy {
  readonly source = input.required<ImageData | null>();
  readonly hasAlpha = input<boolean>(true);
  readonly availableChannels = input<readonly ChannelKey[]>([
    "r",
    "g",
    "b",
    "a",
  ]);

  readonly settingsChange = output<LevelsSettings | null>();
  readonly applied = output<LevelsSettings>();
  readonly cancelled = output<void>();

  private readonly dialogRef =
    viewChild.required<ElementRef<HTMLDialogElement>>("dlg");
  private readonly histCanvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("histCanvas");
  private readonly trackRef =
    viewChild.required<ElementRef<HTMLDivElement>>("track");

  readonly settings = signal<LevelsSettings>(createDefaultLevelsSettings());
  readonly channel = signal<LevelsChannel>("master");
  readonly scale = signal<HistogramScale>("linear");
  readonly preview = signal<boolean>(true);

  readonly current = computed(() => this.settings()[this.channel()]);

  readonly gammaMarkerPercent = computed(() => {
    const c = this.current();
    const black = c.blackPoint;
    const white = c.whitePoint;
    const pos = gammaToSliderPos(c.gamma);
    return ((black + (white - black) * pos) / 255) * 100;
  });

  readonly channels = computed<{ value: LevelsChannel; label: string }[]>(
    () => {
      const avail = this.availableChannels();
      const hasR = avail.includes("r");
      const hasG = avail.includes("g");
      const hasB = avail.includes("b");
      const hasA = avail.includes("a") && this.hasAlpha();
      const isGray = hasR && !hasG && !hasB;

      const list: { value: LevelsChannel; label: string }[] = [];

      if (isGray) {
        list.push({ value: "master", label: "Gray" });
      } else if (hasR && hasG && hasB) {
        list.push({ value: "master", label: "RGB (Master)" });
        list.push({ value: "r", label: "Red" });
        list.push({ value: "g", label: "Green" });
        list.push({ value: "b", label: "Blue" });
      }

      if (hasA) {
        list.push({ value: "a", label: "Alpha" });
      }

      return list;
    }
  );

  private dragging: "black" | "gamma" | "white" | null = null;
  private dragMoveHandler: ((e: MouseEvent) => void) | null = null;
  private dragUpHandler: (() => void) | null = null;
  private rafId: number | null = null;

  constructor() {
    effect(() => {
      this.source();
      this.channel();
      this.scale();
      this.current();
      requestAnimationFrame(() => this.drawHistogram());
      setTimeout(() => this.drawHistogram(), 0);
    });

    effect(() => {
      const list = this.channels();
      if (!list.some((c) => c.value === this.channel()) && list.length > 0) {
        this.channel.set(list[0].value);
      }
    });

    effect(() => {
      const s = this.settings();
      const enabled = this.preview();
      if (enabled) {
        this.emitSettingsThrottled(s);
      } else {
        this.settingsChange.emit(null);
      }
    });
  }

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.show();
    requestAnimationFrame(() => this.drawHistogram());
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.dragMoveHandler) {
      window.removeEventListener("mousemove", this.dragMoveHandler);
    }
    if (this.dragUpHandler) {
      window.removeEventListener("mouseup", this.dragUpHandler);
    }
  }

  onChannelChange(value: string): void {
    this.channel.set(value as LevelsChannel);
  }

  onScaleChange(value: string): void {
    this.scale.set(value as HistogramScale);
  }

  togglePreview(value: boolean): void {
    this.preview.set(value);
  }

  onBlack(v: number): void {
    this.updateCurrent((c) => {
      const maxBlack = c.whitePoint - 1;
      const black = Math.min(maxBlack, Math.max(0, v));
      return { ...c, blackPoint: black };
    });
  }

  onWhite(v: number): void {
    this.updateCurrent((c) => {
      const minWhite = c.blackPoint + 1;
      const white = Math.max(minWhite, Math.min(255, v));
      return { ...c, whitePoint: white };
    });
  }

  onGamma(v: number): void {
    const gamma = Math.min(9.9, Math.max(0.1, +v));
    this.updateCurrent((c) => ({ ...c, gamma }));
  }

  private updateCurrent(
    fn: (c: LevelsSettings[LevelsChannel]) => LevelsSettings[LevelsChannel]
  ): void {
    const ch = this.channel();
    this.settings.update((s) => ({ ...s, [ch]: fn(s[ch]) }));
  }

  // === Drag-маркеры ===

  startDrag(event: MouseEvent, type: "black" | "gamma" | "white"): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = type;
    this.attachGlobalListeners();
  }

  onTrackMouseDown(event: MouseEvent): void {
    const value = this.eventToValue(event);
    if (value === null) return;
    const c = this.current();
    const distBlack = Math.abs(value - c.blackPoint);
    const distWhite = Math.abs(value - c.whitePoint);
    const gammaVal =
      c.blackPoint + (c.whitePoint - c.blackPoint) * gammaToSliderPos(c.gamma);
    const distGamma = Math.abs(value - gammaVal);

    const min = Math.min(distBlack, distGamma, distWhite);
    let type: "black" | "gamma" | "white";
    if (min === distBlack) type = "black";
    else if (min === distGamma) type = "gamma";
    else type = "white";

    this.dragging = type;
    this.applyDragValue(value);
    this.attachGlobalListeners();
  }

  private attachGlobalListeners(): void {
    this.dragMoveHandler = (e: MouseEvent) => {
      if (!this.dragging) return;
      const value = this.eventToValue(e);
      if (value === null) return;
      this.applyDragValue(value);
    };
    this.dragUpHandler = () => {
      this.dragging = null;
      if (this.dragMoveHandler) {
        window.removeEventListener("mousemove", this.dragMoveHandler);
      }
      if (this.dragUpHandler) {
        window.removeEventListener("mouseup", this.dragUpHandler);
      }
      this.dragMoveHandler = null;
      this.dragUpHandler = null;
    };
    window.addEventListener("mousemove", this.dragMoveHandler);
    window.addEventListener("mouseup", this.dragUpHandler);
  }

  private eventToValue(event: MouseEvent): number | null {
    const el = this.trackRef()?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(pct * 255);
  }

  private applyDragValue(value: number): void {
    if (this.dragging === "black") {
      this.onBlack(value);
    } else if (this.dragging === "white") {
      this.onWhite(value);
    } else if (this.dragging === "gamma") {
      const c = this.current();
      const range = c.whitePoint - c.blackPoint;
      if (range <= 0) return;
      const pos = (value - c.blackPoint) / range;
      const clamped = Math.max(0.001, Math.min(0.999, pos));
      const logGamma = (clamped - 0.5) * 2 * Math.log(9.9);
      const gamma = 1 / Math.exp(logGamma);
      this.onGamma(Math.max(0.1, Math.min(9.9, gamma)));
    }
  }

  // === Footer ===

  onReset(): void {
    this.settings.set(createDefaultLevelsSettings());
  }

  onCancel(): void {
    this.settingsChange.emit(null);
    this.dialogRef().nativeElement.close();
    this.cancelled.emit();
  }

  onApply(): void {
    const s = this.settings();
    this.dialogRef().nativeElement.close();
    this.applied.emit(s);
  }

  // === Гистограмма ===

  private drawHistogram(): void {
    const src = this.source();
    const canvas = this.histCanvasRef()?.nativeElement;
    if (!canvas || !src) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, W, H);

    const hist = computeHistogram(src, this.channel());
    let max = 0;
    for (let i = 0; i < 256; i++) if (hist[i] > max) max = hist[i];
    if (max === 0) return;

    const useLog = this.scale() === "log";
    const norm = (v: number) =>
      useLog ? Math.log(1 + v) / Math.log(1 + max) : v / max;

    const colors: Record<LevelsChannel, string> = {
      master: "#cccccc",
      r: "#ff5555",
      g: "#55ff55",
      b: "#5599ff",
      a: "#aaaaaa",
    };
    ctx.fillStyle = colors[this.channel()];

    const barW = W / 256;
    for (let i = 0; i < 256; i++) {
      const h = norm(hist[i]) * H;
      ctx.fillRect(i * barW, H - h, Math.max(1, barW), h);
    }

    const c = this.current();
    this.drawMarker(ctx, W, H, c.blackPoint / 255, "#000", "#fff");
    this.drawMarker(ctx, W, H, c.whitePoint / 255, "#fff", "#000");

    const gammaPos =
      c.blackPoint / 255 +
      ((c.whitePoint - c.blackPoint) / 255) * gammaToSliderPos(c.gamma);
    this.drawMarker(ctx, W, H, gammaPos, "#888", "#fff");
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    pos: number,
    fill: string,
    stroke: string
  ): void {
    const x = pos * W;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x - 5, H + 8);
    ctx.lineTo(x + 5, H + 8);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private emitSettingsThrottled(s: LevelsSettings): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.settingsChange.emit(s);
    });
  }
}

function gammaToSliderPos(gamma: number): number {
  return 0.5 + Math.log(1 / gamma) / (2 * Math.log(9.9));
}
