import {
  Component, input, output, signal, ViewChild, ElementRef,
  AfterViewInit, OnDestroy, OnInit, effect, Renderer2, inject,
} from '@angular/core';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { PostService } from '../../../core/services/post.service';

type CardMode = 'post' | 'story';

@Component({
  selector: 'app-share-card',
  standalone: true,
  template: `
    <!-- Portal anchor — component moves its host into body -->
    <ng-container></ng-container>
  `,
})
export class ShareCardComponent implements OnInit, AfterViewInit, OnDestroy {
  post    = input.required<WorkoutPost>();
  onClose = output<void>();

  private postService = inject(PostService);
  private renderer    = inject(Renderer2);
  private el          = inject(ElementRef);

  mode        = signal<CardMode>('post');
  generating  = signal(false);
  copying     = signal(false);
  showPhoto   = signal(true);
  showUser    = signal(true);
  showGoal    = signal(true);
  showCaption = signal(true);

  private panel!: HTMLElement;
  private postCanvas!: HTMLCanvasElement;
  private storyCanvas!: HTMLCanvasElement;
  private redrawPending = false;
  private unlisten!: () => void;

  constructor() {
    effect(() => {
      this.showPhoto(); this.showUser(); this.showGoal(); this.showCaption(); this.mode();
      if (this.redrawPending) return;
      this.redrawPending = true;
      Promise.resolve().then(() => {
        this.redrawPending = false;
        this.drawPost();
        this.drawStory();
      });
    });
  }

