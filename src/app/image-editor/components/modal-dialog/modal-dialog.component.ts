import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from "@angular/core";

@Component({
  selector: "app-modal-dialog",
  standalone: true,
  template: `
    <dialog #dlg class="modal" (close)="closed.emit()">
      <header class="modal-header">
        <h2>{{ title() }}</h2>
        <button type="button" class="x" (click)="close()">×</button>
      </header>
      <div class="modal-body">
        <ng-content></ng-content>
      </div>
      <footer class="modal-footer">
        <ng-content select="[modalFooter]"></ng-content>
      </footer>
    </dialog>
  `,
  styles: [
    `
      .modal {
        background: #2d2d2d;
        color: #e0e0e0;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        padding: 0;
        min-width: 480px;
        max-width: 95vw;
        max-height: 90vh;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
        font-size: 13px;
      }
      .modal::backdrop {
        background: rgba(0, 0, 0, 0.55);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #3a3a3a;
      }
      .modal-header h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .x {
        background: transparent;
        border: none;
        color: #b0b0b0;
        font-size: 22px;
        cursor: pointer;
        line-height: 1;
      }
      .x:hover {
        color: #fff;
      }
      .modal-body {
        padding: 16px;
        overflow: auto;
        max-height: 70vh;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 10px 16px;
        border-top: 1px solid #3a3a3a;
      }
    `,
  ],
})
export class ModalDialogComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  private readonly dlgRef =
    viewChild.required<ElementRef<HTMLDialogElement>>("dlg");

  ngAfterViewInit(): void {
    this.dlgRef().nativeElement.showModal();
  }

  close(): void {
    this.dlgRef().nativeElement.close();
  }
}
