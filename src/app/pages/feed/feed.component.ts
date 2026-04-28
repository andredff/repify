import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { CHECKIN_XP, CheckinService } from '../../core/services/checkin.service';
import { PostService } from '../../core/services/post.service';
import { FeedHeaderComponent } from './components/feed-header.component';
import { CheckInCardComponent } from './components/check-in-card.component';
import { WorkoutPostComponent } from './components/workout-post.component';
import { BottomNavComponent } from './components/bottom-nav.component';
import { StoriesBarComponent } from './components/stories-bar.component';
import { NewPostModalComponent } from './components/new-post-modal.component';
import { DailyWorkoutCardComponent } from './components/daily-workout-card.component';
import { SetupWorkoutCardComponent } from './components/setup-workout-card.component';
import { StoredPlan, WorkoutService } from '../../core/services/workout.service';
import { WorkoutPost } from '../../core/models/workout-post.model';
import { DecimalPipe } from '@angular/common';
import { WalkModalComponent } from './components/walk-modal.component';
import { WalkCardComponent } from './components/walk-card.component';
import { WalkService } from '../../core/services/walk.service';
import { RankingService } from '../../core/services/ranking.service';
import { NotificationsPanelComponent } from './components/notifications-panel.component';
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
  action: 'workout' | 'walk' | 'progress';
}

interface XpCarouselSlide {
  id: 'checkin' | 'workout' | 'walk';
  label: string;
  reward: string;
  hint: string;
}

