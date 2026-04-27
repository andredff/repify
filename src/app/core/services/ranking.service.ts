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
  xp:         number;
  totalXp:    number;
  weeklyXp:   number;
  streakDays: number;
}

export interface MyRank {
  rank:       number;
  totalXp:    number;
  weeklyXp:   number;
  streakDays: number;
}

type RankMode = 'global' | 'weekly';

@Injectable({ providedIn: 'root' })
export class RankingService {
  private auth = inject(AuthService);
  private API  = environment.apiBaseUrl;

  readonly mode    = signal<RankMode>('global');
  readonly entries = signal<RankEntry[]>([]);
  readonly myRank  = signal<MyRank | null>(null);
  readonly loading = signal(false);

  readonly top3    = computed(() => this.entries().slice(0, 3));
  readonly rest    = computed(() => this.entries().slice(3));

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.load();
      } else {
        this.entries.set([]);
        this.myRank.set(null);
      }
    });
  }

  setMode(m: RankMode): void {
    this.mode.set(m);
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this._fetch(`/api/ranking?mode=${this.mode()}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      this.entries.set(data.entries ?? []);
      this.myRank.set(data.me ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async recordXp(type: 'workout' | 'walk' | 'streak_bonus', xp: number, streakDays?: number): Promise<void> {
    try {
      await this._fetch('/api/ranking/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, xp, streakDays }),
      });
      // Reload ranking after XP recorded
      setTimeout(() => this.load(), 300);
    } catch { /* non-critical */ }
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${this.API}${path}`, { ...init, headers });
  }
}
