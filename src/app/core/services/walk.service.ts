import { Injectable, signal, computed, NgZone, inject } from '@angular/core';
import { RankingService } from './ranking.service';

export interface GeoPoint { lat: number; lng: number }

export interface WalkSession {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  distanceKm: number | null;
  calories: number | null;
  paceSecPerKm: number | null;
  gpsUsed: boolean;
  positions: GeoPoint[];
}

export type ActivePhase = 'idle' | 'running' | 'paused';

const LS_KEY = 'repify_walks';

@Injectable({ providedIn: 'root' })
export class WalkService {
  private zone    = inject(NgZone);
  private ranking = inject(RankingService);

  // ── Persisted history ──────────────────────────────────────────────────────
  private _history = signal<WalkSession[]>(this._load());
  readonly history = this._history.asReadonly();

  readonly totalWalks = computed(() => this._history().length);
  readonly totalKm    = computed(() =>
    this._history().reduce((s, w) => s + (w.distanceKm ?? 0), 0),
  );

  // ── Active walk state (singleton — persists across modal open/close) ───────
  readonly activePhase  = signal<ActivePhase>('idle');
  readonly elapsedSec   = signal(0);
  readonly activeGpsMode = signal(false);
  readonly liveKm       = signal(0);
  readonly isActive     = computed(() => this.activePhase() !== 'idle');

  readonly formattedTime = computed(() => {
    const s = this.elapsedSec();
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h${String(m % 60).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  private _interval: ReturnType<typeof setInterval> | null = null;

  // ── GPS tracking ─────────────────────────────────────────────────────────

  private _positions: GeoPoint[] = [];
  private _watchId: number | null = null;

  getPositions(): GeoPoint[] { return [...this._positions]; }

  startGps(): void {
    if (this._watchId !== null) return;
    this._positions = [];
    this._watchId = navigator.geolocation.watchPosition(
      pos => this._positions.push({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 },
    );
  }

  stopGps(): { distanceKm: number; positions: GeoPoint[] } {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    const positions  = [...this._positions];
    const distanceKm = this.calcDistance(positions);
    this._positions  = [];
    return { distanceKm, positions };
  }

  // ── Active walk lifecycle ─────────────────────────────────────────────────

  beginWalk(gpsMode: boolean): void {
    if (this.isActive()) return;
    this.activeGpsMode.set(gpsMode);
    this.elapsedSec.set(0);
    this.liveKm.set(0);
    if (gpsMode) this.startGps();
    this.activePhase.set('running');
    this._startTimer();
  }

  pauseWalk(): void {
    if (this.activePhase() !== 'running') return;
    this._clearTimer();
    this.activePhase.set('paused');
  }

  resumeWalk(): void {
    if (this.activePhase() !== 'paused') return;
    this.activePhase.set('running');
    this._startTimer();
  }

  /** Stops the active walk and returns the final GPS data. */
  finishActiveWalk(): { distanceKm: number | null; positions: GeoPoint[] } {
    this._clearTimer();
    let distanceKm: number | null = null;
    let positions: GeoPoint[] = [];
    if (this.activeGpsMode()) {
      const result = this.stopGps();
      distanceKm = result.distanceKm > 0 ? result.distanceKm : null;
      positions  = result.positions;
    }
    return { distanceKm, positions };
  }

  /** Fully resets the active walk state back to idle. Call after saving the session. */
  resetActiveWalk(): void {
    this._clearTimer();
    this.activePhase.set('idle');
    this.elapsedSec.set(0);
    this.liveKm.set(0);
    this.activeGpsMode.set(false);
  }

  /** Cancels without saving. */
  cancelWalk(): void {
    this._clearTimer();
    if (this.activeGpsMode()) this.stopGps();
    this.activePhase.set('idle');
    this.elapsedSec.set(0);
    this.liveKm.set(0);
    this.activeGpsMode.set(false);
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  calcDistance(pts: GeoPoint[]): number {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += this._haversine(pts[i - 1], pts[i]);
    return Math.round(total * 100) / 100;
  }

  calcCalories(distanceKm: number, durationSec: number): number {
    const hours = durationSec / 3600;
    return Math.round(3.5 * 70 * hours);
  }

  calcPace(distanceKm: number, durationSec: number): number | null {
    if (!distanceKm) return null;
    return Math.round(durationSec / distanceKm);
  }

  formatPace(secPerKm: number | null): string {
    if (!secPerKm) return '--';
    const m = Math.floor(secPerKm / 60);
    const s = secPerKm % 60;
    return `${m}'${String(s).padStart(2, '0')}"`;
  }

  saveSession(session: Omit<WalkSession, 'id'>): WalkSession {
    const full: WalkSession = { id: crypto.randomUUID(), ...session };
    this._history.update(h => {
      const next = [full, ...h];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
    // XP: +5 per walk, fire-and-forget
    this.ranking.recordXp('walk', 5, { distanceKm: full.distanceKm ?? 0 });
    return full;
  }

  // ── Map canvas ────────────────────────────────────────────────────────────

  drawRouteOnCanvas(
    canvas: HTMLCanvasElement,
    positions: GeoPoint[],
    opts: { W: number; H: number; padding: number } = { W: 800, H: 400, padding: 40 },
  ): void {
    const { W, H, padding } = opts;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0D1117';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (positions.length < 2) {
      ctx.fillStyle = 'rgba(0,255,136,0.3)';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados GPS', W / 2, H / 2);
      return;
    }

    const lats = positions.map(p => p.lat);
    const lngs = positions.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const scaleX = (W - padding * 2) / (maxLng - minLng || 0.0001);
    const scaleY = (H - padding * 2) / (maxLat - minLat || 0.0001);
    const scale  = Math.min(scaleX, scaleY);

    const toX = (lng: number) => padding + (lng - minLng) * scale + ((W - padding * 2) - (maxLng - minLng) * scale) / 2;
    const toY = (lat: number) => H - padding - (lat - minLat) * scale - ((H - padding * 2) - (maxLat - minLat) * scale) / 2;

    const pts = positions.map(p => ({ x: toX(p.lng), y: toY(p.lat) }));

    ctx.shadowColor = 'rgba(0,255,136,0.5)';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00FF88';
    ctx.fill();
    ctx.strokeStyle = '#080C10'; ctx.lineWidth = 2; ctx.stroke();

    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FF4466';
    ctx.fill();
    ctx.strokeStyle = '#080C10'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = 'rgba(0,255,136,0.25)';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('repify walk', W - 12, H - 10);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _startTimer(): void {
    this._clearTimer();
    this._interval = setInterval(() => {
      this.zone.run(() => {
        this.elapsedSec.update(s => s + 1);
        if (this.activeGpsMode() && this.elapsedSec() % 5 === 0) {
          const pts = this.getPositions();
          if (pts.length >= 2) this.liveKm.set(this.calcDistance(pts));
        }
      });
    }, 1000);
  }

  private _clearTimer(): void {
    if (this._interval !== null) { clearInterval(this._interval); this._interval = null; }
  }

  private _haversine(a: GeoPoint, b: GeoPoint): number {
    const R  = 6371;
    const dL = (b.lat - a.lat) * Math.PI / 180;
    const dG = (b.lng - a.lng) * Math.PI / 180;
    const x  = Math.sin(dL / 2) ** 2 +
               Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private _load(): WalkSession[] {
    try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; }
    catch { return []; }
  }
}
