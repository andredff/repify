import { Injectable, signal, computed, inject, NgZone, effect } from '@angular/core';
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
export class NotificationService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  private _items   = signal<AppNotification[]>([]);
  private _loading = signal(false);
  private _channel: ReturnType<typeof supabase.channel> | null = null;

  readonly items       = this._items.asReadonly();
  readonly loading     = this._loading.asReadonly();
  readonly unreadCount = computed(() => this._items().filter(n => !n.read).length);
  readonly hasUnread   = computed(() => this.unreadCount() > 0);

  constructor() {
    // React to auth state changes via Angular effect
    effect(() => {
      const userId = this.auth.user()?.id;

      if (userId) {
        // User just authenticated (or service initialized while authenticated)
        this.load();
        this._subscribeRealtime(userId);
      } else {
        // User logged out
        this._items.set([]);
        this._unsubscribe();
      }
    });
  }

  async load(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    this._loading.set(true);
    try {
      const res = await this._fetch('/api/notifications?limit=40');
      if (!res.ok) {
        console.warn('[notif] load failed:', res.status, await res.text());
        return;
      }
      const data = await res.json();
      this._items.set(data.notifications ?? []);
    } catch (e) {
      console.error('[notif] load error:', e);
    } finally {
      this._loading.set(false);
    }
  }

  async markAllRead(): Promise<void> {
    try {
      await this._fetch('/api/notifications/read-all', { method: 'POST' });
      this._items.update(items => items.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('[notif] markAllRead error:', e);
    }
  }

  async markRead(id: string): Promise<void> {
    try {
      await this._fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      this._items.update(items =>
        items.map(n => n.id === id ? { ...n, read: true } : n),
      );
    } catch (e) {
      console.error('[notif] markRead error:', e);
    }
  }

  async pushActivity(type: 'workout' | 'walk', postId?: string): Promise<void> {
    try {
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
    } catch (e) {
      console.error('[notif] pushActivity error:', e);
    }
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  private _subscribeRealtime(userId: string): void {
    // Avoid duplicate subscriptions
    if (this._channel) return;

    console.log('[notif] subscribing realtime for user', userId);

    this._channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        payload => {
          console.log('[notif] realtime INSERT received:', payload);
          // Prepend the new notification optimistically from the payload,
          // then refresh to get enriched actor data
          this.zone.run(() => {
            const raw = payload.new as any;
            const optimistic: AppNotification = {
              id:         raw.id,
              type:       raw.type,
              post_id:    raw.post_id ?? null,
              body:       raw.body ?? null,
              read:       false,
              created_at: raw.created_at,
              time_ago:   'agora',
              actor:      null,
            };
            this._items.update(items => [optimistic, ...items]);
            // Then load full enriched version after a short delay
            setTimeout(() => this.load(), 800);
          });
        },
      )
      .subscribe(status => {
        console.log('[notif] realtime status:', status);
      });
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
