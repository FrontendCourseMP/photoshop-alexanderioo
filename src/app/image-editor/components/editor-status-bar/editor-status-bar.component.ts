import { Component, input } from "@angular/core";
import { ImageInfo } from "../../models/image-info.model";

@Component({
  selector: "app-editor-status-bar",
  imports: [],
  templateUrl: "./editor-status-bar.component.html",
  styleUrl: "./editor-status-bar.component.less",
})
export class EditorStatusBarComponent {
  readonly info = input<ImageInfo | null>(null);
}
