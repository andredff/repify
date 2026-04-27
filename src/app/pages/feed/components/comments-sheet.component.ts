import { Component, inject, input, output, signal, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../../core/supabase/supabaseClient';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

export interface ApiComment {
  id: string;
  body: string;
  time_ago: string;
  created_at: string;
  is_own: boolean;
  user: { id: string; name: string; username: string | null; avatar: string };
}

@Component({
  selector: 'app-comments-sheet',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex flex-col justify-end max-w-[430px] mx-auto"
         (click)="onBackdrop($event)">

      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="onClose.emit()"></div>

      <!-- Sheet -->
      <div class="relative bg-card border-t border-border rounded-t-2xl flex flex-col animate-slide-up"
           style="max-height: 85dvh"
           (click)="$event.stopPropagation()">

        <!-- Handle + header -->
        <div class="flex flex-col items-center pt-3 pb-0 shrink-0">
          <div class="w-10 h-1 bg-border-2 rounded-full mb-3"></div>
          <div class="w-full flex items-center justify-between px-5 pb-3 border-b border-border">
            <p class="text-[14px] font-body font-semibold text-white">
              Comentários <span class="text-text-2 font-normal">({{ comments().length }})</span>
            </p>
            <button (click)="onClose.emit()" class="text-text-2 hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Comments list -->
        <div #listEl class="flex-1 overflow-y-auto px-4 py-3 space-y-4">

          @if (loading()) {
            <div class="flex justify-center py-8">
              <div class="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          } @else if (comments().length === 0) {
            <div class="flex flex-col items-center justify-center py-10 gap-2">
              <div class="text-3xl">💬</div>
              <p class="text-[13px] font-body text-text-2">Seja o primeiro a comentar!</p>
            </div>
          } @else {
            @for (c of comments(); track c.id) {
              <div class="flex gap-3 group">
                <!-- Avatar -->
                <button (click)="goToProfile(c.user)" class="shrink-0">
                  <div class="w-8 h-8 rounded-full border border-border overflow-hidden flex items-center justify-center text-[11px] font-display font-bold bg-gradient-to-br from-primary/20 to-secondary/10">
                    @if (c.user.avatar) {
                      <img [src]="c.user.avatar" class="w-full h-full object-cover" />
                    } @else {
                      {{ c.user.name.charAt(0) }}
                    }
                  </div>
                </button>

                <!-- Bubble -->
                <div class="flex-1 min-w-0">
                  <div class="bg-card-2 border border-border rounded-2xl rounded-tl-sm px-3 py-2">
                    <div class="flex items-baseline gap-2 mb-0.5">
                      <span class="text-[12px] font-body font-semibold text-white">{{ c.user.name }}</span>
                      <span class="text-[10px] text-text-2">{{ c.time_ago }}</span>
                    </div>
                    <p class="text-[13px] font-body text-white/90 leading-relaxed">{{ c.body }}</p>
                  </div>

                  @if (c.is_own) {
                    <button (click)="deleteComment(c)"
                            class="mt-1 ml-1 text-[10px] font-body text-text-2 hover:text-danger transition-colors opacity-0 group-hover:opacity-100">
                      Apagar
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- Input bar -->
        <div class="shrink-0 border-t border-border px-4 py-3 flex items-end gap-3"
             style="padding-bottom: calc(12px + env(safe-area-inset-bottom))">
          <!-- My avatar -->
          <div class="w-8 h-8 rounded-full border border-border overflow-hidden flex items-center justify-center text-[11px] font-display font-bold bg-gradient-to-br from-primary/20 to-secondary/10 shrink-0">
            @if (auth.avatarUrl()) {
              <img [src]="auth.avatarUrl()" class="w-full h-full object-cover" />
            } @else {
              {{ myInitial() }}
            }
          </div>

          <div class="flex-1 flex items-end gap-2 bg-card-2 border border-border rounded-2xl px-3 py-2 focus-within:border-primary/50 transition-colors">
            <textarea #inputEl
                      [(ngModel)]="draft"
                      (keydown.enter)="onEnter($event)"
                      placeholder="Adicionar comentário..."
                      rows="1"
                      maxlength="500"
                      class="flex-1 bg-transparent text-[13px] font-body text-white placeholder:text-muted outline-none resize-none leading-5 max-h-24 overflow-y-auto">
            </textarea>
            <button (click)="submit()"
                    [disabled]="!draft.trim() || submitting()"
                    class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
                    [class]="draft.trim() ? 'bg-primary text-bg' : 'bg-border text-text-2'">
              @if (submitting()) {
                <div class="w-3 h-3 rounded-full border-2 border-bg border-t-transparent animate-spin"></div>
              } @else {
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CommentsSheetComponent implements OnInit {
  postId    = input.required<string>();
  onClose   = output<void>();
  onCountChange = output<number>();

  @ViewChild('listEl') private listEl!: ElementRef<HTMLElement>;
  @ViewChild('inputEl') private inputEl!: ElementRef<HTMLTextAreaElement>;

  auth       = inject(AuthService);
  private router = inject(Router);
  private API    = environment.apiBaseUrl;

  comments   = signal<ApiComment[]>([]);
  loading    = signal(true);
  submitting = signal(false);
  draft      = '';

  myInitial = () => this.auth.profile().full_name?.charAt(0)?.toUpperCase()
                 || this.auth.user()?.email?.charAt(0)?.toUpperCase() || 'U';

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const targetPostId = this.postId(); // snapshot before await
    this.loading.set(true);
    try {
      const res  = await this.apiFetch(`/api/posts/${targetPostId}/comments`);
      if (!res.ok) return;
      const data = await res.json();
      // Only apply if still the same post
      if (targetPostId === this.postId()) {
        this.comments.set(data.comments ?? []);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const body = this.draft.trim();
    if (!body || this.submitting()) return;

    // Snapshot both values synchronously before any await
    const targetPostId = this.postId();
    const sentBody     = body;

    this.submitting.set(true);
    this.draft = ''; // clear immediately — prevents double-submit on fast tap

    try {
      const res = await this.apiFetch(`/api/posts/${targetPostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: sentBody }),
      });
      if (!res.ok) throw new Error();
      const { comment } = await res.json();

      // Guard: only update if sheet is still showing the same post
      if (targetPostId !== this.postId()) return;

      this.comments.update(list => {
        // Deduplicate — realtime may have already inserted it
        if (list.some(c => c.id === comment.id)) return list;
        return [...list, comment];
      });
      this.onCountChange.emit(this.comments().length);
      setTimeout(() => this.scrollToBottom(), 50);
    } catch {
      // Restore draft so user can retry
      if (!this.draft) this.draft = sentBody;
    } finally {
      this.submitting.set(false);
    }
  }

  async deleteComment(c: ApiComment): Promise<void> {
    const res = await this.apiFetch(`/api/posts/${this.postId()}/comments/${c.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      this.comments.update(list => list.filter(x => x.id !== c.id));
      this.onCountChange.emit(this.comments().length);
    }
  }

  onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) { e.preventDefault(); this.submit(); }
  }

  onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.onClose.emit();
  }

  goToProfile(user: ApiComment['user']): void {
    const handle = user.username || user.id;
    this.router.navigateByUrl(`/u/${handle}`);
    this.onClose.emit();
  }

  private scrollToBottom(): void {
    const el = this.listEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${this.API}${path}`, { ...init, headers });
  }
}
