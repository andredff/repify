import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { supabase } from '../supabase/supabaseClient';

export interface RankEntry {
  rank:       number;
  userId:     string;
  name:       string;
  username:   string | null;
  avatar:     string;
  totalXp:    number;
  workoutsDone: number;
  totalKm:    number;
  weeklyXp:   number;
  streakDays: number;
}

export interface MyRank {
  rank:       number;
  userId:     string;
  name:       string;
  username:   string | null;
  avatar:     string;
  totalXp:    number;
  workoutsDone: number;
  totalKm:    number;
  weeklyXp:   number;
  streakDays: number;
}

export type RankSort = 'xp' | 'workouts' | 'distance';

interface RankingResponse {
  entries: RankEntry[];
  me: MyRank | null;
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class RankingService {
  private auth = inject(AuthService);
  private API  = environment.apiBaseUrl;
  private readonly LIMIT = 20;

  readonly sortBy  = signal<RankSort>('xp');
  readonly entries = signal<RankEntry[]>([]);
  readonly myRank  = signal<MyRank | null>(null);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly hasMore = signal(false);

  readonly myEntry = computed(() => this.myRank());

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.load(true);
      } else {
        this.entries.set([]);
        this.myRank.set(null);
        this.page.set(1);
        this.total.set(0);
        this.hasMore.set(false);
      }
    });
  }

  setSort(sort: RankSort): void {
    if (this.sortBy() === sort) return;
    this.sortBy.set(sort);
    this.load(true);
  }

  async load(reset = false): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    if (reset) {
      this.loading.set(true);
      this.page.set(1);
    } else {
      if (this.loadingMore() || !this.hasMore()) return;
      this.loadingMore.set(true);
    }

    const nextPage = reset ? 1 : this.page() + 1;

    try {
      const res = await this._fetch(`/api/ranking?sort=${this.sortBy()}&page=${nextPage}&limit=${this.LIMIT}`);
      if (!res.ok) return;
      const data = await res.json() as RankingResponse;
      this.entries.set(reset ? (data.entries ?? []) : [...this.entries(), ...(data.entries ?? [])]);
      this.myRank.set(data.me ?? null);
      this.page.set(data.page ?? nextPage);
      this.total.set(data.total ?? 0);
      this.hasMore.set(data.hasMore ?? false);
    } finally {
      if (reset) {
        this.loading.set(false);
      } else {
        this.loadingMore.set(false);
      }
    }
  }

  async recordXp(
    type: 'workout' | 'walk' | 'streak_bonus',
    xp: number,
    extras: { streakDays?: number; distanceKm?: number } = {},
  ): Promise<void> {
    try {
      await this._fetch('/api/ranking/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, xp, streakDays: extras.streakDays, distanceKm: extras.distanceKm }),
      });
      // Reload ranking after XP recorded
      setTimeout(() => this.load(true), 300);
    } catch { /* non-critical */ }
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${this.API}${path}`, { ...init, headers });
  }
}
