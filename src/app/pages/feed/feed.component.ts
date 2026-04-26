import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PostService } from '../../core/services/post.service';
import { FeedHeaderComponent } from './components/feed-header.component';
import { CheckInCardComponent } from './components/check-in-card.component';
import { WorkoutPostComponent } from './components/workout-post.component';
import { BottomNavComponent } from './components/bottom-nav.component';
import { StoriesBarComponent } from './components/stories-bar.component';
import { NewPostModalComponent } from './components/new-post-modal.component';
import { DailyWorkoutCardComponent } from './components/daily-workout-card.component';
import { WorkoutService } from '../../core/services/workout.service';
import { WorkoutPost } from '../../core/models/workout-post.model';

export type { WorkoutPost };

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    FeedHeaderComponent,
    CheckInCardComponent,
    WorkoutPostComponent,
    BottomNavComponent,
    StoriesBarComponent,
    NewPostModalComponent,
    DailyWorkoutCardComponent,
  ],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto relative overflow-x-hidden">

      <app-feed-header [userEmail]="userEmail()" (onLogout)="logout()" />

      <main #mainScroll class="flex-1 overflow-y-auto pb-24 pt-[64px]" style="padding-top: calc(64px + env(safe-area-inset-top))">

        <!-- Pull to refresh indicator -->
        <div class="overflow-hidden transition-all duration-200 ease-out"
             [style.height.px]="pullHeight()">
          <div class="flex items-center justify-center h-14"
               [class.opacity-0]="pullHeight() < 20"
               [class.opacity-100]="pullHeight() >= 20">
            @if (refreshing()) {
              <div class="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            } @else {
              <svg class="transition-transform duration-200"
                   [style.transform]="'rotate(' + pullRotation() + 'deg)'"
                   width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="#00FF88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
            }
          </div>
        </div>

        <app-stories-bar />

        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.05s">
          <app-check-in-card [checkedIn]="checkedIn()" (onCheckIn)="doCheckIn()" />
        </div>

        @if (todayWorkout()) {
          <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.1s">
            <app-daily-workout-card
              [workout]="todayWorkout()!"
              [finished]="workoutService.todayFinished()"
              (onStart)="startWorkout($event)" />
          </div>
        }

        <!-- Feed posts -->
        <div class="px-4 mt-5 space-y-4">

          @if (loading() && posts().length === 0) {
            <!-- Skeleton -->
            <div class="bg-card-2 border border-border rounded-2xl p-4 animate-pulse space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-card"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 w-24 bg-card rounded-lg"></div>
                  <div class="h-2.5 w-16 bg-card rounded-lg"></div>
                </div>
              </div>
              <div class="aspect-video bg-card rounded-xl"></div>
            </div>
          }

          @for (post of posts(); track post.id; let i = $index) {
            <div class="animate-slide-up" [style.animation-delay]="(0.1 + i * 0.07) + 's'">
              <app-workout-post [post]="post" (onLike)="toggleLike(post.id)" (onDelete)="deletePost(post)" />
            </div>
          }

          @if (!loading() && posts().length === 0) {
            <div class="bg-card-2 border border-border rounded-2xl p-8 text-center">
              <p class="text-[32px] mb-2">📭</p>
              <p class="text-[14px] font-body font-semibold text-white mb-1">Nenhum post ainda</p>
              <p class="text-[12px] font-body text-text-2">Seja o primeiro a publicar!</p>
            </div>
          }

          @if (loadError()) {
            <div class="bg-danger/10 border border-danger/30 rounded-xl p-3 text-center">
              <p class="text-[12px] font-body text-danger">{{ loadError() }}</p>
              <button (click)="loadFeed()" class="mt-2 text-[12px] font-body text-primary underline">Tentar novamente</button>
            </div>
          }
        </div>

        <div class="h-8"></div>
      </main>

      <app-bottom-nav [active]="'feed'" (onNewPost)="showNewPost.set(true)" />

      @if (showNewPost()) {
        <app-new-post-modal (onClose)="showNewPost.set(false)" (onPublish)="addPost($event)" />
      }

    </div>
  `,
})
export class FeedComponent implements OnInit, AfterViewInit, OnDestroy {
  private auth        = inject(AuthService);
  private router      = inject(Router);
  private postService = inject(PostService);
  workoutService      = inject(WorkoutService);

  @ViewChild('mainScroll') private mainScrollRef!: ElementRef<HTMLElement>;

  userEmail    = computed(() => this.auth.user()?.email ?? '');
  checkedIn    = signal(false);
  showNewPost  = signal(false);
  todayWorkout = computed(() => this.workoutService.todayWorkout());

  posts      = signal<WorkoutPost[]>([]);
  loading    = signal(false);
  loadError  = signal('');
  refreshing = signal(false);
  pullHeight = signal(0);
  pullRotation = computed(() => Math.min((this.pullHeight() / 70) * 180, 180));

  private touchStartY = 0;
  private pulling     = false;
  private readonly THRESHOLD = 70;

  ngOnInit(): void {
    this.loadFeed();
  }

  ngAfterViewInit(): void {
    const el = this.mainScrollRef.nativeElement;
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    el.addEventListener('touchend',   this.onTouchEnd,   { passive: true });
  }

  ngOnDestroy(): void {
    const el = this.mainScrollRef?.nativeElement;
    if (!el) return;
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove',  this.onTouchMove);
    el.removeEventListener('touchend',   this.onTouchEnd);
  }

  private onTouchStart = (e: TouchEvent): void => {
    const el = this.mainScrollRef.nativeElement;
    if (el.scrollTop === 0) {
      this.touchStartY = e.touches[0].clientY;
      this.pulling = true;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.pulling || this.refreshing()) return;
    const dy = e.touches[0].clientY - this.touchStartY;
    if (dy <= 0) { this.pulling = false; return; }
    e.preventDefault();
    // resistance curve: slows down after threshold
    const height = Math.min(dy * 0.45, this.THRESHOLD + 10);
    this.pullHeight.set(height);
  };

  private onTouchEnd = (): void => {
    if (!this.pulling) return;
    this.pulling = false;
    if (this.pullHeight() >= this.THRESHOLD) {
      this.triggerRefresh();
    } else {
      this.pullHeight.set(0);
    }
  };

  private async triggerRefresh(): Promise<void> {
    this.refreshing.set(true);
    this.pullHeight.set(56);
    await this.loadFeed();
    this.refreshing.set(false);
    this.pullHeight.set(0);
  }

  async loadFeed(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const data = await this.postService.listFeed();
      this.posts.set(data);
    } catch (err: any) {
      this.loadError.set(err?.message ?? 'Não foi possível carregar o feed.');
    } finally {
      this.loading.set(false);
    }
  }

  async deletePost(post: WorkoutPost): Promise<void> {
    const previous = this.posts();
    this.posts.update(all => all.filter(p => p.id !== post.id));
    try {
      await this.postService.deletePost(post.id);
    } catch {
      this.posts.set(previous);
    }
  }

  startWorkout(id: string): void {
    this.router.navigateByUrl(`/workout/${id}`);
  }

  addPost(post: WorkoutPost): void {
    this.posts.update(current => [post, ...current]);
    this.showNewPost.set(false);
  }

  doCheckIn(): void {
    this.checkedIn.set(true);
  }

  async toggleLike(postId: string): Promise<void> {
    // Optimistic toggle
    this.posts.update(posts =>
      posts.map(p =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );

    try {
      await this.postService.toggleLike(postId);
    } catch {
      // Revert on error
      this.posts.update(posts =>
        posts.map(p =>
          p.id === postId
            ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
            : p,
        ),
      );
    }
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/');
  }
}
