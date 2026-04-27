import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalkService, GeoPoint } from '../../../core/services/walk.service';
import { PostService } from '../../../core/services/post.service';
import { CheckinService } from '../../../core/services/checkin.service';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { TimerComponent } from './timer.component';
import { MapViewComponent } from './map-view.component';

type WalkTrackerView = 'setup' | 'running' | 'paused' | 'done';

@Component({
  selector: 'app-walk-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, NgClass, TimerComponent, MapViewComponent],
  template: `
    <div class="walk-shell fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col bg-bg text-white"
         style="padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.08),transparent_34%)]"></div>

      <header class="relative z-[1] flex items-center justify-between px-4 py-3">
        <button type="button"
                (click)="tryClose()"
                class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card-2 text-text-2 transition-colors hover:text-white"
                aria-label="Fechar caminhada">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div class="text-center">
          <p class="text-[10px] font-body uppercase tracking-[0.22em] text-text-2">Repify Walk</p>
          <p class="mt-1 text-[14px] font-display font-bold text-white">{{ titleLine() }}</p>
        </div>

        <div class="flex h-10 w-10 items-center justify-center rounded-full border border-primary/18 bg-primary/10 text-primary">
          <span class="text-[18px] leading-none">🚶</span>
        </div>
      </header>

      <div class="walk-scroll relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div class="space-y-3">
          <app-timer [elapsedSec]="displayElapsedSec()" [phase]="timerPhase()" [label]="timerLabel()" />

          <div class="grid grid-cols-2 gap-3">
            <div class="metric-card">
              <span class="metric-label">Distância</span>
              <span class="metric-value text-primary">{{ displayDistance() | number:'1.1-2' }}</span>
              <span class="metric-unit">km</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Estado</span>
              <span class="metric-value" [ngClass]="statusToneClass()">{{ statusValue() }}</span>
              <span class="metric-unit">{{ statusHint() }}</span>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <app-map-view
            [phase]="mapPhase()"
            [center]="mapCenter()"
            [currentPosition]="mapCurrentPosition()"
            [path]="mapPath()"
            [height]="mapHeight()"
            [emptyTitle]="mapEmptyTitle()"
            [emptyCopy]="mapEmptyCopy()" />
        </div>

        <div class="mt-4">
          @if (viewPhase() === 'setup') {
            <div class="space-y-4 rounded-[24px] border border-white/8 bg-card-2/80 p-4">
              <div class="space-y-1.5 text-center">
                <p class="text-[18px] font-display font-bold text-white">Começar caminhada</p>
                <p class="text-[12px] font-body leading-5 text-text-2">
                  Abra o mapa, acompanhe seu ponto em tempo real e finalize com o trajeto completo salvo.
                </p>
              </div>

              <div class="rounded-2xl border border-white/8 bg-black/15 px-3.5 py-3 text-center text-[11px] font-body text-text-2">
                {{ locationMessage() }}
              </div>

              <button type="button"
                      (click)="refreshLocation()"
                      [disabled]="isLocating()"
                      class="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-body font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v4"/>
                  <path d="M12 18v4"/>
                  <path d="M2 12h4"/>
                  <path d="M18 12h4"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                {{ isLocating() ? 'Localizando...' : 'Usar minha localização' }}
              </button>

              <button type="button"
                      (click)="startWalk()"
                      class="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 py-4 text-[15px] font-display font-bold text-bg shadow-glow transition-all hover:shadow-glow-lg active:scale-[0.98]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Começar caminhada
              </button>
            </div>
          }

          @if (viewPhase() === 'running' || viewPhase() === 'paused') {
            <div class="space-y-4 rounded-[24px] border border-white/8 bg-card-2/80 p-4">
              <div class="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3.5 py-3">
                <div>
                  <p class="text-[12px] font-body font-semibold text-white">Tracking em tempo real</p>
                  <p class="mt-0.5 text-[11px] font-body text-text-2">Seu ponto atual e a linha do trajeto atualizam ao vivo no mapa.</p>
                </div>
                <span class="rounded-full border px-2.5 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.16em]"
                      [ngClass]="statusToneClass()">
                  {{ statusValue() }}
                </span>
              </div>

              <div class="flex gap-3">
                <button type="button"
                        (click)="refreshLocation()"
                        [disabled]="isLocating()"
                        class="flex items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-body font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                        aria-label="Atualizar localização no mapa">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v4"/>
                    <path d="M12 18v4"/>
                    <path d="M2 12h4"/>
                    <path d="M18 12h4"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>

                <button type="button"
                        (click)="togglePause()"
                        class="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-body font-semibold text-white transition-all active:scale-[0.98]">
                  @if (viewPhase() === 'paused') {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Retomar
                  } @else {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    Pausar
                  }
                </button>

                <button type="button"
                        (click)="stopWalk()"
                        class="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[13px] font-display font-bold text-bg shadow-glow transition-all active:scale-[0.98]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                  Finalizar
                </button>
              </div>

              <button type="button"
                      (click)="tryClose()"
                      class="mx-auto block text-[12px] font-body text-text-2 underline underline-offset-4 transition-opacity active:opacity-70">
                Fechar e continuar em segundo plano
              </button>
            </div>
          }

          @if (viewPhase() === 'done') {
            <div class="space-y-4 rounded-[24px] border border-primary/18 bg-card-2/90 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
              <div class="space-y-1.5 text-center">
                <p class="text-[18px] font-display font-bold text-white">Caminhada concluída</p>
                <p class="text-[12px] font-body leading-5 text-text-2">Trajeto mantido no mapa com início e fim destacados.</p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="metric-card">
                  <span class="metric-label">Tempo total</span>
                  <span class="metric-value text-white">{{ doneTime() }}</span>
                  <span class="metric-unit">duração</span>
                </div>
                <div class="metric-card">
                  <span class="metric-label">Distância</span>
                  <span class="metric-value text-primary">{{ displayDistance() | number:'1.1-2' }}</span>
                  <span class="metric-unit">km</span>
                </div>
              </div>

              <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3.5 py-3">
                <div>
                  <p class="text-[12px] font-body font-semibold text-white">Publicar no feed</p>
                  <p class="mt-0.5 text-[11px] font-body text-text-2">Gera um post automático com o mapa da caminhada.</p>
                </div>
                <button type="button"
                        (click)="autoPost.update(value => !value)"
                        class="relative h-6 w-11 rounded-full transition-colors"
                        [class.bg-primary]="autoPost()"
                        [class.bg-border]="!autoPost()"
                        aria-label="Alternar publicação automática">
                  <span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
                        [class.left-1]="!autoPost()"
                        [class.left-6]="autoPost()"></span>
                </button>
              </div>

              @if (autoPost()) {
                <div class="rounded-2xl border border-white/8 bg-black/15 p-3.5">
                  <label class="mb-2 block text-[12px] font-body font-semibold text-white" for="walk-caption">Legenda do post</label>
                  <textarea id="walk-caption"
                            [(ngModel)]="caption"
                            rows="3"
                            maxlength="300"
                            placeholder="Como foi a caminhada?"
                            class="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-[13px] font-body text-white outline-none transition-colors placeholder:text-text-2 focus:border-primary/40"></textarea>
                </div>
              }

              <button type="button"
                      (click)="finish()"
                      [disabled]="publishing()"
                      class="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-[15px] font-display font-bold text-bg shadow-glow transition-all hover:shadow-glow-lg active:scale-[0.98] disabled:opacity-60">
                @if (publishing()) {
                  <div class="h-4 w-4 rounded-full border-2 border-bg border-t-transparent animate-spin"></div>
                  Publicando...
                } @else {
                  {{ autoPost() ? 'Concluir e publicar' : 'Concluir' }}
                }
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .walk-shell {
      height:100dvh;
      overflow:hidden;
      background:
        radial-gradient(circle at top, rgba(0,255,136,0.08), transparent 30%),
        linear-gradient(180deg, rgba(8,12,16,0.98), rgba(5,8,12,1));
    }
    .walk-scroll {
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
      touch-action:pan-y;
    }
    .metric-card {
      display:flex;
      min-height:5.8rem;
      flex-direction:column;
      justify-content:center;
      gap:0.22rem;
      border-radius:1.15rem;
      border:1px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.035);
      padding:0.95rem 1rem;
    }
    .metric-label {
      font-size:0.62rem;
      letter-spacing:0.18em;
      text-transform:uppercase;
      color:#96A0AA;
      font-family:var(--font-body, inherit);
    }
    .metric-value {
      font-size:1.4rem;
      line-height:1;
      letter-spacing:-0.04em;
      font-family:var(--font-display, inherit);
      font-weight:700;
    }
    .metric-unit {
      font-size:0.72rem;
      color:#96A0AA;
      font-family:var(--font-body, inherit);
    }
  `],
})
export class WalkTrackerComponent implements OnInit, OnDestroy {
  readonly onClose = output<void>();
  readonly onPublish = output<WorkoutPost>();

