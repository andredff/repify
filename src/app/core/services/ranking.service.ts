import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';

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

export interface CurrentUserRankingMetrics {
  totalXp: number;
  weeklyXp: number;
  workoutsDone: number;
  totalKm: number;
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

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') return '';
  return normalized;
}

function normalizeEntry(entry: RankEntry): RankEntry {
  return {
    ...entry,
    name: cleanText(entry.name) || 'Usuário',
    username: cleanText(entry.username) || null,
    avatar: cleanText(entry.avatar),
    totalXp: Number(entry.totalXp ?? 0),
    workoutsDone: Number(entry.workoutsDone ?? 0),
    totalKm: Number(entry.totalKm ?? 0),
    weeklyXp: Number(entry.weeklyXp ?? 0),
    streakDays: Number(entry.streakDays ?? 0),
  };
}

function normalizeMyRank(entry: MyRank | null): MyRank | null {
  return entry ? normalizeEntry(entry) : null;
}

function applyXpDelta<T extends RankEntry | MyRank>(
  entry: T,
  type: 'workout' | 'walk' | 'streak_bonus',
  xp: number,
  extras: { streakDays?: number; distanceKm?: number },
): T {
  const nextWorkoutsDone = type === 'workout' ? entry.workoutsDone + 1 : entry.workoutsDone;
  const nextTotalKm = type === 'walk' ? entry.totalKm + Number(extras.distanceKm ?? 0) : entry.totalKm;

  return {
    ...entry,
    totalXp: entry.totalXp + xp,
    weeklyXp: entry.weeklyXp + xp,
    workoutsDone: nextWorkoutsDone,
    totalKm: nextTotalKm,
    streakDays: extras.streakDays ?? entry.streakDays,
  };
}

@Injectable({ providedIn: 'root' })
export class RankingService {
  private auth = inject(AuthService);
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

    try {
      if (reset) {
        const allEntries: RankEntry[] = [];
        let currentPage = 1;
        let total = 0;
        let myRank: MyRank | null = null;
        let hasMore = false;

        do {
          const data = await this.fetchPage(currentPage);
          if (!data) return;

          allEntries.push(...(data.entries ?? []).map(normalizeEntry));
          myRank = normalizeMyRank(data.me ?? null);
          total = data.total ?? total;
          hasMore = data.hasMore ?? false;
          currentPage = (data.page ?? currentPage) + 1;
        } while (hasMore);

        this.entries.set(allEntries);
        this.myRank.set(myRank);
        this.page.set(Math.max(currentPage - 1, 1));
        this.total.set(total);
        this.hasMore.set(false);
      } else {
        const nextPage = this.page() + 1;
        const data = await this.fetchPage(nextPage);
        if (!data) return;

        const normalizedEntries = (data.entries ?? []).map(normalizeEntry);
        this.entries.set([...this.entries(), ...normalizedEntries]);
        this.myRank.set(normalizeMyRank(data.me ?? null));
        this.page.set(data.page ?? nextPage);
        this.total.set(data.total ?? 0);
        this.hasMore.set(data.hasMore ?? false);
      }
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
      const res = await this._fetch('/api/ranking/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, xp, streakDays: extras.streakDays, distanceKm: extras.distanceKm }),
      });

      if (!res.ok) {
        return;
      }

      this.applyLocalDelta(type, xp, extras);

      // Reload ranking after XP recorded to reconcile with backend ordering/ranks.
      setTimeout(() => void this.load(true), 300);
    } catch { /* non-critical */ }
  }

  syncCurrentUserMetrics(metrics: CurrentUserRankingMetrics): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    const profile = this.auth.profile();
    const fallbackName = profile.full_name?.trim() || this.auth.user()?.email?.split('@')[0] || 'Usuário';
    const fallbackUsername = profile.username?.trim() || null;
    const fallbackAvatar = this.auth.avatarUrl();

    this.myRank.update(entry => {
      if (!entry) {
        return {
          rank: this.entries().length + 1,
          userId,
          name: fallbackName,
          username: fallbackUsername,
          avatar: fallbackAvatar,
          totalXp: metrics.totalXp,
          weeklyXp: metrics.weeklyXp,
          workoutsDone: metrics.workoutsDone,
          totalKm: metrics.totalKm,
          streakDays: metrics.streakDays,
        };
      }
      if (entry.userId !== userId) return entry;
      return {
        ...entry,
        totalXp: metrics.totalXp,
        weeklyXp: metrics.weeklyXp,
        workoutsDone: metrics.workoutsDone,
        totalKm: metrics.totalKm,
        streakDays: metrics.streakDays,
      };
    });

    this.entries.update(entries => {
      const hasCurrentUser = entries.some(entry => entry.userId === userId);
      const baseEntries = hasCurrentUser ? entries : [
        ...entries,
        {
          rank: entries.length + 1,
          userId,
          name: fallbackName,
          username: fallbackUsername,
          avatar: fallbackAvatar,
          totalXp: metrics.totalXp,
          weeklyXp: metrics.weeklyXp,
          workoutsDone: metrics.workoutsDone,
          totalKm: metrics.totalKm,
          streakDays: metrics.streakDays,
        },
      ];

      const updated = baseEntries.map(entry => {
        if (entry.userId !== userId) return entry;
        return {
          ...entry,
          totalXp: metrics.totalXp,
          weeklyXp: metrics.weeklyXp,
          workoutsDone: metrics.workoutsDone,
          totalKm: metrics.totalKm,
          streakDays: metrics.streakDays,
        };
      });

      const sort = this.sortBy();
      const sorted = [...updated].sort((left, right) => {
        const primary = sort === 'workouts'
          ? right.workoutsDone - left.workoutsDone
          : sort === 'distance'
            ? right.totalKm - left.totalKm
            : right.totalXp - left.totalXp;

        if (primary !== 0) return primary;
        if (right.totalXp !== left.totalXp) return right.totalXp - left.totalXp;
        if (right.workoutsDone !== left.workoutsDone) return right.workoutsDone - left.workoutsDone;
        if (right.totalKm !== left.totalKm) return right.totalKm - left.totalKm;
        return left.name.localeCompare(right.name, 'pt-BR');
      });

      return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
    });
  }

  private applyLocalDelta(
    type: 'workout' | 'walk' | 'streak_bonus',
    xp: number,
    extras: { streakDays?: number; distanceKm?: number },
  ): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    this.myRank.update(entry => {
      if (!entry || entry.userId !== userId) return entry;
      return applyXpDelta(entry, type, xp, extras);
    });

    this.entries.update(entries => entries.map(entry => {
      if (entry.userId !== userId) return entry;
      return applyXpDelta(entry, type, xp, extras);
    }));
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return this.auth.apiFetch(path, init);
  }

  private async fetchPage(page: number): Promise<RankingResponse | null> {
    const res = await this._fetch(`/api/ranking?sort=${this.sortBy()}&page=${page}&limit=${this.LIMIT}`);
    if (!res.ok) return null;
    return await res.json() as RankingResponse;
  }
}
