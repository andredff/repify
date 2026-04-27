import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
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
import { SetupWorkoutCardComponent } from './components/setup-workout-card.component';
import { WorkoutService } from '../../core/services/workout.service';
import { WorkoutPost } from '../../core/models/workout-post.model';
import { DecimalPipe } from '@angular/common';
import { WalkModalComponent } from './components/walk-modal.component';
import { WalkCardComponent } from './components/walk-card.component';
import { WalkService } from '../../core/services/walk.service';
import { RankingService } from '../../core/services/ranking.service';
import { NotificationsPanelComponent } from './components/notifications-panel.component';
import { DailyChallengeCardComponent } from './components/daily-challenge-card.component';
import { HomeRankingCardComponent } from './components/home-ranking-card.component';

export type { WorkoutPost };

interface RankSnapshot {
  rank: number;
  totalXp: number;
}

interface DailyChallengeView {
  title: string;
  description: string;
  reward: string;
  impact: string;
  hint: string;
  actionLabel: string;
  icon: string;
  action: 'workout' | 'walk';
}

const HOME_RANK_SNAPSHOT_KEY = 'repify_home_rank_snapshot';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FeedHeaderComponent,
    CheckInCardComponent,
    WorkoutPostComponent,
    BottomNavComponent,
    StoriesBarComponent,
    NewPostModalComponent,
    DailyWorkoutCardComponent,
    SetupWorkoutCardComponent,
    WalkModalComponent,
    WalkCardComponent,
    NotificationsPanelComponent,
    DecimalPipe,
    HomeRankingCardComponent,
    DailyChallengeCardComponent,
  ],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto relative overflow-x-hidden">

      <app-feed-header [userEmail]="userEmail()" (onOpenNotifications)="showNotifications.set(true)" />

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

        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.02s">
          <app-home-ranking-card
            [currentRank]="currentRank()"
            [previousRank]="previousRankSnapshot()"
            [recentDelta]="recentRankDelta()"
            [totalXp]="currentXp()"
            [streakDays]="currentStreak()"
            [positionsToClimb]="positionsToClimb()"
            [xpToClimb]="xpToClimbTarget()"
            [progressPct]="rankProgressPct()"
            [xpDelta]="recentXpGain()"
            (openRanking)="router.navigateByUrl('/ranking')" />
        </div>

        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.04s">
          <app-daily-challenge-card
            [title]="dailyChallenge().title"
            [description]="dailyChallenge().description"
            [reward]="dailyChallenge().reward"
            [impact]="dailyChallenge().impact"
            [hint]="dailyChallenge().hint"
            [actionLabel]="dailyChallenge().actionLabel"
            [icon]="dailyChallenge().icon"
            (action)="handleDailyChallenge()" />
        </div>

        @if (auth.profile().yearly_goal) {
          <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.05s">
            <div class="bg-card-2 border border-border rounded-xl px-4 py-3 space-y-1.5">
              <div class="flex justify-between items-center">
                <span class="text-[11px] font-body text-text-2">Meta anual de treinos</span>
                <span class="text-[11px] font-mono font-semibold text-primary">
                  {{ workoutsDone() }}/{{ auth.profile().yearly_goal }}
                </span>
              </div>
              <div class="h-1.5 bg-border rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500"
                     [style.width]="yearlyGoalPct() + '%'"></div>
              </div>
            </div>
          </div>
        }

        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.07s">
          <app-check-in-card (onWalk)="showWalk.set(true)" />
        </div>

        <div class="px-4 mt-3 animate-slide-up" style="animation-delay:0.09s">
          <app-walk-card (onStart)="showWalk.set(true)" />
        </div>

        @if (!workoutService.hasProgram()) {
          <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.1s">
            <app-setup-workout-card (onSetup)="router.navigateByUrl('/my-workout')" />
          </div>
        }

        @if (todayWorkout()) {
          <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.12s">
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

      <!-- Floating walk bar (visible when a walk is active and modal is closed) -->
      @if (walkSvc.isActive() && !showWalk()) {
        <div (click)="showWalk.set(true)"
             class="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-primary/40 bg-bg/90 backdrop-blur-md shadow-glow cursor-pointer active:scale-95 transition-all"
             style="bottom:calc(72px + env(safe-area-inset-bottom));max-width:390px;width:calc(100% - 32px)">
          <div class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></div>
          <span class="text-[13px] font-display font-bold text-white tracking-tight">🚶 {{ walkSvc.formattedTime() }}</span>
          @if (walkSvc.activeGpsMode() && walkSvc.liveKm() > 0) {
            <span class="text-[12px] font-body text-text-2">· {{ walkSvc.liveKm() | number:'1.1-2' }} km</span>
          }
          @if (walkSvc.activePhase() === 'paused') {
            <span class="text-[11px] font-body text-text-2 italic">pausado</span>
          }
          <span class="ml-auto text-[11px] font-body text-primary">Abrir →</span>
        </div>
      }

      @if (showWalk()) {
        <app-walk-modal (onClose)="showWalk.set(false)" (onPublish)="addPost($event)" />
      }

      @if (showNotifications()) {
        <app-notifications-panel (onClose)="showNotifications.set(false)" />
      }

    </div>
  `,
})
export class FeedComponent implements OnInit, AfterViewInit, OnDestroy {
  auth                = inject(AuthService);
  router              = inject(Router);
  private postService = inject(PostService);
  workoutService      = inject(WorkoutService);
  walkSvc             = inject(WalkService);
  ranking             = inject(RankingService);

  @ViewChild('mainScroll') private mainScrollRef!: ElementRef<HTMLElement>;

  userEmail      = computed(() => this.auth.user()?.email ?? '');
  workoutsDone   = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));
  currentRank    = computed(() => this.ranking.myRank()?.rank ?? 0);
  currentXp      = computed(() => this.ranking.myRank()?.totalXp ?? 0);
  currentStreak  = computed(() => this.ranking.myRank()?.streakDays ?? 0);
  dailyXp        = computed(() => {
    const today = isoToday();
    const workoutXp = this.workoutService.history()
      .filter(session => session.completedAt === today)
      .reduce((total, session) => total + session.xpEarned, 0);
    const walkXp = this.walkSvc.history().filter(session => session.finishedAt.startsWith(today)).length * 5;
    return workoutXp + walkXp;
  });
  todayWalkDone  = computed(() => this.walkSvc.history().some(session => session.finishedAt.startsWith(isoToday())));
  nextRankEntry  = computed(() => {
    const me = this.ranking.myRank();
    if (!me || me.rank <= 1) return null;
    return this.ranking.entries().find(entry => entry.rank === me.rank - 1) ?? this.ranking.entries()[me.rank - 2] ?? null;
  });
  positionsToClimb = computed(() => {
    const me = this.ranking.myRank();
    return me ? Math.min(3, Math.max(me.rank - 1, 0)) : 0;
  });
  xpToNextRank = computed(() => {
    const me = this.ranking.myRank();
    const above = this.nextRankEntry();
    if (!me || !above) return 0;
    return Math.max(above.totalXp - me.totalXp + 1, 0);
  });
  xpToClimbTarget = computed(() => {
    const me = this.ranking.myRank();
    const steps = this.positionsToClimb();
    if (!me || !steps) return 0;
    const targetRank = Math.max(me.rank - steps, 1);
    const target = this.ranking.entries().find(entry => entry.rank === targetRank) ?? this.ranking.entries()[targetRank - 1] ?? null;
    if (!target) return 0;
    return Math.max(target.totalXp - me.totalXp + 1, 0);
  });
  rankProgressPct = computed(() => {
    const me = this.ranking.myRank();
    const above = this.nextRankEntry();
    if (!me || !above) return 100;
    if (above.totalXp <= 0 || me.totalXp >= above.totalXp) return 100;
    return Math.max(4, Math.min(99, Math.round((me.totalXp / above.totalXp) * 100)));
  });
  yearlyGoalPct  = computed(() => {
    const done = this.workoutsDone();
    const goal = Number(this.auth.profile().yearly_goal  ?? 0);
    if (!goal) return 0;
    return Math.min(Math.round((done / goal) * 100), 100);
  });
  dailyChallenge = computed<DailyChallengeView>(() => {
    const hasWorkoutReady = !!this.todayWorkout() && !this.workoutService.todayFinished();
    const positions = this.positionsToClimb();
    const xpNeed = this.xpToClimbTarget();

    if (hasWorkoutReady) {
      return {
        title: 'Complete 1 treino',
        description: 'Seu treino de hoje é o atalho mais forte para subir agora no ranking.',
        reward: '+70 XP estimados',
        impact: positions > 0 ? `até +${positions} posições` : 'segurar a liderança',
        hint: xpNeed > 0 ? `Mais ${xpNeed} XP colocam você na cola de quem está acima.` : 'Um treino agora mantém sua vantagem viva.',
        actionLabel: 'Completar agora',
        icon: '🏋️',
        action: 'workout',
      };
    }

    if (!this.todayWalkDone()) {
      return {
        title: 'Caminhe 2km',
        description: 'Uma caminhada curta hoje mantém seu ritmo e empilha XP com esforço leve.',
        reward: '+5 XP garantidos',
        impact: positions > 0 ? 'pressão sobre o topo' : 'liderança protegida',
        hint: 'Ative a caminhada e transforme um intervalo do dia em avanço no ranking.',
        actionLabel: 'Completar agora',
        icon: '🚶',
        action: 'walk',
      };
    }

    return {
      title: 'Mantenha sua streak',
      description: 'Sua consistência diária já está viva. Feche o dia com mais uma ação para não esfriar.',
      reward: `🔥 ${Math.max(this.currentStreak(), 1)} dias ativos`,
      impact: positions > 0 ? `suba ${positions} posições hoje` : 'continue no topo',
      hint: 'Quem mantém a sequência aparece todos os dias na frente do feed e do ranking.',
      actionLabel: 'Completar agora',
      icon: '🔥',
      action: 'workout',
    };
  });
  showNewPost       = signal(false);
  showWalk          = signal(false);
  showNotifications = signal(false);
  previousRankSnapshot = signal<number | null>(null);
  recentRankDelta = signal(0);
  recentXpGain = signal(0);
  todayWorkout = computed(() => this.workoutService.todayWorkout());

  posts      = signal<WorkoutPost[]>([]);
  loading    = signal(false);
  loadError  = signal('');
  refreshing = signal(false);
  pullHeight = signal(0);
  pullRotation = computed(() => Math.min((this.pullHeight() / 70) * 180, 180));

  private touchStartY  = 0;
  private pulling      = false;
  private pullLocked   = false; // true once we confirmed downward drag from top
  private readonly THRESHOLD = 70;
  private rankingPoll: ReturnType<typeof setInterval> | null = null;
  private xpFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSeenTotalXp: number | null = null;
  private lastSeenUserId: string | null = null;

  constructor() {
    effect(() => {
      const me = this.ranking.myRank();
      const userId = this.auth.user()?.id;
      if (!me || !userId) return;

      const raw = localStorage.getItem(`${HOME_RANK_SNAPSHOT_KEY}:${userId}`);
      if (!raw) {
        this.previousRankSnapshot.set(me.rank);
        this.recentRankDelta.set(0);
      } else {
        try {
          const snapshot = JSON.parse(raw) as RankSnapshot;
          this.previousRankSnapshot.set(snapshot.rank ?? me.rank);
          this.recentRankDelta.set(Math.max((snapshot.rank ?? me.rank) - me.rank, -99));
        } catch {
          this.previousRankSnapshot.set(me.rank);
          this.recentRankDelta.set(0);
        }
      }

      localStorage.setItem(`${HOME_RANK_SNAPSHOT_KEY}:${userId}`, JSON.stringify({ rank: me.rank, totalXp: me.totalXp }));
    });

    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      const totalXp = this.currentXp();

      if (userId !== this.lastSeenUserId) {
        this.lastSeenUserId = userId;
        this.lastSeenTotalXp = totalXp;
        this.recentXpGain.set(0);
        if (this.xpFeedbackTimer) {
          clearTimeout(this.xpFeedbackTimer);
          this.xpFeedbackTimer = null;
        }
        return;
      }

      if (this.lastSeenTotalXp === null) {
        this.lastSeenTotalXp = totalXp;
        return;
      }

      const gainedXp = totalXp - this.lastSeenTotalXp;
      this.lastSeenTotalXp = totalXp;

      if (gainedXp <= 0) return;

      this.recentXpGain.set(gainedXp);
      if (this.xpFeedbackTimer) clearTimeout(this.xpFeedbackTimer);
      this.xpFeedbackTimer = setTimeout(() => this.recentXpGain.set(0), 1800);
    });
  }

  ngOnInit(): void {
    this.loadFeed();
    void this.ranking.load(true);
    this.rankingPoll = setInterval(() => void this.ranking.load(true), 60000);
  }

  ngAfterViewInit(): void {
    const el = this.mainScrollRef.nativeElement;
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    el.addEventListener('touchend',   this.onTouchEnd,   { passive: true });
    el.addEventListener('touchcancel', this.onTouchEnd,  { passive: true });
  }

  ngOnDestroy(): void {
    const el = this.mainScrollRef?.nativeElement;
    if (el) {
      el.removeEventListener('touchstart',  this.onTouchStart);
      el.removeEventListener('touchmove',   this.onTouchMove);
      el.removeEventListener('touchend',    this.onTouchEnd);
      el.removeEventListener('touchcancel', this.onTouchEnd);
    }
    if (this.rankingPoll) clearInterval(this.rankingPoll);
    if (this.xpFeedbackTimer) clearTimeout(this.xpFeedbackTimer);
  }

  private onTouchStart = (e: TouchEvent): void => {
    this.touchStartY = e.touches[0].clientY;
    this.pulling     = false;
    this.pullLocked  = false;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.refreshing()) return;

    const el = this.mainScrollRef.nativeElement;
    const dy = e.touches[0].clientY - this.touchStartY;

    // Only engage pull-to-refresh when scroll is truly at top AND moving down
    if (!this.pullLocked) {
      if (el.scrollTop > 0 || dy <= 0) return; // let native scroll handle it
      this.pullLocked = true;
      this.pulling    = true;
    }

    if (!this.pulling) return;

    // Prevent native scroll only while we own the gesture
    e.preventDefault();
    const height = Math.min(dy * 0.45, this.THRESHOLD + 10);
    this.pullHeight.set(Math.max(0, height));
  };

  private onTouchEnd = (): void => {
    if (!this.pulling) return;
    this.pulling    = false;
    this.pullLocked = false;
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

  handleDailyChallenge(): void {
    if (this.dailyChallenge().action === 'workout') {
      const workout = this.todayWorkout();
      if (workout) {
        this.startWorkout(workout.id);
        return;
      }
      this.router.navigateByUrl('/my-workout');
      return;
    }

    this.showWalk.set(true);
  }

  addPost(post: WorkoutPost): void {
    this.posts.update(current => [post, ...current]);
    this.showNewPost.set(false);
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