  readonly walkSvc = inject(WalkService);
  readonly checkin = inject(CheckinService);
  private readonly postSvc = inject(PostService);
  private previousBodyOverflow = '';
  private previousBodyOverscroll = '';
  private previousHtmlOverflow = '';
  private previousHtmlOverscroll = '';

  readonly autoPost = signal(true);
  readonly publishing = signal(false);
  caption = '';

  readonly finalKm = signal<number | null>(null);
  readonly finalPositions = signal<GeoPoint[]>([]);
  readonly doneSec = signal(0);
  readonly finishedAt = signal<string | null>(null);

  private readonly done = signal(false);

  readonly viewPhase = computed<WalkTrackerView>(() => {
    if (this.done()) return 'done';
    const phase = this.walkSvc.activePhase();
    if (phase === 'idle') return 'setup';
    return phase;
  });

  readonly timerPhase = computed<'idle' | 'running' | 'paused' | 'done'>(() => {
    const phase = this.viewPhase();
    if (phase === 'setup') return 'idle';
    if (phase === 'done') return 'done';
    return phase;
  });

  readonly timerLabel = computed(() => this.viewPhase() === 'done' ? 'Tempo total' : 'Tempo da caminhada');
  readonly displayElapsedSec = computed(() => this.viewPhase() === 'done' ? this.doneSec() : this.walkSvc.elapsedSec());
  readonly displayDistance = computed(() => this.viewPhase() === 'done' ? (this.finalKm() ?? 0) : this.walkSvc.liveKm());
  readonly mapPhase = computed<'preview' | 'active' | 'result'>(() => {
    if (this.viewPhase() === 'done') return 'result';
    if (this.viewPhase() === 'setup') return 'preview';
    return 'active';
  });
  readonly mapPath = computed(() => this.viewPhase() === 'done' ? this.finalPositions() : this.walkSvc.activeTrail());
  readonly mapCenter = computed(() => this.mapPath().at(-1) ?? this.walkSvc.currentPosition() ?? null);
  readonly mapCurrentPosition = computed(() => this.viewPhase() === 'done' ? null : this.walkSvc.currentPosition());
  readonly statusValue = computed(() => {
    const phase = this.viewPhase();
    if (phase === 'done') return 'Concluída';
    if (phase === 'paused') return 'Pausada';
    if (phase === 'running') return 'Ativa';

    const location = this.walkSvc.locationState();
    if (location === 'locating') return 'Buscando';
    if (location === 'ready') return 'Pronto';
    if (location === 'denied') return 'Sem GPS';
    if (location === 'unsupported') return 'Sem mapa';
    return 'Aguardando';
  });
  readonly statusHint = computed(() => {
    const phase = this.viewPhase();
    if (phase === 'done') return 'resultado';
    if (phase === 'paused') return 'retome quando quiser';
    if (phase === 'running') return 'tracking ao vivo';

    const location = this.walkSvc.locationState();
    if (location === 'ready') return 'mapa centralizado';
    if (location === 'denied') return 'permissão negada';
    if (location === 'unsupported') return 'geolocalização indisponível';
    return 'preparando';
  });
  readonly titleLine = computed(() => {
    const phase = this.viewPhase();
    if (phase === 'done') return 'Resultado da caminhada';
    if (phase === 'running' || phase === 'paused') return 'Tracking em tempo real';
    return 'Mapa ao vivo e relógio';
  });
  readonly locationMessage = computed(() => {
    const state = this.walkSvc.locationState();
    if (state === 'ready') return 'Mapa centralizado na sua posição atual. Quando começar, o trajeto será desenhado em tempo real.';
    if (state === 'locating') return 'Pedindo sua localização para centralizar o mapa antes de começar.';
    if (state === 'denied') return 'A permissão de localização foi negada. Você ainda pode iniciar, mas o mapa pode não acompanhar sua posição.';
    if (state === 'unsupported') return 'Seu dispositivo não expõe geolocalização. O cronômetro funciona, mas o mapa não poderá rastrear o trajeto.';
    if (state === 'error') return 'Não foi possível obter sua localização agora. Tente novamente em um local com sinal melhor.';
    return 'Permita o GPS para começar com o mapa pronto.';
  });
  readonly statusToneClass = computed(() => {
    const phase = this.viewPhase();
    if (phase === 'done' || phase === 'running') return 'text-primary';
    if (phase === 'paused') return 'text-text-2';
    const state = this.walkSvc.locationState();
    if (state === 'ready') return 'text-primary';
    if (state === 'denied' || state === 'error') return 'text-danger';
    return 'text-text-2';
  });
  readonly mapEmptyTitle = computed(() => this.viewPhase() === 'done' ? 'Sem rota suficiente' : 'Mapa da caminhada');
  readonly mapEmptyCopy = computed(() => this.viewPhase() === 'done'
    ? 'Ative o GPS durante a caminhada para salvar o trajeto completo aqui.'
    : this.locationMessage());
  readonly mapHeight = computed(() => this.viewPhase() === 'done' ? '220px' : '250px');
  readonly doneTime = computed(() => {
    const totalSeconds = this.doneSec();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });
  readonly calories = computed(() => this.walkSvc.calcCalories(this.finalKm() ?? 0, this.doneSec()));
  readonly finalPace = computed(() => this.walkSvc.calcPace(this.finalKm() ?? 0, this.doneSec()));
  readonly weekRank = computed(() => this.walkSvc.totalWalks() % 12 + 1);
  readonly isLocating = computed(() => this.walkSvc.locationState() === 'locating');

