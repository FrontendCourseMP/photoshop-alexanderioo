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
import { ChannelKey } from "../../models/channel.model";

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
  readonly availableChannels = input<readonly ChannelKey[]>(["r", "g", "b"]);

  readonly settingsChange = output<ConvolutionSettings | null>();
  readonly applied = output<ConvolutionSettings>();
  readonly cancelled = output<void>();

  readonly settings = signal<ConvolutionSettings>(
    createDefaultConvolutionSettings()
  );
  readonly preview = signal<boolean>(true);

  readonly presets = KERNEL_PRESETS;
  readonly edgeModes: { value: EdgeMode; label: string }[] = [
    { value: "black", label: "Чёрный" },
    { value: "white", label: "Белый" },
    { value: "copy", label: "Копирование края" },
  ];

  readonly kernelSum = computed(() => getKernelSum(this.settings().kernel));

  // ✅ Какие каналы реально показывать пользователю
  readonly showR = computed(() => this.availableChannels().includes("r"));
  readonly showG = computed(() => this.availableChannels().includes("g"));
  readonly showB = computed(() => this.availableChannels().includes("b"));

  constructor() {
    effect(() => {
      const s = this.settings();
      if (this.preview()) {
        this.settingsChange.emit(s);
      } else {
        this.settingsChange.emit(null);
      }
    });

    // ✅ Если доступны не все каналы — отключаем недоступные в settings
    effect(() => {
      const avail = this.availableChannels();
      this.settings.update((s) => ({
        ...s,
        channels: {
          r: avail.includes("r") ? s.channels.r : false,
          g: avail.includes("g") ? s.channels.g : false,
          b: avail.includes("b") ? s.channels.b : false,
        },
      }));
    });
  }

  /* ---------- preset ---------- */

  onPresetChange(id: string): void {
    if (id === "custom") {
      this.settings.update((s) => ({ ...s, presetId: "custom" }));
      return;
    }

    const preset = KERNEL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.settings.update((s) => ({
      ...s,
      presetId: preset.id,
      kernel: [...preset.kernel],
      normalize: preset.normalize ?? false,
      bias: preset.bias ?? 0,
      abs: preset.abs ?? false,
    }));
  }

  onCellChange(idx: number, raw: string): void {
    const value = parseKernelValue(raw);
    this.settings.update((s) => {
      if (s.kernel[idx] === value) return s;

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
    this.settings.update((s) => {
      // ✅ Если значение реально не изменилось — не трогаем пресет
      if (s.normalize === value) return s;
      return { ...s, normalize: value, presetId: "custom" };
    });
  }

  onBiasChange(raw: string): void {
    const v = parseKernelValue(raw);
    this.settings.update((s) => {
      if (s.bias === v) return s;
      return { ...s, bias: v, presetId: "custom" };
    });
  }

  togglePreview(value: boolean): void {
    this.preview.set(value);
  }

  onReset(): void {
    const presetId = this.settings().presetId;
    const preset =
      KERNEL_PRESETS.find((p) => p.id === presetId) ?? KERNEL_PRESETS[0];
    const avail = this.availableChannels();
    this.settings.set({
      presetId: preset.id,
      kernel: [...preset.kernel],
      channels: {
        r: avail.includes("r"),
        g: avail.includes("g"),
        b: avail.includes("b"),
      },
      edge: "copy",
      normalize: preset.normalize ?? false,
      bias: preset.bias ?? 0,
      abs: preset.abs ?? false,
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
