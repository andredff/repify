import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { WorkoutPost, WorkoutPostPhoto } from '../models/workout-post.model';

export interface NewPostData {
  photo: File | null;
  photos?: File[];
  video?: File | null;
  caption: string;
  workout?: { name: string; muscleGroup: string } | null;
}

export interface FeedPage {
  posts: WorkoutPost[];
  hasMore: boolean;
}

interface ApiPost {
  id: string;
  caption: string | null;
  photo_url: string | null;
  photo_url_medium: string | null;
  photo_url_thumb: string | null;
  photo_gallery?: Array<{ full: string; medium?: string | null; thumb?: string | null }> | null;
  video_url?: string | null;
  workout: { name: string; muscleGroup: string } | null;
  likes: number;
  liked_by_preview_name?: string | null;
  liked_by_preview_avatar?: string | null;
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
    workouts_done: number | null;
  };
}

export interface PostLikeUser {
  id: string;
  name: string;
  username?: string;
  avatar: string;
}


@Injectable({ providedIn: 'root' })
export class PostService {
  private auth = inject(AuthService);

  /** Set when a post is published from the desktop shell so the feed can pick it up. */
  readonly pendingPost = signal<WorkoutPost | null>(null);

  setPendingPost(post: WorkoutPost | null): void {
    this.pendingPost.set(post);
  }

  canCreatePost(): boolean {
    const profile = this.auth.profile();
    return !!profile.full_name.trim() && !!profile.username.trim();
  }

  createPostRequirementMessage(): string {
    return 'Preencha nome e nome de usuário no perfil antes de publicar.';
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async listFeed(limit = 20, offset = 0): Promise<FeedPage> {
    const res = await this.fetch(`/api/posts?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`Erro ao carregar feed (${res.status})`);
    const data = await res.json();
    const posts = ((data.posts ?? []) as ApiPost[]).map(this.mapApiToPost);
    return {
      posts,
      hasMore: posts.length === limit,
    };
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
    if (!this.canCreatePost()) throw new Error(this.createPostRequirementMessage());

    // Upload video first (if provided)
    let videoUrl: string | undefined;
    if (data.video) {
      const form = new FormData();
      form.append('video', data.video, data.video.name || 'video.mp4');
      const uploadRes = await this.fetch('/api/upload/post-video', { method: 'POST', body: form });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Falha ao enviar vídeo.');
      }
      const { url } = await uploadRes.json();
      videoUrl = url;
    }

    // Upload photos
    const files = data.photos?.length ? data.photos.filter(Boolean) : (data.photo ? [data.photo] : []);
    const uploadedPhotos: WorkoutPostPhoto[] = [];

    for (const file of files) {
      const form = new FormData();
      form.append('photo', file, file.name || 'photo');

      const uploadRes = await this.fetch('/api/upload/post-photo', { method: 'POST', body: form });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Falha ao enviar foto.');
      }

      const urls = await uploadRes.json();
      uploadedPhotos.push({
        full: urls.full,
        medium: urls.medium ?? undefined,
        thumb: urls.thumb ?? undefined,
      });
    }

    const primaryPhoto = uploadedPhotos[0];

     const res = await this.fetch('/api/posts', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         caption:          data.caption || undefined,
         photo_url:        primaryPhoto?.full,
         photo_url_medium: primaryPhoto?.medium,
         photo_url_thumb:  primaryPhoto?.thumb,
         video_url:        videoUrl,
         workout_name:     data.workout?.name,
         workout_muscle:   data.workout?.muscleGroup,
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

  async getLikes(postId: string): Promise<PostLikeUser[]> {
    const res = await this.fetch(`/api/posts/${encodeURIComponent(postId)}/likes`);
    if (!res.ok) throw new Error('Falha ao carregar curtidas.');
    const data = await res.json();
    return (data.likes ?? []) as PostLikeUser[];
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
    return this.auth.apiFetch(path, init);
  }

  private mapApiToPost = (p: ApiPost): WorkoutPost => {
    const photos = this.normalizePhotos(p);

    return {
      id:       p.id,
      user: {
        id:          p.user.id,
        name:        p.user.name,
        username:    p.user.username ?? undefined,
        avatar:      p.user.avatar,
        level:       p.user.level,
        workoutsDone:p.user.workouts_done  != null ? Number(p.user.workouts_done) : null,
      },
      timeAgo:      p.time_ago,
      caption:      p.caption ?? undefined,
      workout:      p.workout ?? undefined,
      photos,
      photo:        photos[0]?.full ?? p.photo_url ?? undefined,
      photoMedium:  photos[0]?.medium ?? p.photo_url_medium ?? undefined,
      photoThumb:   photos[0]?.thumb ?? p.photo_url_thumb ?? undefined,
      videoUrl:     p.video_url ?? undefined,
      likes:        p.likes,
      likedByPreviewName:   p.liked_by_preview_name ?? undefined,
      likedByPreviewAvatar: p.liked_by_preview_avatar ?? undefined,
      comments:     p.comments,
      liked:        p.liked,
    };
  };

  private normalizePhotos(p: ApiPost): WorkoutPostPhoto[] {
    if (Array.isArray(p.photo_gallery) && p.photo_gallery.length > 0) {
      return p.photo_gallery
        .filter(photo => !!photo?.full)
        .map(photo => ({
          full: photo.full,
          medium: photo.medium ?? undefined,
          thumb: photo.thumb ?? undefined,
        }));
    }

    if (!p.photo_url) {
      return [];
    }

    return [{
      full: p.photo_url,
      medium: p.photo_url_medium ?? undefined,
      thumb: p.photo_url_thumb ?? undefined,
    }];
  }
}
