import {
  Component, output, inject, signal, computed,
  OnInit, OnDestroy, NgZone, ViewChild, ElementRef, AfterViewInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { WalkService, GeoPoint } from '../../../core/services/walk.service';
import { PostService } from '../../../core/services/post.service';
import { CheckinService } from '../../../core/services/checkin.service';
import { AuthService } from '../../../core/services/auth.service';
import { WorkoutPost } from '../../../core/models/workout-post.model';

type Phase = 'setup' | 'running' | 'paused' | 'done';

@Component({
  selector: 'app-walk-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="fixed inset-0 z-[70] flex flex-col max-w-[430px] mx-auto bg-bg"
         style="padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);
                animation:shareSlideUp .28s cubic-bezier(.32,.72,0,1) both">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button (click)="tryClose()"
                class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="flex items-center gap-2">
          <span class="text-lg leading-none">🚶</span>
          <p class="text-[15px] font-display font-bold text-white">Repify Walk</p>
        </div>
        <div class="w-9"></div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto">

        <!-- ═══════════════════ SETUP ═══════════════════ -->
        @if (phase() === 'setup') {
          <div class="px-4 py-6 flex flex-col gap-5">

            <div class="bg-card-2 border border-border rounded-2xl p-5 space-y-4">
              <p class="text-[13px] font-body font-semibold text-white">Modo de rastreamento</p>
              <div class="flex gap-3">
                <button (click)="gpsMode.set(false)"
                        class="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border transition-all"
                        [class]="!gpsMode() ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-border-2'">
                  <span class="text-2xl">⏱️</span>
                  <span class="text-[12px] font-body font-semibold" [class]="!gpsMode() ? 'text-primary' : 'text-text-2'">Manual</span>
                  <span class="text-[10px] font-body text-text-2 text-center leading-snug px-1">Registra só o tempo</span>
                </button>
                <button (click)="gpsMode.set(true)"
                        class="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border transition-all"
                        [class]="gpsMode() ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-border-2'">
                  <span class="text-2xl">📍</span>
                  <span class="text-[12px] font-body font-semibold" [class]="gpsMode() ? 'text-primary' : 'text-text-2'">GPS</span>
                  <span class="text-[10px] font-body text-text-2 text-center leading-snug px-1">Calcula distância + mapa</span>
                </button>
              </div>
              @if (gpsMode()) {
                <p class="text-[11px] font-body text-text-2 text-center">O GPS será ativado ao iniciar. Mantenha o app aberto.</p>
              }
            </div>

            <div class="flex items-center justify-between bg-card-2 border border-border rounded-2xl px-5 py-4">
              <div>
                <p class="text-[13px] font-body font-semibold text-white">Publicar no feed</p>
                <p class="text-[11px] font-body text-text-2 mt-0.5">Gera post automático ao concluir</p>
              </div>
              <button type="button" (click)="autoPost.update(v => !v)"
                      class="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
                      [class]="autoPost() ? 'bg-primary' : 'bg-border'">
                <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                      [class]="autoPost() ? 'translate-x-5' : 'translate-x-0'"></span>
              </button>
            </div>

            <button (click)="startWalk()"
                    class="w-full py-4 rounded-2xl bg-primary text-bg text-[15px] font-display font-bold shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Iniciar caminhada
            </button>
          </div>
        }

        <!-- ═══════════════════ RUNNING / PAUSED ═══════════════════ -->
        @if (phase() === 'running' || phase() === 'paused') {
          <div class="px-4 py-6 flex flex-col gap-5">

            <div class="flex flex-col items-center gap-5 py-4">
              <div class="relative w-52 h-52">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5.5"/>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#00FF88" stroke-width="5.5"
                          stroke-linecap="round"
                          [style.stroke-dasharray]="276.5"
                          [style.stroke-dashoffset]="ringOffset()"
                          style="transition:stroke-dashoffset 1s linear"/>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span class="text-[38px] font-display font-bold text-white leading-none tracking-tight">{{ formattedTime() }}</span>
                  <span class="text-[11px] font-body text-text-2 mt-1">{{ phase() === 'paused' ? '⏸ pausado' : '🟢 em andamento' }}</span>
                </div>
              </div>

              @if (gpsMode() && liveKm() > 0) {
                <div class="flex items-baseline gap-1.5">
                  <span class="text-[32px] font-display font-bold text-primary">{{ liveKm() | number:'1.1-2' }}</span>
                  <span class="text-[14px] font-body text-text-2">km</span>
                </div>
              }
            </div>

            <div class="flex gap-4 justify-center">
              <button (click)="togglePause()"
                      class="w-16 h-16 rounded-2xl border border-border bg-card-2 flex items-center justify-center text-text-2 hover:text-white transition-colors active:scale-95">
                @if (phase() === 'paused') {
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                } @else {
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                }
              </button>
              <button (click)="stopWalk()"
                      class="w-16 h-16 rounded-2xl bg-danger/20 border border-danger/30 flex items-center justify-center text-danger hover:bg-danger/30 transition-colors active:scale-95">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
            </div>

            @if (phase() === 'paused') {
              <p class="text-[12px] font-body text-text-2 text-center">Caminhada pausada. Retome ou finalize.</p>
            }
          </div>
        }

        <!-- ═══════════════════ DONE ═══════════════════ -->
        @if (phase() === 'done') {

          <!-- ── Walk Result Card — ocupa toda a largura ── -->
          <div class="flex flex-col" style="background:#080C10;border-bottom:1px solid rgba(255,255,255,0.07)">

            <!-- Header -->
            <div class="flex items-center justify-between px-4 pt-4 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-lg shrink-0">🚶</div>
                <div>
                  <p class="text-[13px] font-body font-bold text-white leading-tight">Repify Walk concluída!</p>
                  <p class="text-[10px] font-body text-text-2 mt-0.5">
                    Hoje às {{ finishedAtTime() }} <span class="text-primary">✓</span>
                  </p>
                </div>
              </div>
              <span class="text-[11px] font-display font-bold text-primary tracking-wider">repify</span>
            </div>

            <!-- Map — sem margens, ocupa toda a largura -->
            <div class="relative w-full overflow-hidden" style="height:260px;background:#0D1117">
              <canvas #routeCanvas class="w-full h-full" style="display:block"></canvas>
              @if (!gpsMode() || finalPositions().length < 2) {
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span class="text-4xl">🗺️</span>
                  <p class="text-[11px] font-body text-text-2 text-center px-6">
                    {{ gpsMode() ? 'Pontos insuficientes para o mapa' : 'Ative o GPS para ver o mapa da rota' }}
                  </p>
                </div>
              }
              @if (finalPositions().length >= 2) {
                <div class="absolute bottom-2 left-3 flex items-center gap-3">
                  <div class="flex items-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-primary"></div>
                    <span class="text-[9px] font-body text-white">Início</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-red-500"></div>
                    <span class="text-[9px] font-body text-white">Fim</span>
                  </div>
                </div>
              }
            </div>

            <!-- Stats grid — sem margens laterais -->
            <div class="grid grid-cols-4 divide-x divide-border border-t border-b border-border">
              <div class="flex flex-col items-center justify-center py-4 gap-0.5">
                <span class="text-[8px] font-body text-text-2 uppercase tracking-wider">Duração</span>
                <span class="text-[16px] font-display font-bold text-white leading-tight">{{ formattedTime() }}</span>
                <span class="text-[8px] font-body text-text-2">min</span>
              </div>
              <div class="flex flex-col items-center justify-center py-4 gap-0.5">
                <span class="text-[8px] font-body text-text-2 uppercase tracking-wider">Distância</span>
                <span class="text-[16px] font-display font-bold leading-tight"
                      [class]="finalKm() ? 'text-primary' : 'text-text-2'">
                  {{ finalKm() ? (finalKm()! | number:'1.1-2') : '--' }}
                </span>
                <span class="text-[8px] font-body text-text-2">km</span>
              </div>
              <div class="flex flex-col items-center justify-center py-4 gap-0.5">
                <span class="text-[8px] font-body text-text-2 uppercase tracking-wider">Calorias</span>
                <span class="text-[16px] font-display font-bold text-white leading-tight">{{ calories() }}</span>
                <span class="text-[8px] font-body text-text-2">kcal</span>
              </div>
              <div class="flex flex-col items-center justify-center py-4 gap-0.5">
                <span class="text-[8px] font-body text-text-2 uppercase tracking-wider">Ritmo</span>
                <span class="text-[16px] font-display font-bold text-white leading-tight">{{ walkSvc.formatPace(finalPace()) }}</span>
                <span class="text-[8px] font-body text-text-2">/km</span>
              </div>
            </div>

            <!-- Streak + Ranking -->
            <div class="grid grid-cols-2 divide-x divide-border">
              <div class="flex items-center gap-2.5 px-4 py-3">
                <span class="text-xl">🔥</span>
                <div>
                  <p class="text-[13px] font-display font-bold text-white leading-tight">{{ checkin.streak() }} dias</p>
                  <p class="text-[9px] font-body text-text-2">Seguindo firme!</p>
                </div>
              </div>
              <div class="flex items-center gap-2.5 px-4 py-3">
                <span class="text-xl">🏆</span>
                <div>
                  <p class="text-[13px] font-display font-bold text-white leading-tight">#{{ weekRank() }}</p>
                  <p class="text-[9px] font-body text-text-2">Entre seus amigos</p>
                </div>
              </div>
            </div>

          </div>

          <!-- Caption -->
          @if (autoPost()) {
            <div class="mx-4 mt-4 mb-3 bg-card-2 border border-border rounded-2xl p-4 space-y-2">
              <p class="text-[12px] font-body font-semibold text-white">Legenda do post (opcional)</p>
              <textarea [(ngModel)]="caption" rows="2" maxlength="300"
                        placeholder="Como foi a caminhada?"
                        class="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-[13px] font-body text-white placeholder:text-muted outline-none resize-none focus:border-primary/50 transition-colors leading-relaxed">
              </textarea>
            </div>
          }

          <!-- Action -->
          <div class="px-4 pb-6">
            <button (click)="finish()" [disabled]="publishing()"
                    class="w-full py-4 rounded-2xl bg-primary text-bg text-[15px] font-display font-bold shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              @if (publishing()) {
                <div class="w-4 h-4 rounded-full border-2 border-bg border-t-transparent animate-spin"></div>
                Publicando...
              } @else {
                {{ autoPost() ? 'Publicar no feed' : 'Concluir' }}
              }
            </button>
          </div>

        }

      </div>
    </div>
  `,
})
export class WalkModalComponent implements OnInit, OnDestroy {
  onClose   = output<void>();
  onPublish = output<WorkoutPost>();

  @ViewChild('routeCanvas') routeCanvasRef?: ElementRef<HTMLCanvasElement>;

  walkSvc        = inject(WalkService);
  checkin        = inject(CheckinService);
  private postSvc = inject(PostService);
  private auth    = inject(AuthService);
  private zone    = inject(NgZone);

  phase      = signal<Phase>('setup');
  gpsMode    = signal(false);
  autoPost   = signal(true);
  publishing = signal(false);
  caption    = '';

  private _elapsed      = signal(0);
  private _interval:    ReturnType<typeof setInterval> | null = null;
  private _liveKmSignal = signal(0);

  finalKm        = signal<number | null>(null);
  finalPositions = signal<GeoPoint[]>([]);
  liveKm         = computed(() => this._liveKmSignal());

  calories   = computed(() => this.walkSvc.calcCalories(this.finalKm() ?? 0, this._elapsed()));
  finalPace  = computed(() => this.walkSvc.calcPace(this.finalKm() ?? 0, this._elapsed()));
  weekRank   = computed(() => this.walkSvc.totalWalks() % 12 + 1); // placeholder rank

  formattedTime = computed(() => {
    const s = this._elapsed();
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h${String(m % 60).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  finishedAtTime = computed(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  ringOffset = computed(() => {
    const pct = (this._elapsed() % 60) / 60;
    return 276.5 - pct * 276.5;
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this._clearTimer();
    if (this.gpsMode()) this.walkSvc.stopGps();
  }

  startWalk(): void {
    if (this.gpsMode()) this.walkSvc.startGps();
    this._elapsed.set(0);
    this.phase.set('running');
    this._startTimer();
  }

  togglePause(): void {
    if (this.phase() === 'running') {
      this._clearTimer();
      this.phase.set('paused');
    } else {
      this._startTimer();
      this.phase.set('running');
    }
  }

  stopWalk(): void {
    this._clearTimer();
    if (this.gpsMode()) {
      const { distanceKm, positions } = this.walkSvc.stopGps();
      this.finalKm.set(distanceKm > 0 ? distanceKm : null);
      this.finalPositions.set(positions);
    }
    this.phase.set('done');

    // draw map after view updates
    setTimeout(() => this._drawMap(), 80);
  }

  tryClose(): void {
    if (this.phase() === 'running' || this.phase() === 'paused') {
      if (!confirm('Cancelar a caminhada em andamento?')) return;
      this._clearTimer();
      if (this.gpsMode()) this.walkSvc.stopGps();
    }
    this.onClose.emit();
  }

  async finish(): Promise<void> {
    if (this.publishing()) return;
    this.publishing.set(true);

    const durationSec = this._elapsed();
    const distanceKm  = this.finalKm();

    this.walkSvc.saveSession({
      startedAt:    new Date(Date.now() - durationSec * 1000).toISOString(),
      finishedAt:   new Date().toISOString(),
      durationSec,
      distanceKm,
      calories:     this.calories(),
      paceSecPerKm: this.finalPace(),
      gpsUsed:      this.gpsMode(),
      positions:    this.finalPositions(),
    });

    try { await this.checkin.checkIn(); } catch {}

    if (this.autoPost()) {
      try {
        const photo = await this._generateCardImage();

        const mins    = Math.floor(durationSec / 60);
        const kmStr   = distanceKm ? ` • ${distanceKm.toFixed(1)} km` : '';
        const calStr  = ` • ${this.calories()} kcal`;
        const autoLine = `🚶 Repify Walk concluída!\n${mins} min${kmStr}${calStr}`;
        const fullCaption = this.caption.trim()
          ? `${autoLine}\n\n${this.caption.trim()}`
          : autoLine;

        const post = await this.postSvc.createPost({
          photo:   photo,
          caption: fullCaption,
        });
        this.onPublish.emit(post);
      } catch {}
    }

    this.publishing.set(false);
    this.onClose.emit();
  }

  // ── Card image generation ──────────────────────────────────────────────────

  private _drawMap(): void {
    const canvas = this.routeCanvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.walkSvc.drawRouteOnCanvas(canvas, this.finalPositions(), {
      W: Math.round(rect.width * devicePixelRatio) || 800,
      H: Math.round(rect.height * devicePixelRatio) || 400,
      padding: 32,
    });
  }

  private async _generateCardImage(): Promise<File | null> {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#080C10';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 60; x < W - 60; x += 54)
      for (let y = 60; y < H - 60; y += 54) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }

    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 600);
    g1.addColorStop(0, 'rgba(0,255,136,0.07)'); g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0,255,136,0.10)'; ctx.lineWidth = 2;
    this._roundRect(ctx, 4, 4, W - 8, H - 8, 36); ctx.stroke();

    const M   = 64;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // ── Badge pill + subtitle (sem avatar/nome) ───────────────────────────────
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px system-ui, sans-serif';
    const badgeText  = '🚶 Repify Walk';
    const badgeTW    = ctx.measureText(badgeText).width;
    const badgePad   = 36;
    const badgePillW = badgeTW + badgePad * 2;
    const badgePillH = 60;
    const badgePillX = W / 2 - badgePillW / 2;
    const badgePillY = M + 28;
    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    this._roundRect(ctx, badgePillX, badgePillY, badgePillW, badgePillH, badgePillH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,136,0.3)'; ctx.lineWidth = 1.5;
    this._roundRect(ctx, badgePillX, badgePillY, badgePillW, badgePillH, badgePillH / 2); ctx.stroke();
    ctx.fillStyle = '#00FF88';
    ctx.fillText(badgeText, W / 2, badgePillY + 40);

    ctx.fillStyle = '#8896A8'; ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(`Hoje às ${timeStr}`, W / 2, badgePillY + 108);

    // ── Map area ──
    const mapY = 220, mapH = 520;
    this._roundRect(ctx, M, mapY, W - M * 2, mapH, 24);
    ctx.fillStyle = '#0D1117'; ctx.fill();

    const offMap = document.createElement('canvas');
    offMap.width  = (W - M * 2) * 2;
    offMap.height = mapH * 2;
    this.walkSvc.drawRouteOnCanvas(offMap, this.finalPositions(), {
      W: offMap.width, H: offMap.height, padding: 48,
    });
    ctx.save();
    this._roundRect(ctx, M, mapY, W - M * 2, mapH, 24); ctx.clip();
    ctx.drawImage(offMap, M, mapY, W - M * 2, mapH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,255,136,0.15)'; ctx.lineWidth = 1.5;
    this._roundRect(ctx, M, mapY, W - M * 2, mapH, 24); ctx.stroke();

    // ── Stats grid (4 cols) — totalmente centralizado ────────────────────────
    const statsY  = mapY + mapH + 36;
    const statGap = 10;
    const statW   = (W - M * 2 - statGap * 3) / 4;
    const statH   = 168;
    const statLabels = ['DURAÇÃO', 'DISTÂNCIA', 'CALORIAS', 'RITMO'];
    const statValues = [
      this.formattedTime(),
      this.finalKm() ? `${this.finalKm()!.toFixed(2)}` : '--',
      `${this.calories()}`,
      this.walkSvc.formatPace(this.finalPace()),
    ];
    const statUnits  = ['min', 'km', 'kcal', '/km'];
    const statColors = ['#FFF', '#00FF88', '#FFF', '#FFF'];

    ctx.textAlign = 'center';
    statLabels.forEach((label, i) => {
      const sx = M + i * (statW + statGap);
      const cx = sx + statW / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      this._roundRect(ctx, sx, statsY, statW, statH, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      this._roundRect(ctx, sx, statsY, statW, statH, 18); ctx.stroke();

      ctx.fillStyle = '#8896A8'; ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(label, cx, statsY + 38);

      ctx.fillStyle = statColors[i]; ctx.font = `bold 40px system-ui, sans-serif`;
      ctx.fillText(statValues[i], cx, statsY + 106);

      ctx.fillStyle = '#8896A8'; ctx.font = '21px system-ui, sans-serif';
      ctx.fillText(statUnits[i], cx, statsY + 144);
    });

    // ── Streak + Ranking — centralizados dentro dos cards ────────────────────
    const badgeY = statsY + statH + 28;
    const badgeW = (W - M * 2 - 16) / 2;
    const badgeH = 128;

    const drawBadgeCard = (
      x: number, emoji: string, value: string, sub: string, borderColor: string,
    ) => {
      const cx = x + badgeW / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      this._roundRect(ctx, x, badgeY, badgeW, badgeH, 20); ctx.fill();
      ctx.strokeStyle = borderColor; ctx.lineWidth = 1;
      this._roundRect(ctx, x, badgeY, badgeW, badgeH, 20); ctx.stroke();

      // emoji + value on one line, centered
      ctx.textAlign = 'center';
      ctx.font = '38px system-ui';
      ctx.fillText(emoji, cx - 60, badgeY + 70);
      ctx.fillStyle = '#FFF'; ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillText(value, cx + 28, badgeY + 68);
      ctx.fillStyle = '#8896A8'; ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(sub, cx, badgeY + 106);
    };

    drawBadgeCard(M,              '🔥', `${this.checkin.streak()} dias`, 'Seguindo firme!',    'rgba(255,100,0,0.2)');
    drawBadgeCard(M + badgeW + 16,'🏆', `#${this.weekRank()} semanal`,  'Entre seus amigos', 'rgba(255,200,0,0.2)');

    return new Promise<File | null>(resolve => {
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], 'repify-walk.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });
  }

  private _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

  private async _drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, url: string): Promise<void> {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (url) {
      try {
        const img = await this._loadImage(url);
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } catch { this._avatarFallback(ctx, cx, cy, r); }
    } else { this._avatarFallback(ctx, cx, cy, r); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,255,136,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();
  }

  private _avatarFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(0,255,136,0.3)'); g.addColorStop(1, 'rgba(0,194,255,0.1)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const profile = this.auth.profile();
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${r}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((profile.full_name || 'U').charAt(0).toUpperCase(), cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  private _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  private _startTimer(): void {
    this._clearTimer();
    this._interval = setInterval(() => {
      this.zone.run(() => {
        this._elapsed.update(s => s + 1);
        if (this.gpsMode() && this._elapsed() % 5 === 0) this._refreshLiveKm();
      });
    }, 1000);
  }

  private _refreshLiveKm(): void {
    const pts = this.walkSvc.getPositions();
    if (pts.length < 2) return;
    this._liveKmSignal.set(this.walkSvc.calcDistance(pts));
  }

  private _clearTimer(): void {
    if (this._interval !== null) { clearInterval(this._interval); this._interval = null; }
  }
}
