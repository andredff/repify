import { Injectable, inject, signal, computed } from '@angular/core';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { supabase } from '../supabase/supabaseClient';
import { environment } from '../../../environments/environment';

const DEFAULT_YEARLY_GOAL = 320;
const AUTH_STORAGE_KEY = 'repify-auth';
const APP_STORAGE_PREFIX = 'repify_';
const PROFILE_CACHE_KEY = `${APP_STORAGE_PREFIX}profile_cache`;
const PREVIEW_STORAGE_KEY = `${APP_STORAGE_PREFIX}preview_mode`;

export type AuthState = 'guest' | 'auth' | 'preview';

export interface UserProfile {
  full_name: string;
  username: string;
  bio: string;
  weight: number | null;
  height: number | null;
  goal: string;
  avatar_url: string;
  avatar_version: number | null; // unix timestamp — cache-buster for storage URLs
  yearly_goal: number | null;
  weekly_goal_days: number | null;
  weekly_goal_completed_weeks: string[];
  weekly_goal_best_streak: number | null;
  workouts_done: number | null;
}

interface BackendProfileResponse {
  full_name?: string;
  username?: string;
  bio?: string;
  weight?: number | null;
  height?: number | null;
  goal?: string;
  avatar_url?: string;
  yearly_goal?: number | null;
  weekly_goal_days?: number | null;
  weekly_goal_completed_weeks?: string[];
  weekly_goal_best_streak?: number | null;
  workouts_done?: number | null;
}

