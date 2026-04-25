import { Injectable, signal, computed } from '@angular/core';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabaseClient';

export interface UserProfile {
  full_name: string;
  username: string;
  bio: string;
  weight: number | null;
  height: number | null;
  goal: string;
  avatar_url: string;
}

const AVATAR_BUCKET = 'avatars';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session     = signal<Session | null>(null);
  private readonly _initialized = signal(false);
  private readonly _avatarUrl   = signal<string>('');

  readonly session         = this._session.asReadonly();
  readonly user            = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly initialized     = this._initialized.asReadonly();
  readonly avatarUrl       = this._avatarUrl.asReadonly();

  readonly profile = computed<UserProfile>(() => {
    const meta = this._session()?.user?.user_metadata ?? {};
    return {
      full_name:  meta['full_name']  ?? '',
      username:   meta['username']   ?? '',
      bio:        meta['bio']        ?? '',
      weight:     meta['weight']     ?? null,
      height:     meta['height']     ?? null,
      goal:       meta['goal']       ?? '',
      avatar_url: meta['avatar_url'] ?? '',
    };
  });

  constructor() {
    this.init();
  }

  private init(): void {
    supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);

      // Resolve public avatar URL when session is restored
      const avatarPath = session?.user?.user_metadata?.['avatar_url'];
      if (avatarPath) {
        this._resolveAvatarUrl(avatarPath);
      }

      if (!this._initialized()) {
        this._initialized.set(true);
      }
    });
  }

  private _resolveAvatarUrl(path: string, bust = false): void {
    if (path.startsWith('http')) {
      this._avatarUrl.set(path);
      return;
    }
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = bust ? `${data.publicUrl}?t=${Date.now()}` : data.publicUrl;
    this._avatarUrl.set(url);
  }

  /**
   * Upload a new avatar to Supabase Storage and persist the path in user_metadata.
   * Returns the public URL of the uploaded image.
   */
  async uploadAvatar(file: File): Promise<string> {
    const userId = this.user()?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error('Falha ao enviar imagem: ' + uploadError.message);

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    // Persist path in user_metadata (not the full URL, so it survives domain changes)
    await this.updateProfile({ avatar_url: path });

    // Bust cache so the new photo appears immediately without a stale CDN hit
    this._resolveAvatarUrl(path, true);
    return publicUrl;
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw this.mapError(error);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw this.mapError(error);
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw this.mapError(error);
  }

  async updateProfile(data: Partial<UserProfile>): Promise<void> {
    const { data: updated, error } = await supabase.auth.updateUser({
      data: { ...this.profile(), ...data },
    });
    if (error) throw this.mapError(error);
    if (updated.user) {
      this._session.update(s => s ? { ...s, user: updated.user! } : s);
    }
  }

  async updateEmail(newEmail: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw this.mapError(error);
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw this.mapError(error);
  }

  private mapError(error: AuthError): Error {
    const messages: Record<string, string> = {
      'Invalid login credentials':                              'Email ou senha incorretos.',
      'Email not confirmed':                                    'Confirme seu email antes de entrar.',
      'User already registered':                                'Este email já está cadastrado.',
      'Password should be at least 6 characters':               'A senha deve ter ao menos 6 caracteres.',
      'New password should be different from the old password': 'A nova senha deve ser diferente da atual.',
      'Email rate limit exceeded':                              'Muitas tentativas. Aguarde alguns minutos.',
    };
    return new Error(messages[error.message] ?? error.message);
  }
}
