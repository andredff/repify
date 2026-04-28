import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  bio: string;
  avatar: string;
  goal: string;
  level: string;
  yearly_goal: number | null;
  workouts_done: number | null;
  total_xp: number;
  total_walk_km: number;
  streak_days: number;
  created_at: string;
  last_sign_in_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private auth = inject(AuthService);

  async listUsers(limit = 30, page = 1): Promise<PublicUser[]> {
    const res = await this.fetch(`/api/users?limit=${limit}&page=${page}`);
    if (!res.ok) throw new Error('Falha ao carregar usuários.');
    const data = await res.json();
    return data.users as PublicUser[];
  }

  async getUser(handle: string): Promise<PublicUser | null> {
    const res = await this.fetch(`/api/users/${encodeURIComponent(handle)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Falha ao carregar usuário.');
    const data = await res.json();
    return data.user as PublicUser;
  }

  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return this.auth.apiFetch(path, init);
  }
}
