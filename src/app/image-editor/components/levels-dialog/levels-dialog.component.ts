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

  readonly settingsChange = output<LevelsSettings>();
  readonly applied = output<LevelsSettings>();
  readonly cancelled = output<void>();

  private readonly dialogRef =
    viewChild.required<ElementRef<HTMLDialogElement>>("dlg");
  private readonly histCanvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("histCanvas");

  readonly settings = signal<LevelsSettings>(createDefaultLevelsSettings());
  readonly channel = signal<LevelsChannel>("master");
  readonly scale = signal<HistogramScale>("linear");
  readonly preview = signal<boolean>(true);

  readonly current = computed(() => this.settings()[this.channel()]);

  readonly channels = computed<{ value: LevelsChannel; label: string }[]>(
    () => {
      const base: { value: LevelsChannel; label: string }[] = [
        { value: "master", label: "RGB (Master)" },
        { value: "r", label: "Red" },
        { value: "g", label: "Green" },
        { value: "b", label: "Blue" },
      ];
      if (this.hasAlpha()) base.push({ value: "a", label: "Alpha" });
      return base;
    }
  );

  private rafId: number | null = null;

  constructor() {
    // Рисуем гистограмму при изменении входа/канала/шкалы
    effect(() => {
      this.source();
      this.channel();
      this.scale();
      this.current(); // чтобы перерисовывать маркеры
      queueMicrotask(() => this.drawHistogram());
    });

    // Эмитим изменения при preview
    effect(() => {
      const s = this.settings();
      if (this.preview()) {
        this.emitSettingsThrottled(s);
      }
    });

    // При выключении превью — сбрасываем картинку до оригинала
    effect(() => {
      if (!this.preview()) {
        this.settingsChange.emit(createDefaultLevelsSettings());
      } else {
        this.emitSettingsThrottled(this.settings());
      }
    });
  }

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
    this.drawHistogram();
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  // === Управление каналом/шкалой/превью ===

  onChannelChange(value: string): void {
    this.channel.set(value as LevelsChannel);
  }

  onScaleChange(value: string): void {
    this.scale.set(value as HistogramScale);
  }

  togglePreview(value: boolean): void {
    this.preview.set(value);
  }

  // === Слайдеры ===

  onBlack(v: number): void {
    this.updateCurrent((c) => {
      const black = Math.min(254, Math.max(0, v));
      const white = Math.max(black + 1, c.whitePoint);
      return { ...c, blackPoint: black, whitePoint: white };
    });
  }

  onWhite(v: number): void {
    this.updateCurrent((c) => {
      const white = Math.max(1, Math.min(255, v));
      const black = Math.min(white - 1, c.blackPoint);
      return { ...c, whitePoint: white, blackPoint: black };
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

  // === Кнопки ===

  onReset(): void {
    this.settings.set(createDefaultLevelsSettings());
  }

  onCancel(): void {
    this.settingsChange.emit(createDefaultLevelsSettings());
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

    // Фон
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

    // Маркеры (визуальные риски на нижней полосе)
    const c = this.current();
    this.drawMarker(ctx, W, H, c.blackPoint / 255, "#000", "#fff");
    this.drawMarker(ctx, W, H, c.whitePoint / 255, "#fff", "#000");

    // Маркер гаммы — между blackPoint и whitePoint
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

/**
  
  * Позиция маркера гаммы относительно [black; white] для визуализации.
  * gamma=1 → 0.5; gamma>1 (затемнение) → < 0.5; gamma<1 → > 0.5.
    */
function gammaToSliderPos(gamma: number): number {
  // Стандартная формула Photoshop: pos = 1 - log(gamma)/log(9.99) * 0.5 ...
  // Используем простую: pos = 0.5 + log(1/gamma) / (2*log(9.9))
  return 0.5 + Math.log(1 / gamma) / (2 * Math.log(9.9));
}
