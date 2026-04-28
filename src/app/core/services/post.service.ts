import { Injectable, inject, signal } from '@angular/core';
import { supabase } from '../supabase/supabaseClient';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { WorkoutPost } from '../models/workout-post.model';

export interface NewPostData {
  photo: File | null;
  caption: string;
  workout?: { name: string; muscleGroup: string } | null;
}

interface ApiPost {
  id: string;
  caption: string | null;
  photo_url: string | null;
  workout: { name: string; muscleGroup: string } | null;
  likes: number;
  comments: number;
  liked: boolean;
  created_at: string;
  time_ago: string;
  user: {
    id: string;
    name: string;
    username: string | null;
    avatar: string;
    level: string;
    yearly_goal: number | null;
    workouts_done: number | null;
  };
}

const BUCKET   = 'workout-photos';
const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class PostService {
  private auth = inject(AuthService);

  /** Set when a post is published from the desktop shell so the feed can pick it up. */
  readonly pendingPost = signal<WorkoutPost | null>(null);

  setPendingPost(post: WorkoutPost | null): void {
    this.pendingPost.set(post);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async listFeed(limit = 20, offset = 0): Promise<WorkoutPost[]> {
    const res = await this.fetch(`/api/posts?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`Erro ao carregar feed (${res.status})`);
    const data = await res.json();
    return ((data.posts ?? []) as ApiPost[]).map(this.mapApiToPost);
  }

  async listByUser(userId: string): Promise<WorkoutPost[]> {
    const res = await this.fetch(`/api/posts/user/${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Erro ao carregar posts (${res.status})`);
    const data = await res.json();
    return ((data.posts ?? []) as ApiPost[]).map(this.mapApiToPost);
  }

  async createPost(data: NewPostData): Promise<WorkoutPost> {
    const user = this.auth.user();
    if (!user) throw new Error('Usuário não autenticado.');

    let photoUrl: string | undefined;

    if (data.photo) {
      const ext  = data.photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, data.photo, { upsert: false, contentType: data.photo.type });

      if (error) throw new Error('Falha ao enviar foto: ' + error.message);

      photoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const res = await this.fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption:        data.caption || undefined,
        photo_url:      photoUrl,
        workout_name:   data.workout?.name,
        workout_muscle: data.workout?.muscleGroup,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Falha ao publicar post.');
    }

    const { post } = await res.json();
    return this.mapApiToPost(post);
  }

  async updateCaption(postId: string, caption: string): Promise<void> {
    const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
    if (!res.ok) throw new Error('Falha ao editar post.');
  }

  async deletePost(postId: string): Promise<void> {
    const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      throw new Error('Falha ao apagar post.');
    }
  }

  async toggleLike(postId: string): Promise<boolean> {
    const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao curtir post.');
    const data = await res.json();
    return data.liked as boolean;
  }

  async getById(postId: string): Promise<WorkoutPost | null> {
    const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}`);
    if (!res.ok) return null;
    const { post } = await res.json();
    return this.mapApiToPost(post);
  }

  // ─── Shortlink ──────────────────────────────────────────────────────────────

  async getShortlink(postId: string): Promise<string | null> {
    try {
      const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}/shortlink`, {
        method: 'POST',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.shortlink || null;
    } catch {
      return null;
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }

  private mapApiToPost = (p: ApiPost): WorkoutPost => ({
    id:       p.id,
    user: {
      id:          p.user.id,
      name:        p.user.name,
      username:    p.user.username ?? undefined,
      avatar:      p.user.avatar,
      level:       p.user.level,
      yearlyGoal:  p.user.yearly_goal   != null ? Number(p.user.yearly_goal)   : null,
      workoutsDone:p.user.workouts_done  != null ? Number(p.user.workouts_done) : null,
    },
    timeAgo:  p.time_ago,
    caption:  p.caption ?? undefined,
    workout:  p.workout ?? undefined,
    photo:    p.photo_url ?? undefined,
    likes:    p.likes,
    comments: p.comments,
    liked:    p.liked,
  });
}