  ngOnInit(): void {
    this.lockPageScroll();
    if (this.viewPhase() === 'setup' && !this.walkSvc.currentPosition()) {
      void this.walkSvc.requestCurrentPosition();
    }
  }

  ngOnDestroy(): void {
    this.unlockPageScroll();
  }

  refreshLocation(): void {
    void this.walkSvc.requestCurrentPosition();
  }

  startWalk(): void {
    this.done.set(false);
    this.finalKm.set(null);
    this.finalPositions.set([]);
    this.finishedAt.set(null);
    void this.walkSvc.requestCurrentPosition();
    this.walkSvc.beginWalk(true);
  }

  togglePause(): void {
    if (this.walkSvc.activePhase() === 'running') {
      this.walkSvc.pauseWalk();
      return;
    }
    this.walkSvc.resumeWalk();
  }

  stopWalk(): void {
    this.doneSec.set(this.walkSvc.elapsedSec());
    const { distanceKm, positions } = this.walkSvc.finishActiveWalk();
    this.finalKm.set(distanceKm);
    this.finalPositions.set(positions);
    this.finishedAt.set(new Date().toISOString());
    this.done.set(true);
  }

  tryClose(): void {
    const phase = this.walkSvc.activePhase();
    if (phase === 'running' || phase === 'paused') {
      this.onClose.emit();
      return;
    }
    this.onClose.emit();
  }

