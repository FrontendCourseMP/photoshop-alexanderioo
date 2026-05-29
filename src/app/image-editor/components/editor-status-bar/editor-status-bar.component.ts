import { Component, input, output } from "@angular/core";
import { ImageInfo } from "../../models/image-info.model";
import { SCALE_PRESETS, MIN_SCALE, MAX_SCALE } from "../../models/scale.model";

@Component({
  selector: "app-editor-status-bar",
  standalone: true,
  imports: [],
  templateUrl: "./editor-status-bar.component.html",
  styleUrl: "./editor-status-bar.component.less",
})
export class EditorStatusBarComponent {
  readonly info = input<ImageInfo | null>(null);
  readonly scale = input<number>(100);

  readonly scaleChanged = output<number>();

  readonly presets = SCALE_PRESETS;
  readonly min = MIN_SCALE;
  readonly max = MAX_SCALE;

  onRange(v: number): void {
    const clamped = Math.max(this.min, Math.min(this.max, Math.round(v)));
    this.scaleChanged.emit(clamped);
  }

  onPreset(v: string): void {
    const n = +v;
    if (Number.isFinite(n)) this.scaleChanged.emit(n);
  }
}
