import { DecimalPipe } from "@angular/common";
import { Component, input } from "@angular/core";
import { PixelInfo } from "../../models/channel.model";

@Component({
  selector: "app-color-picker-info",
  imports: [DecimalPipe],
  templateUrl: "./color-picker-info.component.html",
  styleUrl: "./color-picker-info.component.less",
})
export class ColorPickerInfoComponent {
  readonly pixel = input<PixelInfo | null>(null);
}