  private lockPageScroll(): void {
    this.previousBodyOverflow = document.body.style.overflow;
    this.previousBodyOverscroll = document.body.style.overscrollBehavior;
    this.previousHtmlOverflow = document.documentElement.style.overflow;
    this.previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
  }

  private unlockPageScroll(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    document.body.style.overscrollBehavior = this.previousBodyOverscroll;
    document.documentElement.style.overflow = this.previousHtmlOverflow;
    document.documentElement.style.overscrollBehavior = this.previousHtmlOverscroll;
  }

  async finish(): Promise<void> {
    if (this.publishing()) return;
    this.publishing.set(true);

    const durationSec = this.doneSec();
    const distanceKm = this.finalKm();
    const finishedAt = this.finishedAt() ?? new Date().toISOString();

    this.walkSvc.saveSession({
      startedAt: new Date(new Date(finishedAt).getTime() - durationSec * 1000).toISOString(),
      finishedAt,
      durationSec,
      distanceKm,
      calories: this.calories(),
      paceSecPerKm: this.finalPace(),
      gpsUsed: true,
      positions: this.finalPositions(),
    });

    this.walkSvc.resetActiveWalk();

    try {
      await this.checkin.checkIn();
    } catch {}

    if (this.autoPost()) {
      try {
        const photo = await this.generateCardImage();
        const minutes = Math.floor(durationSec / 60);
        const kmText = distanceKm ? ` • ${distanceKm.toFixed(1)} km` : '';
        const baseLine = `🚶 Repify Walk concluída!\n${minutes} min${kmText} • ${this.calories()} kcal`;
        const fullCaption = this.caption.trim() ? `${baseLine}\n\n${this.caption.trim()}` : baseLine;

        const post = await this.postSvc.createPost({ photo, caption: fullCaption });
        this.onPublish.emit(post);
      } catch {}
    }

    this.publishing.set(false);
    this.onClose.emit();
  }

