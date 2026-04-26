import { Component, input, output, signal, ViewChild, ElementRef, AfterViewInit, effect } from '@angular/core';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { PostService } from '../../../core/services/post.service';

type CardMode = 'post' | 'story';

@Component({
  selector: 'app-share-card',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-[60] flex items-end justify-center max-w-[430px] mx-auto">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="onClose.emit()"></div>

      <div class="relative w-full bg-card border-t border-border rounded-t-2xl animate-slide-up"
           style="padding-bottom: calc(20px + env(safe-area-inset-bottom))">

        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-3">
          <div class="w-10 h-1 bg-border-2 rounded-full"></div>
        </div>

        <div class="px-4">
          <p class="text-[15px] font-display font-bold text-white mb-1">Compartilhar publicação</p>
          <p class="text-[12px] text-text-2 font-body mb-4">Escolha o formato e salve nas suas redes</p>

          <!-- Mode selector -->
          <div class="flex bg-card-2 border border-border rounded-xl p-1 gap-1 mb-4">
            <button (click)="setMode('post')"
                    class="flex-1 py-2 rounded-lg text-[12px] font-body font-medium transition-all flex items-center justify-center gap-1.5"
                    [class]="mode() === 'post' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              Post (1:1)
            </button>
            <button (click)="setMode('story')"
                    class="flex-1 py-2 rounded-lg text-[12px] font-body font-medium transition-all flex items-center justify-center gap-1.5"
                    [class]="mode() === 'story' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="1" y="1" width="8" height="12" rx="1.5"/>
              </svg>
              Stories (9:16)
            </button>
          </div>

          <!-- Previews -->
          <div class="flex justify-center mb-4">
            <canvas #postCanvas width="1080" height="1350"
                    class="rounded-xl border border-border transition-all"
                    [style]="mode() === 'post' ? 'width:208px;height:260px;display:block' : 'display:none'">
            </canvas>
            <canvas #storyCanvas width="1080" height="1920"
                    class="rounded-xl border border-border transition-all"
                    [style]="mode() === 'story' ? 'width:146px;height:260px;display:block' : 'display:none'">
            </canvas>
          </div>

          <!-- Options toggles -->
          <div class="bg-card-2 border border-border rounded-xl divide-y divide-border mb-4">

            @if (post().photo) {
              <div class="flex items-center justify-between px-4 py-3">
                <span class="text-[12px] font-body text-white">Incluir foto</span>
                <button type="button" (click)="toggle('photo')"
                        class="relative w-10 h-5 rounded-full transition-colors duration-200"
                        [class]="showPhoto() ? 'bg-primary' : 'bg-border'">
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        [class]="showPhoto() ? 'translate-x-5' : 'translate-x-0'"></span>
                </button>
              </div>
            }

            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-[12px] font-body text-white">Incluir nome e @usuário</span>
              <button type="button" (click)="toggle('user')"
                      class="relative w-10 h-5 rounded-full transition-colors duration-200"
                      [class]="showUser() ? 'bg-primary' : 'bg-border'">
                <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                      [class]="showUser() ? 'translate-x-5' : 'translate-x-0'"></span>
              </button>
            </div>

             @if (post().user.yearlyGoal) {
              <div class="flex items-center justify-between px-4 py-3">
                <div>
                  <span class="text-[12px] font-body text-white">Meta anual</span>
                  <span class="text-[11px] font-mono text-primary ml-2">
                    {{ post().user.workoutsDone ?? 0 }}/{{ post().user.yearlyGoal }}
                  </span>
                </div>
                <button type="button" (click)="toggle('goal')"
                        class="relative w-10 h-5 rounded-full transition-colors duration-200"
                        [class]="showGoal() ? 'bg-primary' : 'bg-border'">
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        [class]="showGoal() ? 'translate-x-5' : 'translate-x-0'"></span>
                </button>
              </div>
            }

            @if (post().caption) {
              <div class="flex items-center justify-between px-4 py-3">
                <span class="text-[12px] font-body text-white">Mostrar texto</span>
                <button type="button" (click)="toggle('caption')"
                        class="relative w-10 h-5 rounded-full transition-colors duration-200"
                        [class]="showCaption() ? 'bg-primary' : 'bg-border'">
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        [class]="showCaption() ? 'translate-x-5' : 'translate-x-0'"></span>
                </button>
              </div>
            }

          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button (click)="onClose.emit()"
                    class="flex-none px-4 py-3 rounded-xl border border-border text-[13px] font-body text-text-2 hover:text-white transition-colors">
              Cancelar
            </button>
            <button (click)="share()"
                    [disabled]="generating()"
                    class="flex-1 py-3 rounded-xl bg-primary text-bg text-[14px] font-body font-semibold shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              @if (generating()) {
                <div class="w-4 h-4 rounded-full border-2 border-bg border-t-transparent animate-spin"></div>
                Gerando...
              } @else if (copying()) {
                <div class="w-4 h-4 rounded-full border-2 border-bg border-t-transparent animate-spin"></div>
                Criando link...
              } @else {
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Salvar / Compartilhar
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ShareCardComponent implements AfterViewInit {
  post    = input.required<WorkoutPost>();
  onClose = output<void>();

  @ViewChild('postCanvas')  postCanvasRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('storyCanvas') storyCanvasRef!: ElementRef<HTMLCanvasElement>;

  mode       = signal<CardMode>('post');
  generating = signal(false);

  showPhoto = signal(true);
  showUser  = signal(true);
  showGoal  = signal(true);
  showCaption = signal(true);

  copying    = signal(false);

  private redrawPending = false;

  constructor(private postService: PostService) {
    effect(() => {
      // track all toggles + mode — redraw quando qualquer coisa muda
      this.showPhoto(); this.showUser(); this.showGoal(); this.mode();
      if (this.redrawPending) return;
      this.redrawPending = true;
      Promise.resolve().then(() => {
        this.redrawPending = false;
        this.drawPost();
        this.drawStory();
      });
    });
  }

  ngAfterViewInit(): void {
    this.drawPost();
    this.drawStory();
  }

  setMode(m: CardMode): void { this.mode.set(m); }

  toggle(opt: 'photo' | 'user' | 'goal' | 'caption'): void {
    if (opt === 'photo') this.showPhoto.update(v => !v);
    if (opt === 'user')  this.showUser.update(v => !v);
    if (opt === 'goal')  this.showGoal.update(v => !v);
    if (opt === 'caption') this.showCaption.update(v => !v);
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 7): void {
    const words = text.split(' ');
    let line = '', curY = y, count = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, curY);
        line = word; curY += lineH; count++;
        if (count >= maxLines) { ctx.fillText('…', x, curY); return; }
      } else { line = test; }
    }
    if (line) ctx.fillText(line, x, curY);
  }

  private async drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, M: number): Promise<void> {
    ctx.fillStyle = '#080C10';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (let x = M; x < W - M; x += 52)
      for (let y = M; y < H - M; y += 52) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }

    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(W, H) * 0.55);
    g1.addColorStop(0, 'rgba(0,255,136,0.08)'); g1.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

    const g2 = ctx.createRadialGradient(W, H, 0, W, H, Math.min(W, H) * 0.6);
    g2.addColorStop(0, 'rgba(0,194,255,0.06)'); g2.addColorStop(1, 'rgba(0,194,255,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0,255,136,0.12)'; ctx.lineWidth = 2;
    this.roundRect(ctx, 4, 4, W - 8, H - 8, 32); ctx.stroke();

    const aGrd = ctx.createLinearGradient(0, 0, 320, 0);
    aGrd.addColorStop(0, 'rgba(0,255,136,0.9)'); aGrd.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.strokeStyle = aGrd; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(M, 4); ctx.lineTo(M + 280, 4); ctx.stroke();

    try {
      const icon = await this.loadImage('/icon.png');
      const iS = Math.round(W * 0.72);
      ctx.globalAlpha = 0.055;
      ctx.drawImage(icon, W - iS + Math.round(iS * 0.22), H - iS + Math.round(iS * 0.22), iS, iS);
      ctx.globalAlpha = 1;
    } catch { ctx.globalAlpha = 1; }
  }

  private async drawLogo(ctx: CanvasRenderingContext2D, W: number, M: number, logoH: number, cy: number): Promise<void> {
    try {
      const logo = await this.loadImage('/logo-transparent.png');
      const logoW = Math.round(logo.naturalWidth * (logoH / logo.naturalHeight));
      ctx.drawImage(logo, W - M - logoW, cy - logoH / 2, logoW, logoH);
    } catch {
      ctx.fillStyle = '#00FF88';
      ctx.font = `bold ${logoH * 0.7}px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('REPIFY', W - M, cy + logoH * 0.25);
      ctx.textAlign = 'left';
    }
  }

  private async drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): Promise<void> {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const url = this.post().user.avatar;
    if (url) {
      try {
        const img = await this.loadImage(url);
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } catch { this.avatarFallback(ctx, cx, cy, r); }
    } else { this.avatarFallback(ctx, cx, cy, r); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,255,136,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke();
  }

  private avatarFallback(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,255,136,0.3)'); g.addColorStop(1, 'rgba(0,194,255,0.1)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${r}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.post().user.name.charAt(0).toUpperCase(), x, y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  private username(): string {
    return this.post().user.username
      ? `@${this.post().user.username}`
      : `@${this.post().user.name.toLowerCase().replace(/\s/g, '')}`;
  }

  private async drawUserRow(ctx: CanvasRenderingContext2D, x: number, cy: number, AR: number, nameFontSize: number, userFontSize: number): Promise<void> {
    await this.drawAvatar(ctx, x + AR, cy, AR);
    const totalTextH = nameFontSize + 8 + userFontSize;
    const nameY = cy - totalTextH / 2 + nameFontSize;
    const userY = nameY + 8 + userFontSize;
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${nameFontSize}px system-ui, sans-serif`;
    ctx.fillText(this.post().user.name, x + AR * 2 + 20, nameY);
    ctx.fillStyle = '#8896A8';
    ctx.font = `${userFontSize}px system-ui, sans-serif`;
    ctx.fillText(this.username(), x + AR * 2 + 20, userY);
  }

  private async drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): Promise<boolean> {
    const photo = this.post().photo;
    if (!photo) return false;
    try {
      const img = await this.loadImage(photo);
      ctx.save();
      this.roundRect(ctx, x, y, w, h, r); ctx.clip();
      ctx.fillStyle = '#0D1117'; ctx.fillRect(x, y, w, h);
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      return true;
    } catch { return false; }
  }

  private drawGoalBadge(ctx: CanvasRenderingContext2D, x: number, y: number, done: number, goal: number, fontSize: number): void {
    const text = `🎯 ${done}/${goal} treinos`;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = fontSize * 0.6, h = fontSize * 1.8;
    // pill background
    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    this.roundRect(ctx, x, y - h * 0.72, tw + pad * 2, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,136,0.3)'; ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y - h * 0.72, tw + pad * 2, h, h / 2); ctx.stroke();
    ctx.fillStyle = '#00FF88';
    ctx.fillText(text, x + pad, y);
  }

  // ── POST 4:5 (1080×1350) ────────────────────────────────────────────────────

  private async drawPost(): Promise<void> {
    const canvas = this.postCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 1080, H = 1350, M = 72;

    await this.drawBackground(ctx, W, H, M);

    const AR = 40;
    const headerCY = M + AR;

    if (this.showUser()) {
      await this.drawUserRow(ctx, M, headerCY, AR, 38, 30);
    }
    await this.drawLogo(ctx, W, M, 68, headerCY);

    const photoSize = W - M * 2;
    const photoY = headerCY + AR + 48;
    const hasPhoto = this.showPhoto()
      ? await this.drawPhoto(ctx, M, photoY, photoSize, photoSize, 24)
      : false;

    const caption = this.showCaption() ? this.post().caption || '' : '';
    const workout = this.post().workout?.name || '';
    const content = caption || workout || 'Treino concluído 💪';
    const contentY = hasPhoto ? photoY + photoSize + 52 : photoY;

    ctx.fillStyle = '#FFF';
    ctx.font = `${hasPhoto ? 38 : 48}px system-ui, sans-serif`;
    this.wrapText(ctx, content, M, contentY, W - M * 2, hasPhoto ? 58 : 70, 3);

    if (caption && workout) {
      const tagY = H - M - (this.showGoal() && this.post().user.yearlyGoal ? 160 : 80);
      ctx.fillStyle = 'rgba(0,255,136,0.09)';
      this.roundRect(ctx, M, tagY, W - M * 2, 60, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,136,0.22)'; ctx.lineWidth = 1;
      this.roundRect(ctx, M, tagY, W - M * 2, 60, 16); ctx.stroke();
      ctx.fillStyle = '#00FF88'; ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`⚡ ${workout}`, M + 20, tagY + 40);
    }

    if (this.showGoal() && this.post().user.yearlyGoal) {
      this.drawGoalBadge(ctx, M, H - M - 20, this.post().user.workoutsDone ?? 0, this.post().user.yearlyGoal!, 30);
    }
  }

  // ── STORY 9:16 (1080×1920) ──────────────────────────────────────────────────

  private async drawStory(): Promise<void> {
    const canvas = this.storyCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 1080, H = 1920, M = 80;

    await this.drawBackground(ctx, W, H, M);

    const AR = 44;
    const headerCY = M + AR;

    if (this.showUser()) {
      await this.drawUserRow(ctx, M, headerCY, AR, 40, 30);
    }
    await this.drawLogo(ctx, W, M, 70, headerCY);

    const photoY = headerCY + AR + 60;
    const goalH  = this.showGoal() && this.post().user.yearlyGoal ? 100 : 0;
    const footerH = 280 + goalH;
    const photoH = H - photoY - footerH;
    const photoW = W - M * 2;
    const hasPhoto = this.showPhoto()
      ? await this.drawPhoto(ctx, M, photoY, photoW, photoH, 28)
      : false;

    const caption = this.showCaption() ? this.post().caption || '' : '';
    const workout = this.post().workout?.name || '';
    const content = caption || workout || 'Treino concluído 💪';
    const contentY = hasPhoto ? photoY + photoH + 52 : photoY;

    ctx.fillStyle = '#FFF';
    ctx.font = '34px system-ui, sans-serif';
    ctx.textAlign = 'left';
    this.wrapText(ctx, content, M, contentY, photoW, 52, 3);

    if (workout && caption) {
      const tagY = H - M - 120 - goalH;
      ctx.fillStyle = 'rgba(0,255,136,0.1)';
      this.roundRect(ctx, M, tagY, W - M * 2, 72, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,136,0.25)'; ctx.lineWidth = 1;
      this.roundRect(ctx, M, tagY, W - M * 2, 72, 20); ctx.stroke();
      ctx.fillStyle = '#00FF88'; ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillText(`⚡ ${workout}`, M + 24, tagY + 48);
    }

    if (this.showGoal() && this.post().user.yearlyGoal) {
      this.drawGoalBadge(ctx, M, H - M - 20, this.post().user.workoutsDone ?? 0, this.post().user.yearlyGoal!, 34);
    }

    if (this.post().streak) {
      ctx.fillStyle = '#8896A8'; ctx.font = '32px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🔥 ${this.post().streak} dias`, W - M, H - M - (goalH ? goalH + 60 : 20));
      ctx.textAlign = 'left';
    }
  }

  // ── Share ────────────────────────────────────────────────────────────────────

  async share(): Promise<void> {
    this.generating.set(true);
    try {
      const canvas = this.mode() === 'story'
        ? this.storyCanvasRef.nativeElement
        : this.postCanvasRef.nativeElement;

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(), 'image/png'));

      const filename = this.mode() === 'story' ? 'repify-story.png' : 'repify-post.png';
      const file = new File([blob], filename, { type: 'image/png' });

      // Gera shortlink para compartilhamento
      this.copying.set(true);
      const shortlink = await this.postService.getShortlink(this.post().id);
      const shareUrl = shortlink || `${window.location.origin}/post/${this.post().id}`;
      const shareText = `Confira minha publicação no Repify! 💪 ${shareUrl}`;

      this.copying.set(false);
      this.generating.set(false);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Repify', text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        // Copia o link para a área de transferência
        try { await navigator.clipboard.writeText(shareText); } catch {}
      }
    } catch { /* cancelled */ }
    finally { this.generating.set(false); this.copying.set(false); }
  }
}