const HOME_RANK_SNAPSHOT_KEY = 'repify_home_rank_snapshot';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
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
  ],
  template: `
    <div class="bg-bg relative">

      <!-- Mobile-only fixed header (hidden on desktop by the component itself) -->
      <app-feed-header [userEmail]="userEmail()" (onOpenNotifications)="showNotifications.set(true)" />

      <!-- Desktop page header (hidden on mobile) -->
      <div class="hidden lg:flex items-center justify-between px-8 py-5 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-40">
        <div>
          <h1 class="text-[22px] font-display font-bold text-white">Feed</h1>
          <p class="text-[12px] font-body text-text-2 mt-0.5">O que a comunidade está treinando</p>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="showNotifications.set(true)"
                  class="relative w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-primary hover:border-primary/50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <button (click)="showNewPost.set(true)"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-bg font-body text-[13px] font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-glow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo post
          </button>
        </div>
      </div>

      <!-- ─── MOBILE layout (< lg) ──────────────────────────────── -->
      <div class="lg:hidden fixed inset-0 flex flex-col bg-bg" style="z-index: 10">

        <main #mainScroll class="flex-1 overflow-y-auto pb-24" style="padding-top: calc(64px + env(safe-area-inset-top))">

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

          <ng-container *ngTemplateOutlet="feedContent" />

        </main>

        <app-bottom-nav [active]="'feed'" (onNewPost)="showNewPost.set(true)" />
      </div>

      <!-- ─── DESKTOP layout (≥ lg) ──────────────────────────────── -->
      <div class="hidden lg:flex items-start gap-8 px-8 xl:px-12 pt-8 max-w-[1200px] mx-auto pb-12 min-h-screen">

        <!-- Main feed column -->
        <div class="flex-1 min-w-0 max-w-[640px] xl:max-w-[700px]">
          <ng-container *ngTemplateOutlet="feedContent" />
        </div>

        <!-- Right rail -->
        <aside class="flex flex-col w-[280px] xl:w-[300px] shrink-0 gap-4 pb-8">

          <!-- Rank card -->
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

          <!-- Daily XP summary -->
          <div class="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p class="text-[10px] font-body uppercase tracking-[0.2em] text-text-2">XP de Hoje</p>
            <div class="flex items-baseline gap-2">
              <span class="text-[28px] font-display font-bold text-white">{{ dailyXp() }}</span>
              <span class="text-[12px] font-body text-text-2">XP</span>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-[12px] font-body"
                   [class]="checkin.todayChecked() ? 'text-text-2' : 'text-border-2'">
                <span [class]="checkin.todayChecked() ? 'text-primary' : 'text-border'">
                  {{ checkin.todayChecked() ? '✓' : '○' }}
                </span>
                Check-in diário +{{ CHECKIN_XP }} XP
              </div>
              <div class="flex items-center gap-2 text-[12px] font-body"
                   [class]="workoutService.todayFinished() ? 'text-text-2' : 'text-border-2'">
                <span [class]="workoutService.todayFinished() ? 'text-primary' : 'text-border'">
                  {{ workoutService.todayFinished() ? '✓' : '○' }}
                </span>
                Treino do dia +70 XP
              </div>
              <div class="flex items-center gap-2 text-[12px] font-body"
                   [class]="todayWalkDone() ? 'text-text-2' : 'text-border-2'">
                <span [class]="todayWalkDone() ? 'text-primary' : 'text-border'">
                  {{ todayWalkDone() ? '✓' : '○' }}
                </span>
                Caminhada +5 XP
              </div>
            </div>
          </div>

          <!-- Streak & meta anual -->
          @if (currentStreak() > 0 || auth.profile().yearly_goal) {
            <div class="bg-card border border-border rounded-2xl p-4 space-y-3">
              @if (currentStreak() > 0) {
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <span class="text-[18px]">🔥</span>
                  </div>
                  <div>
                    <p class="text-[16px] font-display font-bold text-white">{{ currentStreak() }} dias</p>
                    <p class="text-[11px] font-body text-text-2">sequência ativa</p>
                  </div>
                </div>
              }
              @if (auth.profile().yearly_goal) {
                <div class="space-y-1.5">
                  <div class="flex justify-between items-center">
                    <span class="text-[11px] font-body text-text-2">Meta anual</span>
                    <span class="text-[11px] font-mono font-semibold text-primary">
                      {{ workoutsDone() }}/{{ auth.profile().yearly_goal }}
                    </span>
                  </div>
                  <div class="h-1.5 bg-border rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full transition-all duration-500"
                         [style.width]="yearlyGoalPct() + '%'"></div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Quick nav links -->
          <div class="bg-card border border-border rounded-2xl p-3 space-y-1">
            <button (click)="router.navigateByUrl('/ranking')"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-body text-text-2 hover:text-white hover:bg-card-2 transition-all text-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h3"/>
                <path d="M16 21h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/>
                <rect x="8" y="8" width="8" height="13" rx="1"/>
              </svg>
              Ver ranking completo
            </button>
            <button (click)="router.navigateByUrl('/progress')"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-body text-text-2 hover:text-white hover:bg-card-2 transition-all text-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-3"/>
              </svg>
              Meu progresso
            </button>
            <button (click)="router.navigateByUrl('/my-workout')"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-body text-text-2 hover:text-white hover:bg-card-2 transition-all text-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
              Meu treino
            </button>
          </div>
        </aside>
      </div>

      <!-- ─── Overlays (all layouts) ─────────────────────────── -->

      @if (showNewPost()) {
        <app-new-post-modal (onClose)="showNewPost.set(false)" (onPublish)="addPost($event)" />
      }

      <!-- Floating walk bar -->
      @if (walkSvc.isActive() && !showWalk()) {
        <div (click)="showWalk.set(true)"
             class="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl
                    border border-primary/40 bg-bg/90 backdrop-blur-md shadow-glow cursor-pointer
                    active:scale-95 transition-all"
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

    <!-- ─── Shared feed content template ──────────────────────────── -->
    <ng-template #feedContent>

      <app-stories-bar />

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

      <!-- Rank card (mobile only — desktop shows in right rail) -->
      <div class="px-4 mt-4 animate-slide-up lg:hidden" style="animation-delay:0.03s">
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

      <!-- XP Carousel -->
      <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.02s">
        <div class="mb-3 flex items-end justify-between gap-3 px-1">
          <div class="min-w-0">
            <p class="text-[10px] font-body uppercase tracking-[0.22em] text-primary/75">Rotas de XP</p>
            <p class="mt-1 text-[14px] font-display font-bold tracking-tight text-white">{{ currentXpCarouselSlide().label }}</p>
            <p class="mt-1 text-[11px] font-body text-text-2">{{ currentXpCarouselSlide().hint }}</p>
          </div>
          <span class="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-body font-semibold text-primary">
            {{ currentXpCarouselSlide().reward }}
          </span>
        </div>

        <div class="overflow-hidden rounded-[30px]">
          <div class="flex transition-transform duration-500 ease-out"
               [style.width.%]="xpCarouselSlides().length * 100"
               [style.transform]="'translateX(-' + (xpCarouselIndexClamped() * (100 / xpCarouselSlides().length)) + '%)'">
            @for (slide of xpCarouselSlides(); track slide.id) {
              <div class="shrink-0" [style.width.%]="100 / xpCarouselSlides().length">
                @if (slide.id === 'checkin') {
                  <app-check-in-card (onWalk)="showWalk.set(true)" />
                } @else if (slide.id === 'workout') {
                  <app-daily-workout-card
                    [workout]="todayWorkout()!"
                    [state]="todayWorkoutAccess().state"
                    (onStart)="startWorkout($event)" />
                } @else {
                  <app-walk-card (onStart)="showWalk.set(true)" />
                }
              </div>
            }
          </div>
        </div>

        @if (xpCarouselSlides().length > 1) {
          <div class="mt-3 flex items-center justify-center gap-2">
            @for (slide of xpCarouselSlides(); track slide.id; let i = $index) {
              <button type="button"
                      (click)="setXpCarouselIndex(i)"
                      class="h-2.5 rounded-full transition-all"
                      [attr.aria-label]="'Abrir slide ' + slide.label"
                      [class]="xpCarouselIndexClamped() === i ? 'w-6 bg-primary' : 'w-2.5 bg-border hover:bg-border-2'"></button>
            }
          </div>
        }
      </div>

      @if (!workoutService.hasProgram()) {
        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.1s">
          <app-setup-workout-card (onSetup)="router.navigateByUrl('/my-workout')" />
        </div>
      }

      <!-- Feed posts -->
      <div class="px-4 mt-5 space-y-4">

        @if (loading() && posts().length === 0) {
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
    </ng-template>
  `,
})
export class FeedComponent implements OnInit, AfterViewInit, OnDestroy {
  auth                = inject(AuthService);
  checkin             = inject(CheckinService);
  router              = inject(Router);
  private postService = inject(PostService);
  workoutService      = inject(WorkoutService);
  walkSvc             = inject(WalkService);
  ranking             = inject(RankingService);

