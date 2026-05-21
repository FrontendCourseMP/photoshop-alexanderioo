import {
  Component,
  ElementRef,
  computed,
  effect,
  signal,
  viewChild,
} from "@angular/core";
import { decodeGB7, encodeGB7 } from "../../utilts/gb7.utilts";
import { ImageInfo, DownloadButton } from "./models/image-info.model";
import { EditorToolbarComponent } from "./components/editor-toolbar/editor-toolbar.component";
import { EditorStatusBarComponent } from "./components/editor-status-bar/editor-status-bar.component";

@Component({
  selector: "app-image-editor",
  standalone: true,
  imports: [EditorToolbarComponent, EditorStatusBarComponent],
  templateUrl: "./image-editor.component.html",
  styleUrl: "./image-editor.component.less",
})
export class ImageEditorComponent {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");

  readonly info = signal<ImageInfo | null>(null);
  readonly hasImage = computed(() => this.info() !== null);
  readonly hasMask = computed(() => this.info()?.hasMask ?? false);
  readonly showMasked = signal(false);

  private lastGb7Buffer: ArrayBuffer | null = null;

  readonly downloadButtons: readonly DownloadButton[] = [
    { label: "Скачать PNG", action: () => this.savePng() },
    { label: "Скачать JPG", action: () => this.saveJpg() },
    { label: "Скачать GB7", action: () => this.saveGb7() },
  ];

  constructor() {
    effect(() => {
      const show = this.showMasked();

      if (this.lastGb7Buffer) {
        const { imageData, depth, hasMask } = decodeGB7(
          this.lastGb7Buffer,
          show
        );
        this.drawImageData(imageData, depth, hasMask);
      }
    });
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef().nativeElement;
  }

  private get ctx(): CanvasRenderingContext2D {
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is not available");
    }
    return context;
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.showMasked.set(false);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "gb7") {
      this.loadGb7(file);
    } else {
      this.lastGb7Buffer = null;
      this.loadDefaultImage(file);
    }

    input.value = "";
  }

  toggleMask(): void {
    this.showMasked.update((value) => !value);
  }

  private loadGb7(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      this.lastGb7Buffer = buffer;
      const { imageData, depth, hasMask } = decodeGB7(
        buffer,
        this.showMasked()
      );
      this.drawImageData(imageData, depth, hasMask);
    };
    reader.readAsArrayBuffer(file);
  }

  private loadDefaultImage(file: File): void {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      this.canvas.width = image.width;
      this.canvas.height = image.height;
      this.ctx.drawImage(image, 0, 0);

      const depth = this.detectColorDepth(image.width, image.height);

      this.info.set({
        width: image.width,
        height: image.height,
        depth,
        hasMask: false,
      });

      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  }

  private detectColorDepth(width: number, height: number): number {
    const { data } = this.ctx.getImageData(0, 0, width, height);

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return 32;
      }
    }

    return 24;
  }

  private drawImageData(
    imageData: ImageData,
    depth: number,
    hasMask: boolean
  ): void {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;

    this.ctx.clearRect(0, 0, imageData.width, imageData.height);
    this.ctx.putImageData(imageData, 0, 0);

    this.info.set({
      width: imageData.width,
      height: imageData.height,
      depth,
      hasMask,
    });
  }

  private savePng(): void {
    this.download(this.canvas.toDataURL("image/png"), "image.png");
  }

  private saveJpg(): void {
    this.download(this.canvas.toDataURL("image/jpeg"), "image.jpg");
  }

  private saveGb7(): void {
    const buffer = encodeGB7(this.ctx, this.canvas.width, this.canvas.height);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    this.download(url, "image.gb7");
    URL.revokeObjectURL(url);
  }

  private download(url: string, fileName: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  }
}
