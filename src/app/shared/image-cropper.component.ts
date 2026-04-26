import {
  Component, input, output, signal, ViewChild, ElementRef,
  AfterViewInit, OnDestroy, computed,
} from '@angular/core';

export type CropShape = 'circle' | 'square';

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-[70] flex flex-col max-w-[430px] mx-auto bg-[#080C10]">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border safe-top shrink-0">
        <button (click)="onCancel.emit()"
                class="text-[13px] font-body text-text-2 hover:text-white transition-colors px-2 py-1">
          Cancelar
        </button>
        <p class="text-[14px] font-body font-semibold text-white">
          {{ shape() === 'circle' ? 'Foto de perfil' : 'Recortar foto' }}
        </p>
        <button (click)="confirm()"
                class="text-[13px] font-body font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1">
          Usar
        </button>
      </div>

      <!-- Canvas area -->
      <div class="flex-1 flex items-center justify-center overflow-hidden relative select-none"
           (wheel)="onWheel($event)"
           #wrapperEl>
        <canvas #cropCanvas
                class="touch-none"
                (mousedown)="onMouseDown($event)"
                (mousemove)="onMouseMove($event)"
                (mouseup)="onPointerUp()"
                (mouseleave)="onPointerUp()"
                (touchstart)="onTouchStart($event)"
                (touchmove)="onTouchMove($event)"
                (touchend)="onPointerUp()">
        </canvas>
      </div>

      <!-- Footer hint -->
      <div class="shrink-0 px-4 py-3 flex items-center justify-between border-t border-border"
           style="padding-bottom: calc(12px + env(safe-area-inset-bottom))">
        <p class="text-[11px] text-text-2 font-body">Arraste e use dois dedos para zoom</p>
        <div class="flex items-center gap-3">
          <button (click)="zoom(-0.1)" class="w-8 h-8 rounded-full bg-card-2 border border-border text-white flex items-center justify-center text-lg leading-none hover:border-primary/40 transition-colors">−</button>
          <button (click)="zoom(0.1)"  class="w-8 h-8 rounded-full bg-card-2 border border-border text-white flex items-center justify-center text-lg leading-none hover:border-primary/40 transition-colors">+</button>
        </div>
      </div>
    </div>
  `,
})
export class ImageCropperComponent implements AfterViewInit, OnDestroy {
  src        = input.required<string>();
  shape      = input<CropShape>('square');
  aspectW    = input<number>(1);
  aspectH    = input<number>(1);
  outputSize = input<number>(1080);

  onCancel  = output<void>();
  onCropped = output<{ dataUrl: string; blob: Blob }>();

  @ViewChild('cropCanvas') canvasRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapperEl')  wrapperRef!: ElementRef<HTMLDivElement>;

  private img     = new Image();
  private scale   = 1;
  private minScale = 1;
  private offX    = 0;
  private offY    = 0;
  private dragging = false;
  private lastX    = 0;
  private lastY    = 0;

  // pinch
  private pinchDist0 = 0;
  private pinchScale0 = 1;

  private cW = 0; // canvas display width
  private cH = 0; // canvas display height
  private cropW = 0;
  private cropH = 0;

  ngAfterViewInit(): void {
    this.img.onload = () => this.init();
    this.img.src = this.src();
  }

  ngOnDestroy(): void {}

  private init(): void {
    const wrapper = this.wrapperRef.nativeElement;
    const canvas  = this.canvasRef.nativeElement;

    const maxW = wrapper.clientWidth  - 32;
    const maxH = wrapper.clientHeight - 32;
    const ratio = this.aspectW() / this.aspectH();

    // crop area size in display px
    if (maxW / ratio <= maxH) {
      this.cropW = maxW;
      this.cropH = Math.round(maxW / ratio);
    } else {
      this.cropH = maxH;
      this.cropW = Math.round(maxH * ratio);
    }

    this.cW = this.cropW + 80;
    this.cH = this.cropH + 80;

    canvas.width  = this.cW;
    canvas.height = this.cH;
    canvas.style.width  = `${this.cW}px`;
    canvas.style.height = `${this.cH}px`;

    // initial scale: image fills the crop area
    const sx = this.cropW / this.img.naturalWidth;
    const sy = this.cropH / this.img.naturalHeight;
    this.minScale = Math.max(sx, sy);
    this.scale = this.minScale;

    // center
    this.offX = (this.cW - this.img.naturalWidth  * this.scale) / 2;
    this.offY = (this.cH - this.img.naturalHeight * this.scale) / 2;

    this.draw();
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx    = canvas.getContext('2d')!;
    const { cW, cH, cropW, cropH } = this;
    const cropX = (cW - cropW) / 2;
    const cropY = (cH - cropH) / 2;

    ctx.clearRect(0, 0, cW, cH);

    // image
    ctx.drawImage(this.img, this.offX, this.offY,
      this.img.naturalWidth  * this.scale,
      this.img.naturalHeight * this.scale);

    // dark overlay outside crop
    ctx.fillStyle = 'rgba(8,12,16,0.65)';
    ctx.fillRect(0, 0, cW, cH);

    // punch out crop area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    if (this.shape() === 'circle') {
      ctx.beginPath();
      ctx.arc(cropX + cropW / 2, cropY + cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(cropX, cropY, cropW, cropH);
    }
    ctx.restore();

    // redraw image inside crop only (so it's visible)
    ctx.save();
    if (this.shape() === 'circle') {
      ctx.beginPath();
      ctx.arc(cropX + cropW / 2, cropY + cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(cropX, cropY, cropW, cropH);
      ctx.clip();
    }
    ctx.drawImage(this.img, this.offX, this.offY,
      this.img.naturalWidth  * this.scale,
      this.img.naturalHeight * this.scale);
    ctx.restore();

    // crop border
    ctx.strokeStyle = 'rgba(0,255,136,0.6)';
    ctx.lineWidth   = 2;
    if (this.shape() === 'circle') {
      ctx.beginPath();
      ctx.arc(cropX + cropW / 2, cropY + cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      this.roundRect(ctx, cropX, cropY, cropW, cropH, 12);
      ctx.stroke();
      // rule-of-thirds grid
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cropX + (cropW / 3) * i, cropY);
        ctx.lineTo(cropX + (cropW / 3) * i, cropY + cropH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cropX, cropY + (cropH / 3) * i);
        ctx.lineTo(cropX + cropW, cropY + (cropH / 3) * i);
        ctx.stroke();
      }
    }
  }

  private clampOffset(): void {
    const iW = this.img.naturalWidth  * this.scale;
    const iH = this.img.naturalHeight * this.scale;
    const cropX = (this.cW - this.cropW) / 2;
    const cropY = (this.cH - this.cropH) / 2;

    // image must cover the crop area
    const minX = cropX + this.cropW - iW;
    const maxX = cropX;
    const minY = cropY + this.cropH - iH;
    const maxY = cropY;

    this.offX = Math.min(maxX, Math.max(minX, this.offX));
    this.offY = Math.min(maxY, Math.max(minY, this.offY));
  }

  // ── Zoom ────────────────────────────────────────────────────────────────────

  zoom(delta: number): void {
    const cx = this.cW / 2, cy = this.cH / 2;
    this.applyZoom(this.scale + delta, cx, cy);
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const rect  = this.canvasRef.nativeElement.getBoundingClientRect();
    this.applyZoom(this.scale + delta, e.clientX - rect.left, e.clientY - rect.top);
  }

  private applyZoom(newScale: number, pivotX: number, pivotY: number): void {
    newScale = Math.max(this.minScale, Math.min(newScale, this.minScale * 4));
    const ratio = newScale / this.scale;
    this.offX = pivotX - (pivotX - this.offX) * ratio;
    this.offY = pivotY - (pivotY - this.offY) * ratio;
    this.scale = newScale;
    this.clampOffset();
    this.draw();
  }

  // ── Mouse drag ──────────────────────────────────────────────────────────────

  onMouseDown(e: MouseEvent): void {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.dragging) return;
    this.offX += e.clientX - this.lastX;
    this.offY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.clampOffset();
    this.draw();
  }

  // ── Touch drag + pinch ──────────────────────────────────────────────────────

  onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.dragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.dragging = false;
      this.pinchDist0  = this.pinchDist(e);
      this.pinchScale0 = this.scale;
    }
  }

  onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1 && this.dragging) {
      this.offX += e.touches[0].clientX - this.lastX;
      this.offY += e.touches[0].clientY - this.lastY;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
      this.clampOffset();
      this.draw();
    } else if (e.touches.length === 2) {
      const dist  = this.pinchDist(e);
      const newScale = this.pinchScale0 * (dist / this.pinchDist0);
      const midX  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect  = this.canvasRef.nativeElement.getBoundingClientRect();
      this.applyZoom(newScale, midX - rect.left, midY - rect.top);
    }
  }

  onPointerUp(): void { this.dragging = false; }

  private pinchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Confirm crop ────────────────────────────────────────────────────────────

  confirm(): void {
    const out    = this.outputSize();
    const cropX  = (this.cW - this.cropW) / 2;
    const cropY  = (this.cH - this.cropH) / 2;

    // source rect in image coords
    const srcX = (cropX - this.offX) / this.scale;
    const srcY = (cropY - this.offY) / this.scale;
    const srcW = this.cropW / this.scale;
    const srcH = this.cropH / this.scale;

    const offscreen = document.createElement('canvas');
    offscreen.width  = out;
    offscreen.height = Math.round(out * (this.aspectH() / this.aspectW()));
    const ctx = offscreen.getContext('2d')!;

    if (this.shape() === 'circle') {
      ctx.beginPath();
      ctx.arc(offscreen.width / 2, offscreen.height / 2, offscreen.width / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    ctx.drawImage(this.img, srcX, srcY, srcW, srcH, 0, 0, offscreen.width, offscreen.height);

    const dataUrl = offscreen.toDataURL('image/png');
    offscreen.toBlob(blob => {
      if (blob) this.onCropped.emit({ dataUrl, blob });
    }, 'image/png');
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
