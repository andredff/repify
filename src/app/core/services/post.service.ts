import { Injectable, inject } from '@angular/core';
import { supabase } from '../supabase/supabaseClient';
import { AuthService } from './auth.service';
import { WorkoutPost } from '../models/workout-post.model';

export interface NewPostData {
  photo: File | null;
  caption: string;
  workout?: { name: string; muscleGroup: string } | null;
}

const BUCKET = 'workout-photos';

@Injectable({ providedIn: 'root' })
export class PostService {
  private auth = inject(AuthService);

  async createPost(data: NewPostData): Promise<WorkoutPost> {
    const user    = this.auth.user();
    const profile = this.auth.profile();
    if (!user) throw new Error('Usuário não autenticado.');

    let photoUrl = '';

    if (data.photo) {
      const ext  = data.photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, data.photo, { upsert: false, contentType: data.photo.type });

      if (error) throw new Error('Falha ao enviar foto: ' + error.message);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const post: WorkoutPost = {
      id:      crypto.randomUUID(),
      user: {
        id:       user.id,
        name:     profile.full_name || user.email?.split('@')[0] || 'Você',
        username: profile.username  || undefined,
        avatar:   this.auth.avatarUrl(),
        level:    'Elite',
      },
      timeAgo:  'agora',
      caption:  data.caption || undefined,
      workout:  data.workout ?? undefined,
      photo:    photoUrl || undefined,
      likes:    0,
      comments: 0,
      liked:    false,
    };

    return post;
  }

  async deletePhoto(photoUrl: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const marker = `/object/public/${BUCKET}/`;
    const idx = photoUrl.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(photoUrl.slice(idx + marker.length).split('?')[0]);
    await supabase.storage.from(BUCKET).remove([path]);
  }
}