const AVATAR_BUCKET = 'avatars';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private readonly _session     = signal<Session | null>(null);
  private readonly _initialized = signal(false);
  private readonly _avatarUrl   = signal<string>('');
  private readonly _profileCache = signal<Partial<UserProfile>>({});
  private readonly _profileReady = signal(false);
  private readonly _profileSyncing = signal(false);
  private readonly _previewMode = signal(this.readPreviewMode());
  private syncingProfile = false;
  private signingOutFromUnauthorized = false;
  private lastSessionUserId: string | null = null;

  readonly session         = this._session.asReadonly();
  readonly user            = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly isPreview       = this._previewMode.asReadonly();
  readonly authState       = computed<AuthState>(() => {
    if (this.isAuthenticated()) return 'auth';
    if (this._previewMode()) return 'preview';
    return 'guest';
  });
  readonly initialized     = this._initialized.asReadonly();
  readonly avatarUrl       = this._avatarUrl.asReadonly();
  readonly profileReady    = this._profileReady.asReadonly();
  readonly profileSyncing  = this._profileSyncing.asReadonly();

  readonly profile = computed<UserProfile>(() => {
    const meta = {
      ...(this._session()?.user?.user_metadata ?? {}),
      ...this._profileCache(),
    };
    return {
      full_name:      meta['full_name']      ?? '',
      username:       meta['username']       ?? '',
      bio:            meta['bio']            ?? '',
      weight:         meta['weight']         ?? null,
      height:         meta['height']         ?? null,
      goal:           meta['goal']           ?? '',
      avatar_url:     meta['avatar_url']     ?? '',
      avatar_version: meta['avatar_version'] ?? null,
      yearly_goal:    this.readNumericMeta(meta['yearly_goal'], DEFAULT_YEARLY_GOAL),
      weekly_goal_days: this.readOptionalNumericMeta(meta['weekly_goal_days'], null),
      weekly_goal_completed_weeks: this.readStringArrayMeta(meta['weekly_goal_completed_weeks']),
      weekly_goal_best_streak: this.readOptionalNumericMeta(meta['weekly_goal_best_streak'], 0),
      workouts_done:  this.readNumericMeta(meta['workouts_done'], 0),
    };
  });

  constructor() {
    this.init();
  }

  private init(): void {
    supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (this.lastSessionUserId !== nextUserId) {
        this.clearRepifyStorage({
          preserveAuthSession: true,
          preservePreviewMode: !session && this._previewMode(),
        });
        this._avatarUrl.set('');
      }

      this.lastSessionUserId = nextUserId;
      this._session.set(session);

      if (session) {
        this.setPreviewMode(false);
      }

      const cachedProfile = nextUserId ? this.readCachedProfile(nextUserId) : {};
      this._profileCache.set(cachedProfile);
      this._profileReady.set(!session || Object.keys(cachedProfile).length > 0);

      const meta        = { ...(session?.user?.user_metadata ?? {}), ...cachedProfile };
      const avatarPath  = meta['avatar_url'];
      const version     = meta['avatar_version'] ?? null;

      if (avatarPath) {
        this._resolveAvatarUrl(String(avatarPath), this.readOptionalNumericMeta(version, null));
      } else {
        this._avatarUrl.set('');
      }

      this.ensureProfileDefaults(session?.user?.user_metadata ?? {});

      if (session) {
        void this.refreshProfileFromBackend();
      } else {
        this._profileSyncing.set(false);
        this._profileReady.set(true);
      }

      if (!this._initialized()) {
        this._initialized.set(true);
      }
    });
  }

  private ensureProfileDefaults(meta: Record<string, unknown>): void {
    const missing: Partial<UserProfile> = {};

    if (meta['yearly_goal'] == null) {
      missing.yearly_goal = DEFAULT_YEARLY_GOAL;
    }

    if (!Array.isArray(meta['weekly_goal_completed_weeks'])) {
      missing.weekly_goal_completed_weeks = [];
    }

    if (meta['weekly_goal_best_streak'] == null) {
      missing.weekly_goal_best_streak = 0;
    }

    if (meta['workouts_done'] == null) {
      missing.workouts_done = 0;
    }

    if (!Object.keys(missing).length) {
      return;
    }

    void this.updateProfile(missing);
  }

  private readNumericMeta(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readOptionalNumericMeta(value: unknown, fallback: number | null): number | null {
    if (value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readStringArrayMeta(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }

  async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

    const response = await fetch(`${environment.apiBaseUrl}${path}`, { ...init, headers });
    if (response.status === 401) {
      await this.handleUnauthorizedResponse();
    }

    return response;
  }

  // version = unix timestamp stored in user_metadata — persists across sessions
  private _resolveAvatarUrl(path: string, version: number | null = null): void {
    if (path.startsWith('http')) {
      // External URL (e.g. Google avatar) — append version if we have one
      const url = version ? `${path}?v=${version}` : path;
      this._avatarUrl.set(url);
      return;
    }
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = version ? `${data.publicUrl}?v=${version}` : data.publicUrl;
    this._avatarUrl.set(url);
  }

  /**
   * Upload a new avatar to Supabase Storage and persist the path in user_metadata.
   * Returns the public URL of the uploaded image.
   */
  async uploadAvatar(file: File): Promise<string> {
    const userId = this.user()?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const ext     = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path    = `${userId}/avatar.${ext}`;
    const version = Date.now(); // timestamp used as cache-buster, persisted in metadata

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error('Falha ao enviar imagem: ' + uploadError.message);

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    // Save both path and version — version survives across sessions as cache-buster
    await this.updateProfile({ avatar_url: path, avatar_version: version });

    this._resolveAvatarUrl(path, version);
    return `${publicUrl}?v=${version}`;
  }

  async signInWithGoogle(): Promise<void> {
    this.prepareForAccountSwitch();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${environment.appUrl}/feed`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw this.mapError(error);
  }

  async signUp(email: string, password: string): Promise<void> {
    this.prepareForAccountSwitch();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw this.mapError(error);

    // Se a confirmação de email estiver desativada no painel, o signUp já retorna sessão.
    // Caso ainda esteja exigindo confirmação (sem sessão), fazemos login direto.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw this.mapError(signInError);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.prepareForAccountSwitch();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw this.mapError(error);
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw this.mapError(error);
    this.setPreviewMode(false);
    this.clearRepifyStorage({ preserveAuthSession: false, preservePreviewMode: false });
    this._avatarUrl.set('');
  }

  enterPreviewMode(): void {
    this.setPreviewMode(true);
  }

  exitPreviewMode(): void {
    this.setPreviewMode(false);
  }

  private async handleUnauthorizedResponse(): Promise<void> {
    if (this.signingOutFromUnauthorized || !this.isAuthenticated()) {
      return;
    }

    this.signingOutFromUnauthorized = true;

    try {
      await supabase.auth.signOut();
      this.setPreviewMode(false);
      this.clearRepifyStorage({ preserveAuthSession: false, preservePreviewMode: false });
      this._avatarUrl.set('');
      this._profileCache.set({});
      this._profileReady.set(true);
      this._profileSyncing.set(false);
      await this.router.navigateByUrl('/');
    } finally {
      this.signingOutFromUnauthorized = false;
    }
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

  async refreshProfileFromBackend(): Promise<void> {
    if (this.syncingProfile || !this.user()) return;
    this.syncingProfile = true;
    this._profileSyncing.set(true);
    this._profileReady.set(Object.keys(this._profileCache()).length > 0);

    try {
      const res = await this.apiFetch('/api/profile/me');
      if (!res.ok) return;

      const profile = await res.json() as BackendProfileResponse;
      this.applyProfilePatch({
        full_name: profile.full_name ?? this.profile().full_name,
        username: profile.username ?? this.profile().username,
        bio: profile.bio ?? this.profile().bio,
        weight: profile.weight ?? this.profile().weight,
        height: profile.height ?? this.profile().height,
        goal: profile.goal ?? this.profile().goal,
        avatar_url: profile.avatar_url ?? this.profile().avatar_url,
        yearly_goal: this.readOptionalNumericMeta(profile.yearly_goal, this.profile().yearly_goal),
        weekly_goal_days: this.readOptionalNumericMeta(profile.weekly_goal_days, this.profile().weekly_goal_days),
        weekly_goal_completed_weeks: this.readStringArrayMeta(profile.weekly_goal_completed_weeks ?? this.profile().weekly_goal_completed_weeks),
        weekly_goal_best_streak: this.readOptionalNumericMeta(profile.weekly_goal_best_streak, this.profile().weekly_goal_best_streak),
        workouts_done: this.readOptionalNumericMeta(profile.workouts_done, this.profile().workouts_done),
      });
    } catch {
      // Best effort hydration only.
    } finally {
      this.syncingProfile = false;
      this._profileSyncing.set(false);
      this._profileReady.set(true);
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

  applyProfilePatch(data: Partial<UserProfile>): void {
    this._session.update(session => {
      if (!session) return session;
      return {
        ...session,
        user: {
          ...session.user,
          user_metadata: {
            ...(session.user.user_metadata ?? {}),
            ...data,
          },
        },
      };
    });

    this._profileCache.update(current => ({ ...current, ...data }));
    this.persistCachedProfile();
    this._profileReady.set(true);

    if (data.avatar_url) {
      this._resolveAvatarUrl(data.avatar_url, data.avatar_version ?? this.profile().avatar_version);
    }
  }

  private profileCacheStorageKey(userId: string): string {
    return `${PROFILE_CACHE_KEY}:${userId}`;
  }

  private readCachedProfile(userId: string): Partial<UserProfile> {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(this.profileCacheStorageKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persistCachedProfile(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const userId = this.user()?.id;
    if (!userId) {
      return;
    }

    try {
      localStorage.setItem(this.profileCacheStorageKey(userId), JSON.stringify(this._profileCache()));
    } catch {
      // Ignore storage quota/access failures.
    }
  }

  private prepareForAccountSwitch(): void {
    this.setPreviewMode(false);
    this.clearRepifyStorage({ preserveAuthSession: true, preservePreviewMode: false });
    this._avatarUrl.set('');
  }

  private readPreviewMode(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === 'true';
  }

  private setPreviewMode(enabled: boolean): void {
    this._previewMode.set(enabled);

    if (typeof window === 'undefined') {
      return;
    }

    if (enabled) {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, 'true');
      return;
    }

    window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  }

  private clearRepifyStorage(options: { preserveAuthSession: boolean; preservePreviewMode: boolean }): void {
    if (typeof window === 'undefined') {
      return;
    }

    const localKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (!key.startsWith(APP_STORAGE_PREFIX)) continue;
      if (options.preserveAuthSession && key === AUTH_STORAGE_KEY) continue;
      if (options.preservePreviewMode && key === PREVIEW_STORAGE_KEY) continue;
      localKeys.push(key);
    }

    localKeys.forEach(key => localStorage.removeItem(key));

    const sessionKeys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key) continue;
      if (!key.startsWith(APP_STORAGE_PREFIX)) continue;
      sessionKeys.push(key);
    }

    sessionKeys.forEach(key => sessionStorage.removeItem(key));
  }

  private mapError(error: AuthError): Error {
    const messages: Record<string, string> = {
      'Invalid login credentials':                              'Email ou senha incorretos.',
      'User already registered':                                'Este email já está cadastrado.',
      'Password should be at least 6 characters':               'A senha deve ter ao menos 6 caracteres.',
      'New password should be different from the old password': 'A nova senha deve ser diferente da atual.',
      'Email rate limit exceeded':                              'Muitas tentativas. Aguarde alguns minutos.',
    };
    return new Error(messages[error.message] ?? error.message);
  }
}
