import { Component, input, output } from "@angular/core";
import { DownloadButton } from "../../models/image-info.model";
import { Tool } from "../../models/image-info.model";
@Component({
  selector: "app-editor-toolbar",
  standalone: true,
  imports: [],
  templateUrl: "./editor-toolbar.component.html",
  styleUrl: "./editor-toolbar.component.less",
})
export class EditorToolbarComponent {
  readonly hasImage = input.required<boolean>();
  readonly hasMask = input<boolean>(false);
  readonly showMasked = input<boolean>(false);
  readonly downloadButtons = input.required<readonly DownloadButton[]>();
  readonly activeTool = input<Tool>("none");
  readonly fileSelected = output<Event>();
  readonly maskToggled = output<void>();
  readonly toolSelected = output<Tool>();
}
