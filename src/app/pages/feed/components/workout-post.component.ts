import { Component, inject, input, output, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PostLikeUser, PostService } from '../../../core/services/post.service';
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
      @if (postPhotos().length > 0) {
        <div class="mx-4 mb-3 overflow-hidden rounded-2xl bg-card">
          <div class="relative">
            <div class="flex transition-transform duration-300 ease-out"
                 [style.transform]="'translateX(-' + (activePhotoIndex() * 100) + '%)'">
              @for (photo of postPhotos(); track photo.full) {
                <div class="w-full shrink-0">
                  <img
                    [src]="photo.medium || photo.full"
                    alt="foto do treino"
                    class="block h-auto w-full"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              }
            </div>

            @if (postPhotos().length > 1) {
              <div class="pointer-events-none absolute inset-x-0 top-3 flex items-start justify-between px-3">
                <span class="rounded-full border border-white/10 bg-bg/72 px-2.5 py-1 text-[10px] font-mono text-white/80 backdrop-blur-sm">
                  {{ activePhotoIndex() + 1 }}/{{ postPhotos().length }}
                </span>
                <div class="pointer-events-auto flex gap-2">
                  <button type="button"
                          (click)="previousPhoto()"
                          class="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-bg/72 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                          aria-label="Foto anterior">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <button type="button"
                          (click)="nextPhoto()"
                          class="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-bg/72 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                          aria-label="Próxima foto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 px-3">
                @for (photo of postPhotos(); track photo.full; let index = $index) {
                  <button type="button"
                          (click)="goToPhoto(index)"
                          class="h-2 rounded-full transition-all"
                          [class]="activePhotoIndex() === index ? 'w-5 bg-primary' : 'w-2 bg-white/28'"
                          [attr.aria-label]="'Ir para foto ' + (index + 1)">
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Caption -->
      @if (post().caption) {
        <p class="px-4 pb-3 text-[13px] font-body text-white leading-relaxed whitespace-pre-wrap">{{ post().caption }}</p>
      }

      <!-- Workout tag -->
      @if (post().workout) {
        <div class="mx-4 mb-3 overflow-hidden rounded-[20px] border border-white/8 bg-gradient-to-r p-3 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
             [class]="muscleGradient()">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-bg/45 text-[18px]">
              {{ muscleEmoji() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="rounded-full border border-primary/18 bg-primary/12 px-2 py-0.5 text-[9px] font-body font-semibold uppercase tracking-[0.12em] text-primary">Treino concluído</span>
              </div>
              <p class="mt-2 truncate text-[15px] font-display font-bold leading-tight text-white">{{ post().workout!.name }}</p>
              <p class="mt-1 text-[10px] font-body uppercase tracking-[0.18em] text-text-2">{{ post().workout!.muscleGroup }}</p>
              <p class="mt-2 text-[11px] font-body leading-relaxed text-white/72">Sessão registrada no feed com foco em {{ post().workout!.muscleGroup }}.</p>
            </div>
            <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/24 bg-primary/14">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
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

      @if (likesSummary()) {
        <div class="px-4 pb-3 -mt-1">
          <div
            class="inline-flex select-none items-center gap-1 rounded-full border border-white/6 bg-white/[0.02] px-2.5 py-1 text-[10px] font-body text-text-2/90 transition-colors hover:text-white"
            role="button"
            tabindex="0"
            aria-label="Segure para ver quem curtiu"
            (pointerdown)="startLikesPress()"
            (pointerup)="cancelLikesPress()"
            (pointerleave)="cancelLikesPress()"
            (pointercancel)="cancelLikesPress()"
            (contextmenu)="openLikesSheetFromContext($event)"
            (keydown.enter)="openLikesSheet()"
            (keydown.space)="openLikesSheetFromKeyboard($event)">
            <span class="h-1 w-1 rounded-full bg-primary/70"></span>
            <span>{{ likesSummary() }}</span>
          </div>
        </div>
      }
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

    @if (showLikesSheet()) {
      <div class="fixed inset-0 z-[65] flex items-end justify-center bg-[rgba(8,12,16,0.82)] px-4" (click)="showLikesSheet.set(false)">
        <div class="mb-4 w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/8 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.38)] animate-slide-up" (click)="$event.stopPropagation()">
          <div class="border-b border-border px-4 py-3">
            <p class="text-[14px] font-display font-bold text-white">Curtidas</p>
            <p class="mt-0.5 text-[11px] font-body text-text-2">Quem passou por aqui</p>
          </div>

          @if (likesLoading()) {
            <div class="px-4 py-5 text-[12px] font-body text-text-2">Carregando curtidas...</div>
          } @else if (likesError()) {
            <div class="px-4 py-5 text-[12px] font-body text-danger">{{ likesError() }}</div>
          } @else if (likeUsers().length === 0) {
            <div class="px-4 py-5 text-[12px] font-body text-text-2">Ninguem curtiu ainda.</div>
          } @else {
            <div class="max-h-[52vh] overflow-y-auto px-2 py-2">
              @for (user of likeUsers(); track user.id) {
                <div class="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/[0.03]">
                  <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-primary/20 to-secondary/10 text-[13px] font-display font-bold text-white">
                    @if (user.avatar) {
                      <img [src]="user.avatar" [alt]="user.name" class="h-full w-full object-cover" />
                    } @else {
                      {{ user.name.charAt(0) }}
                    }
                  </div>

                  <div class="min-w-0">
                    <p class="truncate text-[13px] font-body font-semibold text-white">{{ user.name }}</p>
                    @if (user.username) {
                      <p class="truncate text-[11px] font-body text-text-2">@{{ user.username }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          }
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
  localLikePreviewName = signal('');
  editing          = signal(false);
  editSaving       = signal(false);
  editDraft        = '';
  showLikesSheet   = signal(false);
  likesLoading     = signal(false);
  likesError       = signal('');
  likeUsers        = signal<PostLikeUser[]>([]);
  activePhotoIndex = signal(0);
  private likesPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    let lastPostId = '';
    effect(() => {
      const p = this.post();
      if (p.id !== lastPostId) {
        lastPostId = p.id;
        this.localComments.set(p.comments);
        this.localLiked.set(p.liked);
        this.localLikesCount.set(p.likes);
        this.localLikePreviewName.set(p.likedByPreviewName ?? '');
        this.likeUsers.set([]);
        this.likesError.set('');
        this.likesLoading.set(false);
        this.showLikesSheet.set(false);
        this.activePhotoIndex.set(0);
      }
    });
  }

  postPhotos = computed(() => {
    const photos = this.post().photos ?? [];
    if (photos.length > 0) {
      return photos;
    }

    if (!this.post().photo) {
      return [];
    }

    return [{
      full: this.post().photo,
      medium: this.post().photoMedium,
      thumb: this.post().photoThumb,
    }];
  });

  likesSummary = computed(() => {
    const name = this.localLikePreviewName().trim();
    const count = this.localLikesCount();
    if (!name || count <= 0) return '';

    const firstName = this.firstName(name);
    return count === 1 ? `${firstName} curtiu` : `${firstName} e mais ${count - 1}`;
  });

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
    if (nowLiked && !this.localLikePreviewName()) {
      this.localLikePreviewName.set(this.currentUserFirstName());
    }
    if (!nowLiked && this.localLikesCount() <= 0) {
      this.localLikePreviewName.set('');
    }
    this.onLike.emit();
  }

  startLikesPress(): void {
    if (!this.likesSummary()) return;
    this.cancelLikesPress();
    this.likesPressTimer = setTimeout(() => {
      this.likesPressTimer = null;
      void this.openLikesSheet();
    }, 420);
  }

  cancelLikesPress(): void {
    if (!this.likesPressTimer) return;
    clearTimeout(this.likesPressTimer);
    this.likesPressTimer = null;
  }

  openLikesSheetFromContext(event: Event): void {
    event.preventDefault();
    this.cancelLikesPress();
    void this.openLikesSheet();
  }

  openLikesSheetFromKeyboard(event: Event): void {
    event.preventDefault();
    void this.openLikesSheet();
  }

  async openLikesSheet(): Promise<void> {
    this.cancelLikesPress();
    if (!this.permission.requireAuthenticated('ver quem curtiu')) return;

    this.showLikesSheet.set(true);
    this.likesError.set('');

    if (this.likeUsers().length > 0 || this.likesLoading()) return;

    this.likesLoading.set(true);
    try {
      this.likeUsers.set(await this.postService.getLikes(this.post().id));
    } catch {
      this.likesError.set('Nao foi possivel carregar as curtidas.');
    } finally {
      this.likesLoading.set(false);
    }
  }

  openComments(): void {
    if (!this.permission.requireAuthenticated('curtir e comentar')) {
      return;
    }

    this.showComments.set(true);
  }

  previousPhoto(): void {
    const total = this.postPhotos().length;
    if (total <= 1) return;
    this.activePhotoIndex.update(index => (index - 1 + total) % total);
  }

  nextPhoto(): void {
    const total = this.postPhotos().length;
    if (total <= 1) return;
    this.activePhotoIndex.update(index => (index + 1) % total);
  }

  goToPhoto(index: number): void {
    if (index < 0 || index >= this.postPhotos().length) return;
    this.activePhotoIndex.set(index);
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

  private currentUserFirstName(): string {
    const fullName = this.auth.profile().full_name?.trim();
    if (fullName) return this.firstName(fullName);

    const email = this.auth.user()?.email?.split('@')[0] ?? 'Voce';
    return this.firstName(email);
  }

  private firstName(value: string): string {
    return value.trim().split(/\s+/)[0] || value;
  }
}
