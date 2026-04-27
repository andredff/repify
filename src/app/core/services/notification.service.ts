import { Injectable, signal, computed, inject, NgZone, OnDestroy } from '@angular/core';
import { supabase } from '../supabase/supabaseClient';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'workout' | 'walk';
  post_id: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  time_ago: string;
  actor: { name: string; username: string | null; avatar: string } | null;
}

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  private _items     = signal<AppNotification[]>([]);
  private _loading   = signal(false);
  private _channel:  ReturnType<typeof supabase.channel> | null = null;

  readonly items      = this._items.asReadonly();
  readonly loading    = this._loading.asReadonly();
  readonly unreadCount = computed(() => this._items().filter(n => !n.read).length);
  readonly hasUnread   = computed(() => this.unreadCount() > 0);

  constructor() {
    // Start listening once the user is authenticated
    let wasAuth = false;
    // Use a polling check; signals can't be subscribed to directly outside Angular's reactivity
    const check = setInterval(() => {
      const isAuth = this.auth.isAuthenticated();
      if (isAuth && !wasAuth) {
        wasAuth = true;
        this.load();
        this._subscribeRealtime();
      } else if (!isAuth && wasAuth) {
        wasAuth = false;
        this._items.set([]);
        this._unsubscribe();
      }
    }, 500);
    // Store so we can clear on destroy
    this._initInterval = check;
  }

  private _initInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    if (this._initInterval) clearInterval(this._initInterval);
    this._unsubscribe();
  }

  async load(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    this._loading.set(true);
    try {
      const res = await this._fetch('/api/notifications?limit=40');
      if (!res.ok) return;
      const data = await res.json();
      this._items.set(data.notifications ?? []);
    } catch { /* ignore */ }
    finally { this._loading.set(false); }
  }

  async markAllRead(): Promise<void> {
    await this._fetch('/api/notifications/read-all', { method: 'POST' });
    this._items.update(items => items.map(n => ({ ...n, read: true })));
  }

  async markRead(id: string): Promise<void> {
    await this._fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    this._items.update(items =>
      items.map(n => n.id === id ? { ...n, read: true } : n),
    );
  }

  // Push a workout/walk notification to all followers (fire & forget)
  async pushActivity(type: 'workout' | 'walk', postId?: string): Promise<void> {
    try {
      // Get follower list — we reuse the users API if it exists; otherwise skip
      // For now we push to all other users (simple approach for MVP)
      const res = await this._fetch('/api/users?limit=200');
      if (!res.ok) return;
      const data = await res.json();
      const recipientIds: string[] = (data.users ?? [])
        .map((u: any) => u.id as string)
        .filter((id: string) => id !== this.auth.user()?.id);

      if (recipientIds.length === 0) return;

      await this._fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, recipient_ids: recipientIds, post_id: postId }),
      });
    } catch { /* non-critical */ }
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  private _subscribeRealtime(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    this._channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        payload => {
          this.zone.run(async () => {
            // Fetch the full enriched notification from API
            await this.load();
          });
        },
      )
      .subscribe();
  }

  private _unsubscribe(): void {
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = new Headers(init.headers as HeadersInit);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }
}
