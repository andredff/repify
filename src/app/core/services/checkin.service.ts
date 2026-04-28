import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { RankingService } from './ranking.service';

export const CHECKIN_XP = 10;

interface CheckinResponse {
  created?: boolean;
  streakDays?: number;
  xpAwarded?: number;
  metrics?: {
    totalXp: number;
    weeklyXp: number;
    totalKm: number;
    streakDays: number;
  };
}

@Injectable({ providedIn: 'root' })
export class CheckinService {
  private readonly auth = inject(AuthService);
  private readonly ranking = inject(RankingService);

  // Datas com check-in no período carregado (YYYY-MM-DD)
  readonly dates   = signal<string[]>([]);
  readonly streak  = signal(0);
  readonly loading = signal(false);

  readonly todayChecked = computed(() => {
    const today = toLocalDate(new Date());
    return this.dates().includes(today);
  });

  // ── Carregar ────────────────────────────────────────────────────────────────

  async loadYear(year: number): Promise<void> {
    this.loading.set(true);
    try {
      const res  = await this.fetch(`/api/checkin?year=${year}`);
      const data = await res.json();
      this.dates.set(data.dates ?? []);
      this.streak.set(data.streak ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMonth(year: number, month: number): Promise<void> {
    const res  = await this.fetch(`/api/checkin?year=${year}&month=${month}`);
    const data = await res.json();
    return data;
  }

  // ── Check-in ────────────────────────────────────────────────────────────────

  async checkIn(): Promise<{ created: boolean; xpAwarded: number }> {
    if (this.todayChecked()) return { created: false, xpAwarded: 0 };

    const res = await this.fetch('/api/checkin', { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao fazer check-in.');

    const payload = await res.json() as CheckinResponse;
    const created = payload.created !== false;
    if (!created) {
      return { created: false, xpAwarded: 0 };
    }

    const today = toLocalDate(new Date());
    this.dates.update(d => [...d, today].sort());
    const nextStreak = payload.streakDays ?? (this.streak() + 1);
    this.streak.set(nextStreak);

    if (payload.metrics) {
      const currentRank = this.ranking.myRank();
      this.ranking.syncCurrentUserMetrics({
        totalXp: payload.metrics.totalXp,
        weeklyXp: payload.metrics.weeklyXp,
        workoutsDone: currentRank?.workoutsDone ?? 0,
        totalKm: payload.metrics.totalKm,
        streakDays: payload.metrics.streakDays,
      });
    } else {
      await this.ranking.recordXp('streak_bonus', CHECKIN_XP, { streakDays: nextStreak });
    }

    return { created: true, xpAwarded: payload.xpAwarded ?? CHECKIN_XP };
  }

  async undoCheckIn(): Promise<void> {
    if (!this.todayChecked()) return;
    const res = await this.fetch('/api/checkin/today', { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('Falha ao desfazer check-in.');

    let payload: CheckinResponse | null = null;
    if (res.status !== 204) {
      payload = await res.json() as CheckinResponse;
    }

    const today = toLocalDate(new Date());
    this.dates.update(d => d.filter(x => x !== today));
    this.streak.set(payload?.metrics?.streakDays ?? Math.max(0, this.streak() - 1));

    if (payload?.metrics) {
      const currentRank = this.ranking.myRank();
      this.ranking.syncCurrentUserMetrics({
        totalXp: payload.metrics.totalXp,
        weeklyXp: payload.metrics.weeklyXp,
        workoutsDone: currentRank?.workoutsDone ?? 0,
        totalKm: payload.metrics.totalKm,
        streakDays: payload.metrics.streakDays,
      });
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  weekDays(): { label: string; short: string; date: string; done: boolean; today: boolean }[] {
    const now   = new Date();
    const day   = now.getDay(); // 0=Sun
    const start = new Date(now);
    // Start from Monday
    start.setDate(now.getDate() - ((day + 6) % 7));

    return Array.from({ length: 7 }, (_, i) => {
      const d     = new Date(start);
      d.setDate(start.getDate() + i);
      const iso   = toLocalDate(d);
      const isToday = iso === toLocalDate(now);
      return {
        label: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i],
        short: ['S','T','Q','Q','S','S','D'][i],
        date:  iso,
        done:  this.dates().includes(iso),
        today: isToday,
      };
    });
  }

  monthStats(year: number, month: number): { total: number; days: number } {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const total  = this.dates().filter(d => d.startsWith(prefix)).length;
    const days   = new Date(year, month, 0).getDate();
    return { total, days };
  }

  yearStats(year: number): { month: number; total: number }[] {
    return Array.from({ length: 12 }, (_, i) => {
      const m      = i + 1;
      const prefix = `${year}-${String(m).padStart(2, '0')}-`;
      return { month: m, total: this.dates().filter(d => d.startsWith(prefix)).length };
    });
  }

  // ── HTTP ────────────────────────────────────────────────────────────────────

  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return this.auth.apiFetch(path, init);
  }
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
