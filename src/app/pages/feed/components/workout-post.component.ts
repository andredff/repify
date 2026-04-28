import { Component, inject, input, output, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PostService } from '../../../core/services/post.service';
import { CommentsSheetComponent } from './comments-sheet.component';
import { ShareCardComponent } from './share-card.component';

const MUSCLE_ICONS: Record<string, string> = {
  peito:'🫁', costas:'🔙', pernas:'🦵', ombros:'💪',
  biceps:'💪', triceps:'🤜', abdomen:'⚡', full:'🔥',
};

const MUSCLE_COLORS: Record<string, string> = {
  peito:   'from-blue-500/20 to-blue-600/5',
  costas:  'from-purple-500/20 to-purple-600/5',
  pernas:  'from-orange-500/20 to-orange-600/5',
  ombros:  'from-teal-500/20 to-teal-600/5',
  default: 'from-primary/10 to-primary/5',
};

@Component({
  selector: 'app-workout-post',
  standalone: true,
  imports: [CommentsSheetComponent, ShareCardComponent, FormsModule],
  template: `
    <article class="bg-card-2 border border-border rounded-2xl overflow-hidden shadow-card card-hover">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <div class="flex items-center gap-3">
          <div class="relative cursor-pointer" (click)="goToProfile()">
            <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-display font-bold overflow-hidden"
                 [style]="'background: linear-gradient(135deg, #00FF8830, #00C2FF20); border-color: #00FF8840'">
              @if (post().user.avatar) {
                <img [src]="post().user.avatar" alt="avatar" class="w-full h-full object-cover" />
              } @else {
                {{ post().user.name.charAt(0) }}
              }
            </div>
            @if (post().streak) {
              <div class="absolute -bottom-0.5 -right-0.5 bg-bg border border-border rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                🔥
              </div>
            }
          </div>

          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[13px] font-body font-semibold text-white cursor-pointer hover:text-primary transition-colors"
                    (click)="goToProfile()">{{ post().user.name }}</span>
              <span class="text-text-2 text-[10px] select-none">|</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                    [class]="levelClass()">
                {{ post().user.level }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <div class="neon-dot" style="width:5px;height:5px;opacity:0.7"></div>
              <span class="text-[11px] text-text-2 font-body">{{ post().timeAgo }}</span>
              @if (post().streak) {
                <span class="text-[11px] text-text-2 font-body">· 🔥 {{ post().streak }} dias</span>
              }
            </div>
          </div>
        </div>

        <!-- More -->
        <div class="relative">
          <button (click)="toggleMenu()" class="text-text-2 hover:text-white transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          @if (menuOpen()) {
            <div class="fixed inset-0 z-10" (click)="menuOpen.set(false)"></div>

            <div class="absolute right-0 top-7 z-20 bg-card border border-border rounded-xl shadow-card overflow-hidden min-w-[140px] animate-fade-in">
              @if (isOwner()) {
                <button (click)="openEdit()"
                        class="flex items-center gap-2.5 w-full px-4 py-3 text-left text-[13px] font-body text-text-2 hover:bg-card-2 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Editar
                </button>
                <button (click)="confirmDelete()"
                        class="flex items-center gap-2.5 w-full px-4 py-3 text-left text-[13px] font-body text-danger hover:bg-danger/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Apagar post
                </button>
              }
              <button (click)="menuOpen.set(false); showShareCard.set(true)"
                      class="flex items-center gap-2.5 w-full px-4 py-3 text-left text-[13px] font-body text-text-2 hover:bg-card-2 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Compartilhar
              </button>
            </div>
          }

          @if (confirmingDelete()) {
            <div class="fixed inset-0 z-30 flex items-center justify-center px-6" style="background:rgba(8,12,16,0.85)" (click)="confirmingDelete.set(false)">
              <div class="bg-card border border-border rounded-2xl p-6 w-full max-w-[320px] animate-slide-up" (click)="$event.stopPropagation()">
                <h3 class="text-[16px] font-display font-bold text-white mb-1">Apagar post?</h3>
                <p class="text-[13px] font-body text-text-2 mb-5">Essa ação não pode ser desfeita.</p>
                <div class="flex gap-3">
                  <button (click)="confirmingDelete.set(false)"
                          class="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-body font-medium text-text-2 hover:text-white transition-colors">
                    Cancelar
                  </button>
                  <button (click)="onDelete.emit()"
                          class="flex-1 py-2.5 rounded-xl bg-danger/20 border border-danger/30 text-[13px] font-body font-semibold text-danger hover:bg-danger/30 transition-colors">
                    Apagar
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Photo -->
      @if (post().photo) {
        <div class="mx-4 mb-3 rounded-2xl overflow-hidden bg-card">
          <img
            [src]="post().photoMedium || post().photo"
            alt="foto do treino"
            class="w-full h-auto block"
            loading="lazy"
            decoding="async"
          />
        </div>
      }

      <!-- Caption -->
      @if (post().caption) {
        <p class="px-4 pb-3 text-[13px] font-body text-white leading-relaxed whitespace-pre-wrap">{{ post().caption }}</p>
      }

      <!-- Workout tag -->
      @if (post().workout) {
        <div class="mx-4 mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-gradient-to-r border border-border"
             [class]="muscleGradient()">
          <div class="w-8 h-8 rounded-lg bg-bg/50 flex items-center justify-center text-[16px] shrink-0">
            {{ muscleEmoji() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-display font-bold text-white leading-tight truncate">{{ post().workout!.name }}</p>
            <p class="text-[10px] font-body text-text-2 uppercase tracking-widest leading-none mt-0.5">{{ post().workout!.muscleGroup }}</p>
          </div>
          <div class="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 border border-primary/30">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      }

      <!-- Actions footer -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-border">
        <div class="flex items-center gap-5">
          <button
            (click)="handleLike()"
            class="flex items-center gap-1.5 transition-all active:scale-90"
            [class]="localLiked() ? 'text-primary' : 'text-text-2 hover:text-white'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
                 [attr.fill]="localLiked() ? 'currentColor' : 'none'"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 class="transition-transform"
                 [class.scale-125]="localLiked()">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span class="text-[12px] font-body font-medium tabular-nums">{{ localLikesCount() }}</span>
          </button>

          <button (click)="openComments()"
                  class="flex items-center gap-1.5 text-text-2 hover:text-white transition-colors active:scale-90">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="text-[12px] font-body font-medium tabular-nums">{{ localComments() }}</span>
          </button>
        </div>

        <button (click)="showShareCard.set(true)" class="text-text-2 hover:text-white transition-colors active:scale-90 p-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </article>

    @if (showComments()) {
      <app-comments-sheet
        [postId]="post().id"
        (onClose)="showComments.set(false)"
        (onCountChange)="localComments.set($event)" />
    }

    @if (showShareCard()) {
      <app-share-card [post]="post()" (onClose)="showShareCard.set(false)" />
    }

    @if (editing()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center px-5 max-w-[430px] mx-auto"
           style="background:rgba(8,12,16,0.85)" (click)="editing.set(false)">
        <div class="w-full bg-card border border-border rounded-2xl p-5 animate-slide-up" (click)="$event.stopPropagation()">
          <p class="text-[15px] font-display font-bold text-white mb-3">Editar descrição</p>
          <textarea [(ngModel)]="editDraft"
                    rows="4"
                    maxlength="500"
                    placeholder="Descrição do post..."
                    class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[13px] font-body text-white placeholder:text-muted outline-none resize-none focus:border-primary/50 transition-colors leading-relaxed">
          </textarea>
          <p class="text-[10px] text-text-2 text-right mt-1 mb-4">{{ editDraft.length }}/500</p>
          <div class="flex gap-3">
            <button (click)="editing.set(false)"
                    class="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-body text-text-2 hover:text-white transition-colors">
              Cancelar
            </button>
            <button (click)="saveEdit()"
                    [disabled]="editSaving()"
                    class="flex-1 py-2.5 rounded-xl bg-primary text-bg text-[13px] font-body font-semibold shadow-glow-sm active:scale-[0.98] transition-all disabled:opacity-60">
              {{ editSaving() ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class WorkoutPostComponent {
  post     = input.required<WorkoutPost>();
  onLike   = output<void>();
  onDelete = output<void>();

  private router      = inject(Router);
  private auth        = inject(AuthService);
  private permission  = inject(PermissionService);
  private postService = inject(PostService);

  menuOpen         = signal(false);
  confirmingDelete = signal(false);
  showComments     = signal(false);
  showShareCard    = signal(false);
  localComments    = signal(0);
  localLiked       = signal(false);
  localLikesCount  = signal(0);
  editing          = signal(false);
  editSaving       = signal(false);
  editDraft        = '';

  constructor() {
    let lastPostId = '';
    effect(() => {
      const p = this.post();
      if (p.id !== lastPostId) {
        lastPostId = p.id;
        this.localComments.set(p.comments);
        this.localLiked.set(p.liked);
        this.localLikesCount.set(p.likes);
      }
    });
  }

  isOwner = computed(() => {
    const uid = this.auth.user()?.id;
    return !!uid && this.post().user.id === uid;
  });

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    this.menuOpen.set(false);
    this.confirmingDelete.set(true);
  }

  openEdit(): void {
    this.editDraft = this.post().caption ?? '';
    this.menuOpen.set(false);
    this.editing.set(true);
  }

  async saveEdit(): Promise<void> {
    if (this.editSaving()) return;
    this.editSaving.set(true);
    try {
      await this.postService.updateCaption(this.post().id, this.editDraft);
      (this.post() as any).caption = this.editDraft;
      this.editing.set(false);
    } catch { /* silent */ }
    finally { this.editSaving.set(false); }
  }

  goToProfile(): void {
    if (!this.permission.requireAuthenticated('acessar perfis completos')) {
      return;
    }

    const username = this.post().user.username;
    const id       = this.post().user.id;
    if (username) this.router.navigateByUrl(`/u/${username}`);
    else if (id)  this.router.navigateByUrl(`/u/${id}`);
  }

  handleLike(): void {
    if (!this.permission.requireAuthenticated('curtir e comentar')) return;
    const nowLiked = !this.localLiked();
    this.localLiked.set(nowLiked);
    this.localLikesCount.update(v => nowLiked ? v + 1 : v - 1);
    this.onLike.emit();
  }

  openComments(): void {
    if (!this.permission.requireAuthenticated('curtir e comentar')) {
      return;
    }

    this.showComments.set(true);
  }

  muscleEmoji(): string {
    const mg = this.post().workout?.muscleGroup;
    return mg ? (MUSCLE_ICONS[mg] ?? '💪') : '💪';
  }

  muscleGradient(): string {
    const mg = this.post().workout?.muscleGroup;
    return mg ? (MUSCLE_COLORS[mg] ?? MUSCLE_COLORS['default']) : MUSCLE_COLORS['default'];
  }

  levelClass(): string {
    const level = this.post().user.level;
    if (level === 'Elite') return 'bg-primary/15 text-primary border border-primary/30';
    if (level === 'Pro')   return 'bg-secondary/15 text-secondary border border-secondary/30';
    return 'bg-border text-text-2 border border-border-2';
  }
}
