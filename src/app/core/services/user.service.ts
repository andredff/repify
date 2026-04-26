import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabaseClient';
import { environment } from '../../../environments/environment';

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
  created_at: string;
}

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class UserService {

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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }
}
