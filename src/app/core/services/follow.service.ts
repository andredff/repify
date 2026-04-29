import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface FollowUser {
  id: string;
  name: string;
  username: string | null;
  avatar: string;
  level: string;
  isFollowing: boolean;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

@Injectable({ providedIn: 'root' })
export class FollowService {
  private auth = inject(AuthService);

  async follow(targetId: string): Promise<void> {
    const res = await this._fetch(`/api/follows/${targetId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao seguir usuário.');
  }

  async unfollow(targetId: string): Promise<void> {
    const res = await this._fetch(`/api/follows/${targetId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao deixar de seguir.');
  }

  async isFollowing(targetId: string): Promise<boolean> {
    const res = await this._fetch(`/api/follows/${targetId}/status`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.following ?? false;
  }

  async getCounts(userId: string): Promise<FollowCounts> {
    const res = await this._fetch(`/api/follows/${userId}/counts`);
    if (!res.ok) return { followers: 0, following: 0 };
    const data = await res.json();
    return { followers: data.followers ?? 0, following: data.following ?? 0 };
  }

  async getFollowers(userId: string): Promise<FollowUser[]> {
    const res = await this._fetch(`/api/follows/${userId}/followers`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.users ?? [];
  }

  async getFollowing(userId: string): Promise<FollowUser[]> {
    const res = await this._fetch(`/api/follows/${userId}/following`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.users ?? [];
  }

  private _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return this.auth.apiFetch(path, init);
  }
}