  private async generateCardImage(): Promise<File | null> {
    const width = 864;
    const height = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = '#080C10';
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 56; x < width - 56; x += 54) {
      for (let y = 56; y < height - 56; y += 54) {
        context.beginPath();
        context.arc(x, y, 1.4, 0, Math.PI * 2);
        context.fill();
      }
    }

    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 520);
    glow.addColorStop(0, 'rgba(0,255,136,0.08)');
    glow.addColorStop(1, 'transparent');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.textAlign = 'center';
    context.fillStyle = '#00FF88';
    context.font = 'bold 24px system-ui, sans-serif';
    context.fillText('Repify Walk', width / 2, 90);

    context.fillStyle = '#F5F7FA';
    context.font = 'bold 62px system-ui, sans-serif';
    context.fillText(this.doneTime(), width / 2, 178);

    context.fillStyle = '#96A0AA';
    context.font = '20px system-ui, sans-serif';
    context.fillText(`${this.displayDistance().toFixed(2)} km • ${this.walkSvc.formatPace(this.finalPace())}/km`, width / 2, 218);

    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 1400;
    mapCanvas.height = 700;
    this.walkSvc.drawRouteOnCanvas(mapCanvas, this.finalPositions(), { W: mapCanvas.width, H: mapCanvas.height, padding: 54 });
    context.drawImage(mapCanvas, 52, 264, width - 104, 416);

    context.fillStyle = 'rgba(255,255,255,0.05)';
    this.roundRect(context, 52, 720, width - 104, 176, 24);
    context.fill();

    const metrics = [
      ['Tempo', this.doneTime()],
      ['Distância', `${this.displayDistance().toFixed(2)} km`],
      ['Calorias', `${this.calories()} kcal`],
    ] as const;

    metrics.forEach(([label, value], index) => {
      const cellWidth = (width - 128) / 3;
      const x = 64 + cellWidth * index + cellWidth / 2;
      context.fillStyle = '#96A0AA';
      context.font = '18px system-ui, sans-serif';
      context.fillText(label, x, 772);
      context.fillStyle = index === 1 ? '#00FF88' : '#F5F7FA';
      context.font = 'bold 31px system-ui, sans-serif';
      context.fillText(value, x, 834);
    });

    return this.exportCanvasAsJpeg(canvas, 'repify-walk.jpg');
  }

  private exportCanvasAsJpeg(canvas: HTMLCanvasElement, fileName: string): Promise<File | null> {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], fileName, { type: 'image/jpeg' }));
          return;
        }

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const file = this.dataUrlToFile(dataUrl, fileName);
          resolve(file);
        } catch {
          resolve(null);
        }
      }, 'image/jpeg', 0.9);
    });
  }

  private dataUrlToFile(dataUrl: string, fileName: string): File {
    const [header, base64] = dataUrl.split(',');
    const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'image/jpeg';
    const binary = atob(base64 ?? '');
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, { type: mime });
  }

  private roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }
}
