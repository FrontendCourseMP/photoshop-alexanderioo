import { Component, computed, input, output } from "@angular/core";
import {
  ChannelKey,
  ChannelState,
  ChannelThumb,
} from "../../models/channel.model";
@Component({
  selector: "app-channels-panel",
  standalone: true,
  templateUrl: "./channels-panel.component.html",
  styleUrl: "./channels-panel.component.less",
})
export class ChannelsPanelComponent {
  readonly thumbs = input.required<readonly ChannelThumb[]>();
  readonly state = input.required<ChannelState>();
  readonly channelToggled = output<ChannelKey>();
  isActive(key: ChannelKey): boolean {
    return this.state()[key];
  }
  onToggle(key: ChannelKey): void {
    this.channelToggled.emit(key);
  }
}
