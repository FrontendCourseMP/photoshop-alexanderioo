import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import {
  LevelsChannel,
  LevelsService,
  LevelsState,
  createDefaultLevels,
} from "../../services/levels.service";
import {
  computeHistograms,
  drawHistogram,
  Histograms,
} from "../../../../utilts/histogram.util";

const CHANNEL_COLORS: Record<LevelsChannel, string> = {
  master: "#cccccc",
  r: "#e53935",
  g: "#43a047",
  b: "#1e88e5",
  a: "#9e9e9e",
};

@Component({
  selector: "app-levels-dialog",
  standalone: true,
  templateUrl: "./levels-dialog.component.html",
  styleUrl: "./levels-dialog.component.less",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelsDialogComponent {
  private readonly levelsService = inject(LevelsService);

  /** Исходное изображение (read-only оригинал). */
  readonly source = input.required<ImageData>();

  /** Текущее превью (родитель отрисовывает его на canvas). */
  readonly previewChange = output<ImageData>();
  readonly applied = output<ImageData>();
  readonly cancelled = output<void>();

  readonly dialogRef =
    viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
  readonly histCanvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("histCanvas");

  readonly channel = signal<LevelsChannel>("master");
  readonly scale = signal<"linear" | "log">("linear");
  readonly preview = signal(true);
  readonly state = signal<LevelsState>(createDefaultLevels());

  readonly current = computed(() => this.state()[this.channel()]);

  private histograms: Histograms | null = null;
  private workingBuffer: ImageData | null = null;
  private rafHandle: number | null = null;

  readonly channels: { value: LevelsChannel; label: string }[] = [
    { value: "master", label: "RGB" },
    { value: "r", label: "Red" },
    { value: "g", label: "Green" },
    { value: "b", label: "Blue" },
    { value: "a", label: "Alpha" },
  ];

  constructor() {
    effect(() => {
      const src = this.source();
      this.histograms = computeHistograms(src);
      this.workingBuffer = this.levelsService.cloneImageData(src);
      queueMicrotask(() => {
        this.drawHist();
        this.schedulePreview();
      });
    });

    effect(() => {
      // перерисовка гистограммы при смене канала/шкалы
      this.channel();
      this.scale();
      queueMicrotask(() => this.drawHist());
    });

    effect(() => {
      // при изменении любых уровней или флага превью
      this.state();
      this.preview();
      this.schedulePreview();
    });
  }

  open(): void {
    const dlg = this.dialogRef().nativeElement;
    if (!dlg.open) dlg.showModal();
  }

  close(): void {
    const dlg = this.dialogRef().nativeElement;
    if (dlg.open) dlg.close();
  }

  // --- handlers ---

  onChannelChange(value: LevelsChannel): void {
    this.channel.set(value);
  }

  onScaleChange(value: "linear" | "log"): void {
    this.scale.set(value);
  }

  onPreviewToggle(value: boolean): void {
    this.preview.set(value);
  }

  onBlackChange(value: number): void {
    this.updateChannel((c) => {
      c.black = Math.min(value, c.white - 1);
    });
  }

  onWhiteChange(value: number): void {
    this.updateChannel((c) => {
      c.white = Math.max(value, c.black + 1);
    });
  }

  onGammaChange(value: number): void {
    this.updateChannel((c) => {
      c.gamma = Math.min(9.9, Math.max(0.1, value));
    });
  }

  reset(): void {
    this.state.set(createDefaultLevels());
  }

  cancel(): void {
    this.previewChange.emit(this.source());
    this.cancelled.emit();
    this.close();
  }

  apply(): void {
    const src = this.source();
    const out = new ImageData(src.width, src.height);
    this.levelsService.applyLevels(src, out, this.state());
    this.applied.emit(out);
    this.close();
  }

  // --- internals ---

  private updateChannel(
    patch: (c: { black: number; white: number; gamma: number }) => void
  ): void {
    this.state.update((s) => {
      const next = { ...s };
      const ch = { ...next[this.channel()] };
      patch(ch);
      next[this.channel()] = ch;
      return next;
    });
  }

  private schedulePreview(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
    }
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.emitPreview();
    });
  }

  private emitPreview(): void {
    const src = this.source();
    if (!this.preview()) {
      this.previewChange.emit(src);
      return;
    }
    if (
      !this.workingBuffer ||
      this.workingBuffer.width !== src.width ||
      this.workingBuffer.height !== src.height
    ) {
      this.workingBuffer = this.levelsService.cloneImageData(src);
    }
    this.levelsService.applyLevels(src, this.workingBuffer, this.state());
    this.previewChange.emit(this.workingBuffer);
  }

  private drawHist(): void {
    if (!this.histograms) return;
    const ch = this.channel();
    const canvas = this.histCanvasRef().nativeElement;
    drawHistogram(
      canvas,
      this.histograms[ch],
      this.scale(),
      CHANNEL_COLORS[ch]
    );
  }

  // --- helpers for template ---

  channelColor(): string {
    return CHANNEL_COLORS[this.channel()];
  }
}
