import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ModalDialogComponent } from "../modal-dialog/modal-dialog.component";
import {
  InterpolationId,
  listInterpolations,
  getInterpolation,
  DEFAULT_INTERPOLATION,
} from "../../../../utilts/interpolation.utilts";
import { DecimalPipe } from "@angular/common";

export interface ResizeRequest {
  width: number;
  height: number;
  interpolation: InterpolationId;
}

type Unit = "percent" | "pixels";

@Component({
  selector: "app-resize-dialog",
  standalone: true,
  imports: [FormsModule, ModalDialogComponent, DecimalPipe],
  templateUrl: "./resize-dialog.component.html",
  styleUrl: "./resize-dialog.component.less",
})
export class ResizeDialogComponent {
  readonly sourceWidth = input.required<number>();
  readonly sourceHeight = input.required<number>();

  readonly applied = output<ResizeRequest>();
  readonly cancelled = output<void>();

  readonly unit = signal<Unit>("percent");
  readonly widthValue = signal<number>(100);
  readonly heightValue = signal<number>(100);
  readonly lockAspect = signal<boolean>(true);
  readonly interpolation = signal<InterpolationId>(DEFAULT_INTERPOLATION);

  readonly methods = listInterpolations();

  readonly currentMethod = computed(() =>
    getInterpolation(this.interpolation())
  );

  readonly targetSize = computed(() => {
    const u = this.unit();
    const sw = this.sourceWidth();
    const sh = this.sourceHeight();
    if (u === "percent") {
      return {
        w: Math.max(1, Math.round((sw * this.widthValue()) / 100)),
        h: Math.max(1, Math.round((sh * this.heightValue()) / 100)),
      };
    }
    return {
      w: Math.max(1, Math.round(this.widthValue())),
      h: Math.max(1, Math.round(this.heightValue())),
    };
  });

  readonly originalMP = computed(
    () => (this.sourceWidth() * this.sourceHeight()) / 1_000_000
  );
  readonly newMP = computed(() => {
    const t = this.targetSize();
    return (t.w * t.h) / 1_000_000;
  });

  readonly error = computed<string | null>(() => {
    const t = this.targetSize();
    if (t.w < 1 || t.h < 1) return "Размер должен быть ≥ 1";
    if (t.w > 10000 || t.h > 10000) return "Слишком большой размер (>10000px)";
    if (this.unit() === "percent") {
      if (this.widthValue() <= 0 || this.heightValue() <= 0)
        return "Процент должен быть > 0";
    }
    return null;
  });

  constructor() {
    // переключение единиц — пересчёт значений
    effect(() => {
      const u = this.unit();
      // ничего — оставляем как есть, переключение делается через onUnitChange
      void u;
    });
  }

  onUnitChange(value: string): void {
    const next = value as Unit;
    if (next === this.unit()) return;
    const sw = this.sourceWidth();
    const sh = this.sourceHeight();
    const t = this.targetSize();
    if (next === "percent") {
      this.widthValue.set(Math.round((t.w / sw) * 100));
      this.heightValue.set(Math.round((t.h / sh) * 100));
    } else {
      this.widthValue.set(t.w);
      this.heightValue.set(t.h);
    }
    this.unit.set(next);
  }

  onWidthChange(v: number): void {
    this.widthValue.set(v);
    if (this.lockAspect()) {
      const ratio = this.sourceHeight() / this.sourceWidth();
      if (this.unit() === "percent") {
        this.heightValue.set(v);
      } else {
        this.heightValue.set(Math.max(1, Math.round(v * ratio)));
      }
    }
  }

  onHeightChange(v: number): void {
    this.heightValue.set(v);
    if (this.lockAspect()) {
      const ratio = this.sourceWidth() / this.sourceHeight();
      if (this.unit() === "percent") {
        this.widthValue.set(v);
      } else {
        this.widthValue.set(Math.max(1, Math.round(v * ratio)));
      }
    }
  }

  onApply(): void {
    if (this.error()) return;
    const t = this.targetSize();
    this.applied.emit({
      width: t.w,
      height: t.h,
      interpolation: this.interpolation(),
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
