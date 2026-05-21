import { DecimalPipe } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "app-color-picker-info",
  imports: [DecimalPipe],
  templateUrl: "./color-picker-info.component.html",
  styleUrl: "./color-picker-info.component.less",
})
export class ColorPickerInfoComponent {}
