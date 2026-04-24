import { Component, ViewChild, ElementRef } from '@angular/core';
import { NgFor } from '@angular/common';
import { decodeGB7, encodeGB7 } from '../../utilts/gb7.utilts';
@Component({
  selector: 'app-image-editor',
  imports: [],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.less',
})
export class ImageEditorComponent {
  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  width = 0;
  height = 0;
  depth = 0;

  readonly downloadButtons = [
    {
      label: 'Скачать PNG',
      action: () => this.savePng(),
    },
    {
      label: 'Скачать JPG',
      action: () => this.saveJpg(),
    },
    {
      label: 'Скачать GB7',
      action: () => this.saveGb7(),
    },
  ];

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private get ctx(): CanvasRenderingContext2D {
    return this.canvas.getContext('2d')!;
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'gb7') {
      this.loadGb7(file);
      return;
    }

    this.loadDefaultImage(file);
  }

  private loadGb7(file: File): void {
    const reader = new FileReader();

    reader.onload = () => {
      const imageData = decodeGB7(reader.result as ArrayBuffer);

      this.drawImageData(imageData);
      this.depth = 7;
    };

    reader.readAsArrayBuffer(file);
  }

  private loadDefaultImage(file: File): void {
    const image = new Image();

    image.onload = () => {
      this.canvas.width = image.width;
      this.canvas.height = image.height;

      this.ctx.drawImage(image, 0, 0);

      this.width = image.width;
      this.height = image.height;
      this.depth = 24;

      URL.revokeObjectURL(image.src);
    };

    image.src = URL.createObjectURL(file);
  }

  private drawImageData(imageData: ImageData): void {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;

    this.ctx.putImageData(imageData, 0, 0);

    this.width = imageData.width;
    this.height = imageData.height;
  }

  private savePng(): void {
    this.download(this.canvas.toDataURL('image/png'), 'image.png');
  }

  private saveJpg(): void {
    this.download(this.canvas.toDataURL('image/jpeg'), 'image.jpg');
  }

  private saveGb7(): void {
    const buffer = encodeGB7(this.ctx, this.canvas.width, this.canvas.height);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    this.download(url, 'image.gb7');

    URL.revokeObjectURL(url);
  }

  private download(url: string, fileName: string): void {
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
  }
}
