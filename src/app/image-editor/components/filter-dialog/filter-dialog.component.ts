import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";
import { ModalDialogComponent } from "../modal-dialog/modal-dialog.component";
import {
  EdgeMode,
  KERNEL_PRESETS,
} from "../../../../utilts/convolution.utilts";
import { ConvolutionPayload } from "../../models/convolution.model";
import { ChannelKey, ChannelState } from "../../models/channel.model";

@Component({
  selector: "app-filter-dialog",
  standalone: true,
  imports: [ModalDialogComponent],
  templateUrl: "./filter-dialog.component.html",
  styleUrl: "./filter-dialog.component.less",
})
export class FilterDialogComponent {
  readonly availableChannels = input.required<readonly ChannelKey[]>();

  readonly preview = output<ConvolutionPayload | null>();
  readonly applied = output<ConvolutionPayload>();
  readonly cancelled = output<void>();

  readonly presets = KERNEL_PRESETS;
  readonly presetId = signal<string>("identity");
  readonly kernel = signal<number[]>([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  readonly edge = signal<EdgeMode>("copy");
  readonly previewEnabled = signal<boolean>(false);

  readonly channels = signal<ChannelState>({
    r: true,
    g: true,
    b: true,
    a: false,
  });

  readonly errorMsg = signal<string | null>(null);

  readonly currentPreset = computed(() =>
    this.presets.find((p) => p.id === this.presetId())
  );

  constructor() {
    // При смене пресета — заполняем 9 полей
    effect(() => {
      const p = this.currentPreset();
      if (p) this.kernel.set([...p.kernel]);
    });

    // Подстраиваем каналы под доступные (если канала нет в картинке — отключаем)
    effect(() => {
      const avail = this.availableChannels();
      const cs = this.channels();
      const next: ChannelState = { r: false, g: false, b: false, a: false };
      for (const k of avail) next[k] = cs[k];

      const anySelected = avail.some((k) => next[k]);
      if (!anySelected) {
        for (const k of avail) if (k !== "a") next[k] = true;
      }

      if (
        next.r !== cs.r ||
        next.g !== cs.g ||
        next.b !== cs.b ||
        next.a !== cs.a
      ) {
        this.channels.set(next);
      }
    });

    // Превью
    effect(() => {
      this.kernel();
      this.edge();
      this.channels();
      const enabled = this.previewEnabled();

      if (!enabled) {
        this.preview.emit(null);
        return;
      }
      const payload = this.buildPayload();
      if (payload) this.preview.emit(payload);
    });
  }

  isChannelAvailable(key: ChannelKey): boolean {
    return this.availableChannels().includes(key);
  }

  onPresetChange(v: string): void {
    this.presetId.set(v);
  }

  onCellChange(i: number, value: number): void {
    const k = [...this.kernel()];
    k[i] = Number.isFinite(value) ? value : 0;
    this.kernel.set(k);
  }

  onEdgeChange(v: string): void {
    this.edge.set(v as EdgeMode);
  }

  onChannelToggle(key: ChannelKey): void {
    if (!this.isChannelAvailable(key)) return;
    this.channels.update((c) => ({ ...c, [key]: !c[key] }));
  }

  togglePreview(v: boolean): void {
    this.previewEnabled.set(v);
  }

  onReset(): void {
    this.presetId.set("identity");
    this.kernel.set([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    this.edge.set("copy");
    this.errorMsg.set(null);
  }

  private validate(): boolean {
    const k = this.kernel();
    if (k.length !== 9 || k.some((v) => !Number.isFinite(v))) {
      this.errorMsg.set("Все 9 ячеек ядра должны содержать числа");
      return false;
    }
    if (k.some((v) => Math.abs(v) > 1000)) {
      this.errorMsg.set("Значения ядра должны быть в диапазоне [-1000; 1000]");
      return false;
    }
    const cs = this.channels();
    if (!cs.r && !cs.g && !cs.b && !cs.a) {
      this.errorMsg.set("Выберите хотя бы один канал");
      return false;
    }
    this.errorMsg.set(null);
    return true;
  }

  private buildPayload(): ConvolutionPayload | null {
    if (!this.validate()) return null;
    return {
      kernel: this.kernel(),
      edge: this.edge(),
      channels: this.channels(),
      divisor: this.currentPreset()?.divisor,
    };
  }

  onApply(): void {
    const payload = this.buildPayload();
    if (!payload) return;
    this.applied.emit(payload);
  }

  onCancel(): void {
    this.preview.emit(null);
    this.cancelled.emit();
  }
}
