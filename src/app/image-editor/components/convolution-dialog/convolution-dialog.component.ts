import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  ConvolutionSettings,
  createDefaultConvolutionSettings,
} from "../../models/convolution.model";
import {
  EdgeMode,
  KERNEL_PRESETS,
  getKernelSum,
  parseKernelValue,
} from "../../../../utilts/convolution.utilts";
import { DecimalPipe } from "@angular/common";

@Component({
  selector: "app-convolution-dialog",
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: "./convolution-dialog.component.html",
  styleUrl: "./convolution-dialog.component.less",
})
export class ConvolutionDialogComponent {
  readonly isGrayscale = input<boolean>(false);
  readonly processing = input<boolean>(false);

  readonly settingsChange = output<ConvolutionSettings | null>();
  readonly applied = output<ConvolutionSettings>();
  readonly cancelled = output<void>();

  readonly settings = signal<ConvolutionSettings>(
    createDefaultConvolutionSettings(),
  );
  readonly preview = signal<boolean>(true);

  readonly presets = KERNEL_PRESETS;
  readonly edgeModes: { value: EdgeMode; label: string }[] = [
    { value: "black", label: "Чёрный" },
    { value: "white", label: "Белый" },
    { value: "copy", label: "Копирование края" },
  ];

  readonly kernelSum = computed(() => getKernelSum(this.settings().kernel));

  constructor() {
    effect(() => {
      const s = this.settings();
      if (this.preview()) {
        this.settingsChange.emit(s);
      } else {
        this.settingsChange.emit(null);
      }
    });
  }

  /* ---------- preset ---------- */

  onPresetChange(id: string): void {
    const preset = KERNEL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.settings.update((s) => ({
      ...s,
      presetId: preset.id,
      kernel: [...preset.kernel],
      normalize: preset.normalize ?? false,
      bias: preset.bias ?? 0,
    }));
  }

  /* ---------- kernel cells ---------- */

  onCellChange(idx: number, raw: string): void {
    const value = parseKernelValue(raw);
    this.settings.update((s) => {
      const k = [...s.kernel];
      k[idx] = value;
      return { ...s, kernel: k, presetId: "custom" };
    });
  }

  /* ---------- channels ---------- */

  toggleChannel(ch: "r" | "g" | "b"): void {
    this.settings.update((s) => ({
      ...s,
      channels: { ...s.channels, [ch]: !s.channels[ch] },
    }));
  }

  /* ---------- edge ---------- */

  onEdgeChange(value: string): void {
    this.settings.update((s) => ({ ...s, edge: value as EdgeMode }));
  }

  /* ---------- normalize / bias ---------- */

  onNormalizeChange(value: boolean): void {
    this.settings.update((s) => ({ ...s, normalize: value }));
  }

  onBiasChange(raw: string): void {
    const v = parseKernelValue(raw);
    this.settings.update((s) => ({ ...s, bias: v }));
  }

  /* ---------- preview ---------- */

  togglePreview(value: boolean): void {
    this.preview.set(value);
  }

  /* ---------- footer ---------- */

  onReset(): void {
    // Сбрасываем к текущему пресету (или к identity)
    const presetId = this.settings().presetId;
    const preset =
      KERNEL_PRESETS.find((p) => p.id === presetId) ?? KERNEL_PRESETS[0];
    this.settings.set({
      presetId: preset.id,
      kernel: [...preset.kernel],
      channels: { r: true, g: true, b: true },
      edge: "copy",
      normalize: preset.normalize ?? false,
      bias: preset.bias ?? 0,
    });
  }

  onCancel(): void {
    this.settingsChange.emit(null);
    this.cancelled.emit();
  }

  onApply(): void {
    this.applied.emit(this.settings());
  }
}