  ngOnInit(): void {
    this.buildPanel();
    document.body.appendChild(this.panel);
    // block body scroll
    document.body.style.overflow = 'hidden';
    // back-button / escape
    this.unlisten = this.renderer.listen('document', 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    });
  }

  ngAfterViewInit(): void {
    this.drawPost();
    this.drawStory();
  }

  ngOnDestroy(): void {
    if (this.panel?.parentElement) this.panel.parentElement.removeChild(this.panel);
    document.body.style.overflow = '';
    this.unlisten?.();
  }

  // ── Build the full-screen panel in plain DOM ──────────────────────────────

  private buildPanel(): void {
    const p = document.createElement('div');
    p.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:flex; flex-direction:column;
      background:#080C10;
      padding-top:env(safe-area-inset-top);
      padding-bottom:env(safe-area-inset-bottom);
      font-family:system-ui,sans-serif;
      animation: shareSlideUp 0.28s cubic-bezier(0.32,0.72,0,1) both;
    `;

    // inject keyframe once
    if (!document.getElementById('share-card-kf')) {
      const style = document.createElement('style');
      style.id = 'share-card-kf';
      style.textContent = `
        @keyframes shareSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // ── Header ──────────────────────────────────────────────────────────────
    const header = this.el_(`
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
        <button id="sc-back" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
                border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                color:#8896A8;cursor:pointer;transition:color .15s">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style="font-size:15px;font-weight:700;color:#fff;letter-spacing:-.3px">Compartilhar</span>
        <div style="width:36px"></div>
      </div>
    `);
    header.querySelector('#sc-back')!.addEventListener('click', () => this.close());

    // ── Scrollable body ──────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;';

    // Mode tabs
    const tabs = this.el_(`
      <div style="display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
                  border-radius:14px;padding:4px;gap:4px">
        <button id="tab-post" style="${this.tabStyle(true)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2.5"/>
          </svg>
          Post (1:1)
        </button>
        <button id="tab-story" style="${this.tabStyle(false)}">
          <svg width="9" height="13" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <rect x="1" y="1" width="8" height="12" rx="2"/>
          </svg>
          Stories (9:16)
        </button>
      </div>
    `);
    const tabPost  = tabs.querySelector('#tab-post')  as HTMLButtonElement;
    const tabStory = tabs.querySelector('#tab-story') as HTMLButtonElement;
    tabPost.addEventListener('click',  () => this.switchMode('post',  tabPost,  tabStory));
    tabStory.addEventListener('click', () => this.switchMode('story', tabPost,  tabStory));

    // Canvas previews
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'display:flex;justify-content:center;min-height:300px;align-items:center';

    this.postCanvas  = document.createElement('canvas');
    this.postCanvas.width  = 1080;
    this.postCanvas.height = 1350;
    Object.assign(this.postCanvas.style, {
      borderRadius:'14px', border:'1px solid rgba(255,255,255,0.08)',
      width:'240px', height:'300px', display:'block',
    });

    this.storyCanvas  = document.createElement('canvas');
    this.storyCanvas.width  = 1080;
    this.storyCanvas.height = 1920;
    Object.assign(this.storyCanvas.style, {
      borderRadius:'14px', border:'1px solid rgba(255,255,255,0.08)',
      width:'169px', height:'300px', display:'none',
    });

    canvasWrap.appendChild(this.postCanvas);
    canvasWrap.appendChild(this.storyCanvas);

    // Toggles
    const togglesWrap = document.createElement('div');
    togglesWrap.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden';

    const post = this.post();
    const toggleRows: Array<{ label: string; sub?: string; key: 'photo'|'user'|'goal'|'caption'; show: boolean }> = [];
    if (post.photo)              toggleRows.push({ label: 'Incluir foto',          key: 'photo',   show: true });
                                 toggleRows.push({ label: 'Nome e @usuário',        key: 'user',    show: true });
    if (post.user.yearlyGoal)    toggleRows.push({ label: 'Meta anual',
                                                   sub: `${post.user.workoutsDone ?? 0}/${post.user.yearlyGoal}`,
                                                   key: 'goal',    show: true });
    if (post.caption)            toggleRows.push({ label: 'Mostrar texto',          key: 'caption', show: true });

    toggleRows.forEach((row, idx) => {
      const rowEl = this.buildToggleRow(row.label, row.sub, row.key, row.show);
      if (idx < toggleRows.length - 1) rowEl.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
      togglesWrap.appendChild(rowEl);
    });

    body.appendChild(tabs);
    body.appendChild(canvasWrap);
    body.appendChild(togglesWrap);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = this.el_(`
      <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0">
        <button id="sc-share" style="width:100%;padding:14px 0;border-radius:14px;
                background:#00FF88;color:#080C10;font-size:14px;font-weight:700;
                border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
                box-shadow:0 0 20px rgba(0,255,136,0.3);transition:opacity .15s,transform .1s;letter-spacing:-.2px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Salvar / Compartilhar
        </button>
      </div>
    `);
    const shareBtn = footer.querySelector('#sc-share') as HTMLButtonElement;
    shareBtn.addEventListener('click', () => this.share(shareBtn));
    shareBtn.addEventListener('mouseenter', () => { shareBtn.style.opacity = '.85'; });
    shareBtn.addEventListener('mouseleave', () => { shareBtn.style.opacity = '1'; });

    p.appendChild(header);
    p.appendChild(body);
    p.appendChild(footer);
    this.panel = p;
  }

  private tabStyle(active: boolean): string {
    return `flex:1;padding:8px 0;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:6px;border:none;transition:all .18s;
            ${active
              ? 'background:#00FF88;color:#080C10;box-shadow:0 0 12px rgba(0,255,136,0.25)'
              : 'background:transparent;color:#8896A8'}`;
  }

  private switchMode(mode: CardMode, tabPost: HTMLButtonElement, tabStory: HTMLButtonElement): void {
    this.mode.set(mode);
    tabPost.style.cssText  = 'flex:1;' + this.tabStyle(mode === 'post');
    tabStory.style.cssText = 'flex:1;' + this.tabStyle(mode === 'story');
    this.postCanvas.style.display  = mode === 'post'  ? 'block' : 'none';
    this.storyCanvas.style.display = mode === 'story' ? 'block' : 'none';
  }

  private buildToggleRow(label: string, sub: string | undefined, key: 'photo'|'user'|'goal'|'caption', initialOn: boolean): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:13px 16px;';

    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size:13px;color:#fff';
    labelWrap.appendChild(labelEl);
    if (sub) {
      const subEl = document.createElement('span');
      subEl.textContent = sub;
      subEl.style.cssText = 'font-size:11px;color:#00FF88;font-weight:600;font-family:monospace';
      labelWrap.appendChild(subEl);
    }

    let on = initialOn;
    const track = document.createElement('div');
    track.style.cssText = `width:40px;height:22px;border-radius:11px;background:${on ? '#00FF88' : 'rgba(255,255,255,0.12)'};
                           position:relative;cursor:pointer;transition:background .2s;flex-shrink:0`;
    const thumb = document.createElement('div');
    thumb.style.cssText = `position:absolute;top:3px;left:${on ? '19px' : '3px'};width:16px;height:16px;
                           border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`;
    track.appendChild(thumb);

    track.addEventListener('click', () => {
      on = !on;
      track.style.background = on ? '#00FF88' : 'rgba(255,255,255,0.12)';
      thumb.style.left = on ? '19px' : '3px';
      this.toggle(key);
    });

    row.appendChild(labelWrap);
    row.appendChild(track);
    return row;
  }

  private el_(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild as HTMLElement;
  }

  close(): void { this.onClose.emit(); }

  toggle(opt: 'photo'|'user'|'goal'|'caption'): void {
    if (opt === 'photo')   this.showPhoto.update(v => !v);
    if (opt === 'user')    this.showUser.update(v => !v);
    if (opt === 'goal')    this.showGoal.update(v => !v);
    if (opt === 'caption') this.showCaption.update(v => !v);
  }

  // ── Canvas helpers ──────────────────────────────────────────────────────────

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
    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    this.roundRect(ctx, x, y - h * 0.72, tw + pad * 2, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,136,0.3)'; ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y - h * 0.72, tw + pad * 2, h, h / 2); ctx.stroke();
    ctx.fillStyle = '#00FF88';
    ctx.fillText(text, x + pad, y);
  }

  // ── POST 4:5 (1080×1350) ───────────────────────────────────────────────────

  private async drawPost(): Promise<void> {
    const canvas = this.postCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 1080, H = 1350, M = 72;

    await this.drawBackground(ctx, W, H, M);

    const AR = 40, headerCY = M + AR;
    if (this.showUser()) await this.drawUserRow(ctx, M, headerCY, AR, 38, 30);
    await this.drawLogo(ctx, W, M, 68, headerCY);

    const photoSize = W - M * 2;
    const photoY    = headerCY + AR + 48;
    const hasPhoto  = this.showPhoto()
      ? await this.drawPhoto(ctx, M, photoY, photoSize, photoSize, 24)
      : false;

    const caption  = this.post().caption || '';
    const workout  = this.post().workout?.name || '';
    const contentY = hasPhoto ? photoY + photoSize + 52 : photoY;

    if (this.showCaption() && caption) {
      ctx.fillStyle = '#FFF';
      ctx.font = `${hasPhoto ? 38 : 48}px system-ui, sans-serif`;
      this.wrapText(ctx, caption, M, contentY, W - M * 2, hasPhoto ? 58 : 70, 3);
    }

    if (workout) {
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

  // ── STORY 9:16 (1080×1920) ─────────────────────────────────────────────────

  private async drawStory(): Promise<void> {
    const canvas = this.storyCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 1080, H = 1920, M = 80;

    await this.drawBackground(ctx, W, H, M);

    const AR = 44, headerCY = M + AR;
    if (this.showUser()) await this.drawUserRow(ctx, M, headerCY, AR, 40, 30);
    await this.drawLogo(ctx, W, M, 70, headerCY);

    const photoY  = headerCY + AR + 40;
    const goalH   = this.showGoal() && this.post().user.yearlyGoal ? 100 : 0;
    const footerH = 140 + goalH;
    const photoH  = H - photoY - footerH;
    const photoW  = W - M * 2;
    const hasPhoto = this.showPhoto()
      ? await this.drawPhoto(ctx, M, photoY, photoW, photoH, 28)
      : false;

    const caption  = this.post().caption || '';
    const workout  = this.post().workout?.name || '';
    const contentY = hasPhoto ? photoY + photoH + 36 : photoY;

    if (this.showCaption() && caption) {
      ctx.fillStyle = '#FFF';
      ctx.font = '30px system-ui, sans-serif';
      ctx.textAlign = 'left';
      this.wrapText(ctx, caption, M, contentY, photoW, 44, 2);
    }

    if (workout) {
      const tagY = H - M - 80 - goalH;
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

  // ── Share ───────────────────────────────────────────────────────────────────

  private async share(btn: HTMLButtonElement): Promise<void> {
    if (this.generating()) return;
    this.generating.set(true);
    btn.style.opacity = '.6';
    btn.textContent = 'Gerando...';

    try {
      const canvas   = this.mode() === 'story' ? this.storyCanvas : this.postCanvas;
      const filename = this.mode() === 'story' ? 'repify-story.png' : 'repify-post.png';
      const blob     = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'));
      const file     = new File([blob], filename, { type: 'image/png' });

      btn.textContent = 'Criando link...';
      const shortlink = await this.postService.getShortlink(this.post().id);
      const shareUrl  = shortlink || `${window.location.origin}/post/${this.post().id}`;
      const shareText = `Confira minha publicação no Repify! 💪 ${shareUrl}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Repify', text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        try { await navigator.clipboard.writeText(shareText); } catch {}
      }
    } catch { /* cancelled */ }
    finally {
      this.generating.set(false);
      btn.style.opacity = '1';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Salvar / Compartilhar
      `;
    }
  }
}