  readonly CHECKIN_XP = CHECKIN_XP;

  @ViewChild('mainScroll') private mainScrollRef!: ElementRef<HTMLElement>;

  userEmail      = computed(() => this.auth.user()?.email ?? '');
  workoutsDone   = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));
  currentRank    = computed(() => this.ranking.myRank()?.rank ?? 0);
  currentXp      = computed(() => this.ranking.myRank()?.totalXp ?? 0);
  currentStreak  = computed(() => this.ranking.myRank()?.streakDays ?? 0);
  dailyXp        = computed(() => {
    const today = isoToday();
    const checkinXp = this.checkin.todayChecked() ? CHECKIN_XP : 0;
    const workoutXp = this.workoutService.history()
      .filter(session => session.completedDate === today)
      .reduce((total, session) => total + session.xpEarned, 0);
    const walkXp = this.walkSvc.history().filter(session => session.finishedAt.startsWith(today)).length * 5;
    return checkinXp + workoutXp + walkXp;
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
    const workout = this.todayWorkout();
    const access = this.todayWorkoutAccess();
    const hasWorkoutReady = !!workout && (access.state === 'pending' || access.state === 'in_progress');
    const positions = this.positionsToClimb();
    const xpNeed = this.xpToClimbTarget();

    if (hasWorkoutReady) {
      return {
        title: access.state === 'in_progress' ? 'Volte para o treino' : 'Complete 1 treino',
        description: access.state === 'in_progress'
          ? 'Seu treino de hoje ja esta aberto. Termine agora e feche o dia forte.'
          : 'Seu treino de hoje e o atalho mais forte para subir agora no ranking.',
        reward: '+70 XP estimados',
        impact: positions > 0 ? `até +${positions} posições` : 'segurar a liderança',
        hint: xpNeed > 0 ? `Mais ${xpNeed} XP colocam você na cola de quem está acima.` : 'Um treino agora mantém sua vantagem viva.',
        actionLabel: access.state === 'in_progress' ? 'Continuar treino' : 'Completar agora',
        icon: '🏋️',
        action: 'workout',
      };
    }

    if (this.workoutService.todayFinished()) {
      return {
        title: 'Hoje ja foi vencido',
        description: 'Seu treino do dia esta fechado. Agora o jogo e recuperar, caminhar e voltar amanha.',
        reward: `🔥 ${Math.max(this.currentStreak(), 1)} dias ativos`,
        impact: positions > 0 ? `suba ${positions} posições com consistência` : 'liderança protegida',
        hint: 'Treino bloqueado ate amanha. Use o resto do dia para manter o ritmo e acompanhar seu progresso.',
        actionLabel: 'Ver progresso',
        icon: '🔥',
        action: 'progress',
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
        actionLabel: 'Ver progresso',
      icon: '🔥',
        action: 'progress',
    };
  });
  xpCarouselSlides = computed<XpCarouselSlide[]>(() => {
    const slides: XpCarouselSlide[] = [
      {
        id: 'checkin',
        label: this.checkin.todayChecked() ? 'Check-in do dia fechado' : 'Check-in com XP imediato',
        reward: `+${CHECKIN_XP} XP`,
        hint: this.checkin.todayChecked()
          ? 'O ganho do check-in já contou hoje e o radar mostra esse avanço no XP total.'
          : 'Marque presença para ganhar XP instantâneo e reforçar sua sequência diária.',
      },
    ];

    if (this.todayWorkout()) {
      slides.push({
        id: 'workout',
        label: this.todayWorkoutAccess().state === 'in_progress' ? 'Treino do dia em andamento' : 'Treino do dia valendo XP',
        reward: this.workoutService.todayFinished() ? 'Treino fechado' : '+70 XP estimados',
        hint: this.todayWorkoutAccess().state === 'in_progress'
          ? 'Seu treino já foi iniciado. Volte para concluir e converter esforço em avanço no ranking.'
          : 'O treino de hoje concentra seu maior ganho de XP e mantém a sequência viva.',
      });
    }

    slides.push({
      id: 'walk',
      label: this.walkSvc.isActive() ? 'Finalize a caminhada ativa' : 'Caminhada também soma XP',
      reward: '+5 XP',
      hint: this.walkSvc.isActive()
        ? 'Feche a caminhada para transformar o percurso em XP no ranking.'
        : 'Uma caminhada curta hoje empilha XP leve sem disputar energia do treino.',
    });

    return slides;
  });
  xpCarouselIndex = signal(0);
  xpCarouselIndexClamped = computed(() => {
    const slides = this.xpCarouselSlides();
    if (!slides.length) return 0;
    return Math.min(this.xpCarouselIndex(), slides.length - 1);
  });
  currentXpCarouselSlide = computed(() => {
    const slides = this.xpCarouselSlides();
    return slides[this.xpCarouselIndexClamped()] ?? null;
  });
  showNewPost       = signal(false);
  showWalk          = signal(false);
  showNotifications = signal(false);
  previousRankSnapshot = signal<number | null>(null);
  recentRankDelta = signal(0);
  recentXpGain = signal(0);
  todayWorkout = computed(() => this.workoutService.todayWorkout());
  todayWorkoutAccess = computed(() => this.workoutService.getWorkoutAccessState(this.todayWorkout()));

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
  private xpCarouselTimer: ReturnType<typeof setInterval> | null = null;
  private xpFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSeenTotalXp: number | null = null;
  private lastSeenUserId: string | null = null;

  constructor() {
    // Pick up posts published from the desktop shell sidebar
    effect(() => {
      const pending = this.postService.pendingPost();
      if (!pending) return;
      this.posts.update(all => [pending, ...all]);
      this.postService.pendingPost.set(null);
    });

    effect(() => {
      const me = this.ranking.myRank();
      const userId = this.auth.user()?.id;
      if (!me || !userId) return;

      const raw = sessionStorage.getItem(`${HOME_RANK_SNAPSHOT_KEY}:${userId}`);
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

      sessionStorage.setItem(`${HOME_RANK_SNAPSHOT_KEY}:${userId}`, JSON.stringify({ rank: me.rank, totalXp: me.totalXp }));
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
    this.xpCarouselTimer = setInterval(() => {
      const count = this.xpCarouselSlides().length;
      if (count <= 1) return;
      this.xpCarouselIndex.update(index => (index + 1) % count);
    }, 4800);
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
    if (this.xpCarouselTimer) clearInterval(this.xpCarouselTimer);
    if (this.xpFeedbackTimer) clearTimeout(this.xpFeedbackTimer);
  }

  setXpCarouselIndex(index: number): void {
    this.xpCarouselIndex.set(index);
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

  async startWorkout(_id: string): Promise<void> {
    const workout = this.todayWorkout();
    if (!workout) return;

    const access = await this.workoutService.beginWorkout(workout);
    if (!access.canStart) return;

    await this.router.navigateByUrl(`/workout/${workout.id}`);
  }

  handleDailyChallenge(): void {
    if (this.dailyChallenge().action === 'workout') {
      const workout = this.todayWorkout();
      if (workout) {
        void this.startWorkout(workout.id);
        return;
      }
      this.router.navigateByUrl('/my-workout');
      return;
    }

    if (this.dailyChallenge().action === 'progress') {
      this.router.navigateByUrl('/progress');
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
