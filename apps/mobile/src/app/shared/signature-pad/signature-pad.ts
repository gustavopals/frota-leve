import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-signature-pad',
  templateUrl: './signature-pad.html',
  styleUrl: './signature-pad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignaturePad implements AfterViewInit {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private context: CanvasRenderingContext2D | null = null;
  private drawing = false;
  readonly empty = signal(true);

  ngAfterViewInit(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  pointerDown(event: PointerEvent): void {
    this.drawing = true;
    this.canvas().nativeElement.setPointerCapture(event.pointerId);
    const point = this.point(event);
    this.context?.beginPath();
    this.context?.moveTo(point.x, point.y);
  }

  pointerMove(event: PointerEvent): void {
    if (!this.drawing || !this.context) return;
    const point = this.point(event);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
    this.empty.set(false);
  }

  pointerUp(): void {
    this.drawing = false;
    this.context?.closePath();
  }

  clear(): void {
    const canvas = this.canvas().nativeElement;
    this.context?.clearRect(0, 0, canvas.width, canvas.height);
    this.empty.set(true);
  }

  toBlob(): Promise<Blob | null> {
    if (this.empty()) return Promise.resolve(null);
    return new Promise((resolve) => this.canvas().nativeElement.toBlob(resolve, 'image/png', 0.92));
  }

  private resize(): void {
    const canvas = this.canvas().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#102f37';
    this.context = context;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
