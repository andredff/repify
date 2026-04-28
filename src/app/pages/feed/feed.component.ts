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
import { NewPostModalComponent, WorkoutPostPrefillSummary } from './components/new-post-modal.component';
import { DailyWorkoutCardComponent } from './components/daily-workout-card.component';
import { SetupWorkoutCardComponent } from './components/setup-workout-card.component';
import { StoredPlan, WorkoutService, WorkoutSession } from '../../core/services/workout.service';
import { WorkoutPost } from '../../core/models/workout-post.model';
import { DecimalPipe } from '@angular/common';
import { WalkModalComponent } from './components/walk-modal.component';
import { WalkCardComponent } from './components/walk-card.component';
import { WalkService } from '../../core/services/walk.service';
import { RankingService } from '../../core/services/ranking.service';
import { NotificationsPanelComponent } from './components/notifications-panel.component';
import { HomeRankingCardComponent } from './components/home-ranking-card.component';
import { WeeklyGoalCardComponent } from './components/weekly-goal-card.component';
import { PermissionService } from '../../core/services/permission.service';

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

interface ProfileCompletionAction {
  id: 'avatar' | 'full_name' | 'username' | 'bio';
  label: string;
}

interface PreviewActionCard {
  kicker: string;
  title: string;
  description: string;
  cta: string;
  reason: string;
  accentClass: string;
}

interface OnboardingActionCard {
  id: 'profile' | 'program' | 'weekly-goal' | 'first-workout' | 'first-post';
  kicker: string;
  title: string;
  description: string;
  reward: string;
  cta: string;
  accentClass: string;
}

const HOME_RANK_SNAPSHOT_KEY = 'repify_home_rank_snapshot';
const FEED_PAGE_SIZE = 20;

const PREVIEW_ACTION_CARDS: PreviewActionCard[] = [
  {
    kicker: 'Liberar treino',
    title: 'Comece um treino hoje e entre no jogo de verdade.',
    description: 'Monte sua rotina, registre execução e transforme esforço em XP, streak e posição no ranking.',
    cta: 'Iniciar meu treino',
    reason: 'montar e iniciar treinos',
    accentClass: 'from-primary/30 via-primary/10 to-transparent',
  },
  {
    kicker: 'Criar plano',
    title: 'Desenhe seu programa e pare de só assistir os outros.',
    description: 'Organize dias, grupos musculares e evolução semanal para o app trabalhar a seu favor.',
    cta: 'Criar meu treino',
    reason: 'criar seu treino',
    accentClass: 'from-[#00C2FF]/25 via-[#00C2FF]/8 to-transparent',
  },
  {
    kicker: 'Desafiar amigos',
    title: 'Publique, provoque e force resposta da turma.',
    description: 'No preview você só observa. Com conta, você posta resultado, comenta e puxa rivalidade real.',
    cta: 'Desafiar meus amigos',
    reason: 'desafiar seus amigos',
    accentClass: 'from-[#FF7A00]/25 via-[#FF7A00]/8 to-transparent',
  },
];

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
    WeeklyGoalCardComponent,
  ],
  template: `
    <div class="bg-bg relative">

      <!-- Mobile-only fixed header (hidden on desktop by the component itself) -->
      <app-feed-header
        [userEmail]="userEmail()"
        [previewMode]="isPreview()"
        (onOpenNotifications)="openNotificationsPanel()" />

      <!-- Desktop page header (hidden on mobile) -->
      <div class="hidden lg:flex items-center justify-between px-8 py-5 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-40">
        <div>
          <h1 class="text-[22px] font-display font-bold text-white">Feed</h1>
          <p class="text-[12px] font-body text-text-2 mt-0.5">{{ isPreview() ? 'Explore os posts públicos em modo leitura' : 'O que a comunidade está treinando' }}</p>
        </div>
        @if (!isPreview()) {
          <div class="flex items-center gap-3">
            <button (click)="openNotificationsPanel()"
                    class="relative w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-primary hover:border-primary/50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <button (click)="openNewPostPanel()"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-bg font-body text-[13px] font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-glow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Novo post
            </button>
          </div>
        } @else {
          <div class="flex items-center gap-2">
            <a href="/" class="rounded-full border border-border bg-card-2 px-4 py-2 text-[12px] font-body font-semibold text-white transition-colors hover:border-primary/40 hover:text-primary">Entrar</a>
            <a href="/register" class="rounded-full bg-primary px-4 py-2 text-[12px] font-body font-semibold text-bg shadow-glow transition-all hover:bg-primary/90">Criar conta</a>
          </div>
        }
      </div>

      <!-- ─── MOBILE layout (< lg) ──────────────────────────────── -->
      <div class="lg:hidden fixed inset-0 flex flex-col bg-bg" style="z-index: 10">

        <main #mainScroll class="flex-1 overflow-y-auto" [class.pb-24]="!isPreview()" [class.pb-10]="isPreview()" style="padding-top: calc(64px + env(safe-area-inset-top))">

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

        <app-bottom-nav
          [active]="'feed'"
          [previewMode]="isPreview()"
          (onNewPost)="openNewPostPanel()"
          (onFeedTap)="scrollToTop()"
          (onPreviewAction)="openPreviewBlockedAction($event)" />
      </div>

      <!-- ─── DESKTOP layout (≥ lg) ──────────────────────────────── -->
      <div class="hidden lg:flex items-start gap-8 px-8 xl:px-12 pt-8 max-w-[1200px] mx-auto pb-12 min-h-screen">

        <!-- Main feed column -->
        <div class="flex-1 min-w-0 max-w-[640px] xl:max-w-[700px]">
          <ng-container *ngTemplateOutlet="feedContent" />
        </div>

        <!-- Right rail -->
        @if (!showInitialViewLoading() && !isPreview() && !showNewUserOnboarding()) {
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

          @if (weeklyGoal().goalDays > 0) {
          <app-weekly-goal-card
            [goalDays]="weeklyGoal().goalDays"
            [completedDays]="weeklyGoal().completedDays"
            [remainingDays]="weeklyGoal().remainingDays"
            [progressPct]="weeklyGoal().progressPct"
            [rewardXp]="weeklyGoal().rewardXp"
            [isCompleted]="weeklyGoal().isCompleted"
            [isRewardClaimed]="weeklyGoal().isRewardClaimed"
            [currentStreak]="weeklyGoal().currentStreak"
            [weekLabel]="weeklyGoal().weekLabel"
            [statusLabel]="weeklyGoal().statusLabel" />
          }

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

          <!-- Streak -->
          @if (currentStreak() > 0) {
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
        }
      </div>

      <!-- ─── Overlays (all layouts) ─────────────────────────── -->

      @if (showNewPost()) {
        <app-new-post-modal
          [title]="newPostTitle()"
          [prefillCaption]="newPostCaption()"
          [prefillWorkout]="newPostWorkout()"
          [prefillSummary]="newPostSummary()"
          (onClose)="closeNewPostPanel()"
          (onPublish)="addPost($event)" />
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

      @if (showInitialViewLoading()) {
        <div class="px-4 mt-4 space-y-4 animate-fade-in">
          <section class="overflow-hidden rounded-[30px] border border-border bg-card-2 p-5">
            <div class="flex items-center gap-3">
              <div class="h-11 w-11 rounded-2xl bg-card animate-pulse"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 w-28 rounded-full bg-card animate-pulse"></div>
                <div class="h-2.5 w-48 rounded-full bg-card animate-pulse"></div>
              </div>
            </div>
            <div class="mt-5 space-y-3">
              <div class="h-5 w-40 rounded-full bg-card animate-pulse"></div>
              <div class="h-3 w-full rounded-full bg-card animate-pulse"></div>
              <div class="h-3 w-5/6 rounded-full bg-card animate-pulse"></div>
            </div>
            <div class="mt-5 grid gap-3">
              <div class="h-16 rounded-[22px] bg-card animate-pulse"></div>
              <div class="h-16 rounded-[22px] bg-card animate-pulse"></div>
            </div>
          </section>

          <section class="rounded-[28px] border border-border bg-card-2 p-4 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="space-y-2">
                <div class="h-3 w-24 rounded-full bg-card animate-pulse"></div>
                <div class="h-2.5 w-40 rounded-full bg-card animate-pulse"></div>
              </div>
              <div class="h-7 w-20 rounded-full bg-card animate-pulse"></div>
            </div>
            <div class="h-[196px] rounded-[24px] bg-card animate-pulse"></div>
          </section>

          <section class="space-y-3">
            <div class="h-24 rounded-[24px] bg-card-2 border border-border animate-pulse"></div>
            <div class="h-24 rounded-[24px] bg-card-2 border border-border animate-pulse"></div>
          </section>
        </div>
      } @else {

      @if (!isPreview()) {
        <app-stories-bar />
      }

      @if (isPreview()) {
        <div class="px-4 mt-4 animate-slide-up space-y-4">
          <section class="overflow-hidden rounded-[30px] border border-primary/20 bg-[linear-gradient(135deg,rgba(0,255,136,0.16),rgba(7,11,15,0.98)_45%,rgba(7,11,15,1)_100%)] shadow-[0_18px_60px_rgba(0,255,136,0.10)]">
            <div class="relative px-5 py-5">
              <div class="absolute right-[-40px] top-[-50px] h-36 w-36 rounded-full blur-3xl" style="background:radial-gradient(circle,rgba(0,255,136,0.28),rgba(0,255,136,0));"></div>
              <div class="absolute left-[55%] top-[30%] h-28 w-28 rounded-full blur-3xl" style="background:radial-gradient(circle,rgba(0,194,255,0.18),rgba(0,194,255,0));"></div>

              <div class="relative z-[1]">
                <div class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-bg/55 px-3 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.26em] text-primary/85">
                  <span class="h-2 w-2 rounded-full bg-primary shadow-glow-sm"></span>
                  Modo preview
                </div>

                <h2 class="mt-4 max-w-[11ch] font-display text-[34px] font-black uppercase leading-[0.92] tracking-[-0.04em] text-white">
                  Veja o feed. Entre para dominar.
                </h2>
                <p class="mt-3 max-w-[32ch] text-[13px] font-body leading-relaxed text-white/78">
                  Você já está dentro da vitrine. Agora falta desbloquear treino, ranking, postagens e rivalidade para virar presença de verdade no app.
                </p>

                <div class="mt-5 flex flex-wrap gap-2">
                  <button type="button"
                          (click)="openPreviewBlockedAction('montar e iniciar treinos')"
                          class="rounded-full bg-primary px-4 py-2.5 text-[12px] font-body font-semibold text-bg shadow-glow transition-all hover:bg-primary/90">
                    Iniciar um treino
                  </button>
                  <button type="button"
                          (click)="openPreviewBlockedAction('criar seu treino')"
                          class="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-body font-semibold text-white transition-colors hover:border-primary/35 hover:text-primary">
                    Criar meu plano
                  </button>
                  <button type="button"
                          (click)="openPreviewBlockedAction('desafiar seus amigos')"
                          class="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-body font-semibold text-white transition-colors hover:border-primary/35 hover:text-primary">
                    Desafiar amigos
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div class="grid gap-3">
            @for (card of previewActionCards; track card.title) {
              <button type="button"
                      (click)="openPreviewBlockedAction(card.reason)"
                      class="group relative overflow-hidden rounded-[26px] border border-primary/10 bg-card-2 px-4 py-4 text-left transition-all hover:border-primary/30 hover:-translate-y-0.5">
                <div class="absolute inset-0 bg-gradient-to-r opacity-100" [class]="card.accentClass"></div>
                <div class="relative z-[1] flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[10px] font-body uppercase tracking-[0.24em] text-primary/78">{{ card.kicker }}</p>
                    <p class="mt-2 text-[17px] font-display font-bold leading-tight text-white">{{ card.title }}</p>
                    <p class="mt-2 text-[12px] font-body leading-relaxed text-text-2">{{ card.description }}</p>
                  </div>
                  <div class="shrink-0 rounded-full border border-primary/20 bg-bg/60 px-2.5 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.18em] text-primary">Abrir</div>
                </div>
                <div class="relative z-[1] mt-4 inline-flex items-center gap-2 text-[12px] font-body font-semibold text-white transition-colors group-hover:text-primary">
                  {{ card.cta }}
                  <span aria-hidden="true">→</span>
                </div>
              </button>
            }
          </div>
        </div>
      }

      @if (showNewUserOnboarding()) {
        <div class="px-4 mt-4 animate-slide-up space-y-4">
          <section class="overflow-hidden rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,rgba(0,255,136,0.10),rgba(0,194,255,0.05)_35%,rgba(7,11,15,1)_100%)] shadow-[0_16px_56px_rgba(0,255,136,0.08)]">
            <div class="relative px-5 py-5">
              <div class="absolute right-[-20px] top-[-40px] h-32 w-32 rounded-full blur-3xl" style="background:radial-gradient(circle,rgba(0,255,136,0.24),rgba(0,255,136,0));"></div>
              <div class="relative z-[1]">
                <div class="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-bg/60 px-3 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.24em] text-primary/85">
                  <span class="h-2 w-2 rounded-full bg-primary shadow-glow-sm"></span>
                  Missão inicial
                </div>
                <h2 class="mt-4 max-w-[13ch] font-display text-[30px] font-black uppercase leading-[0.94] tracking-[-0.04em] text-white">
                  Monte sua base e comece a ganhar XP.
                </h2>
                <p class="mt-3 max-w-[34ch] text-[13px] font-body leading-relaxed text-white/76">
                  Seu onboarding agora é ação, não tutorial. Feche estas etapas para destravar ritmo, streak e progressão dentro do app.
                </p>
              </div>
            </div>
          </section>

          <div class="grid gap-3">
            @for (card of onboardingActionCards(); track card.id) {
              <button type="button"
                      (click)="runOnboardingAction(card.id)"
                      class="group relative overflow-hidden rounded-[26px] border border-white/8 bg-card-2 px-4 py-4 text-left transition-all hover:border-primary/30 hover:-translate-y-0.5">
                <div class="absolute inset-0 bg-gradient-to-r opacity-100" [class]="card.accentClass"></div>
                <div class="relative z-[1] flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-[10px] font-body uppercase tracking-[0.24em] text-primary/78">Etapa {{ $index + 1 }}</p>
                      <span class="rounded-full border border-primary/15 bg-bg/60 px-2 py-1 text-[9px] font-body font-semibold uppercase tracking-[0.16em] text-primary">{{ card.reward }}</span>
                    </div>
                    <p class="mt-2 text-[17px] font-display font-bold leading-tight text-white">{{ card.title }}</p>
                    <p class="mt-2 text-[12px] font-body leading-relaxed text-text-2">{{ card.description }}</p>
                  </div>
                  <div class="shrink-0 rounded-full border border-primary/20 bg-bg/60 px-2.5 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.18em] text-primary">Abrir</div>
                </div>
                <div class="relative z-[1] mt-4 inline-flex items-center gap-2 text-[12px] font-body font-semibold text-white transition-colors group-hover:text-primary">
                  {{ card.cta }}
                  <span aria-hidden="true">→</span>
                </div>
              </button>
            }
          </div>
        </div>
      }

      @if (!isPreview() && !showNewUserOnboarding() && profileCompletionActions().length > 0) {
      <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.015s">
        <button
          type="button"
          (click)="router.navigateByUrl('/profile')"
          class="group relative flex w-full overflow-hidden rounded-[30px] border border-primary/15 bg-[linear-gradient(145deg,rgba(0,255,136,0.14),rgba(0,194,255,0.08)_42%,rgba(14,19,26,1)_100%)] p-5 text-left shadow-[0_20px_60px_rgba(0,255,136,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/30">
          <div class="absolute right-[-28px] top-[-36px] h-28 w-28 rounded-full blur-3xl" style="background:radial-gradient(circle,rgba(0,255,136,0.24),rgba(0,255,136,0));"></div>
          <div class="relative z-[1] flex w-full items-start gap-4">
            <div class="relative mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-primary/25 bg-bg/70">
              <div class="absolute inset-2 rounded-[16px] border border-dashed border-primary/30"></div>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
                <path d="M20 21a8 8 0 1 0-16 0"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-body uppercase tracking-[0.24em] text-primary/78">Completar perfil</p>
              <p class="mt-1 text-[18px] font-display font-bold leading-tight text-white">Complete o básico do seu perfil.</p>

              <div class="mt-4 grid gap-2">
                @for (action of profileCompletionActions(); track action.id) {
                  <div class="flex items-center gap-3 rounded-2xl border border-primary/10 bg-bg/55 px-3 py-3">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] font-body font-bold text-primary">
                      {{ $index + 1 }}
                    </div>
                    <p class="min-w-0 text-[12px] font-body font-semibold text-white">{{ action.label }}</p>
                  </div>
                }
              </div>

              <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-bg/65 px-3 py-1.5 text-[11px] font-body font-semibold text-primary transition-colors group-hover:border-primary/40 group-hover:text-white">
                Ir para meu perfil
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </button>
      </div>
      }

      @if (!isPreview() && !showNewUserOnboarding()) {
        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.06s">
          @if (weeklyGoal().goalDays > 0) {
          <app-weekly-goal-card
            [goalDays]="weeklyGoal().goalDays"
            [completedDays]="weeklyGoal().completedDays"
            [remainingDays]="weeklyGoal().remainingDays"
            [progressPct]="weeklyGoal().progressPct"
            [rewardXp]="weeklyGoal().rewardXp"
            [isCompleted]="weeklyGoal().isCompleted"
            [isRewardClaimed]="weeklyGoal().isRewardClaimed"
            [currentStreak]="weeklyGoal().currentStreak"
            [weekLabel]="weeklyGoal().weekLabel"
            [statusLabel]="weeklyGoal().statusLabel" />
          }
        </div>
      }

      <!-- Rank card (mobile only — desktop shows in right rail) -->
      @if (!isPreview() && !showNewUserOnboarding()) {
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
      }

      <!-- XP Carousel -->
      @if (!isPreview() && !showNewUserOnboarding()) {
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
      }

      @if (!isPreview() && !showNewUserOnboarding() && !workoutService.hasProgram()) {
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

        @if (loadingMore()) {
          <div class="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card-2 px-4 py-4 text-center">
            <div class="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <p class="text-[12px] font-body text-text-2">Carregando mais postagens...</p>
          </div>
        }

        @if (loadError()) {
          <div class="bg-danger/10 border border-danger/30 rounded-xl p-3 text-center">
            <p class="text-[12px] font-body text-danger">{{ loadError() }}</p>
            <button (click)="retryFeedLoad()" class="mt-2 text-[12px] font-body text-primary underline">Tentar novamente</button>
          </div>
        }
      </div>

      <div class="h-8"></div>
      }
    </ng-template>
  `,
})
export class FeedComponent implements OnInit, AfterViewInit, OnDestroy {
  auth                = inject(AuthService);
  checkin             = inject(CheckinService);
  router              = inject(Router);
  permission          = inject(PermissionService);
  private postService = inject(PostService);
  workoutService      = inject(WorkoutService);
  walkSvc             = inject(WalkService);
  ranking             = inject(RankingService);

  readonly CHECKIN_XP = CHECKIN_XP;

  @ViewChild('mainScroll') private mainScrollRef!: ElementRef<HTMLElement>;

  userEmail      = computed(() => this.auth.user()?.email ?? '');
  isPreview      = computed(() => this.auth.authState() === 'preview');
  previewActionCards = PREVIEW_ACTION_CARDS;
  workoutsDone   = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));
  onboardingActionCards = computed<OnboardingActionCard[]>(() => {
    if (this.isPreview()) {
      return [];
    }

    const cards: OnboardingActionCard[] = [];
    const profileActions = this.profileCompletionActions();
    const hasProgram = this.workoutService.hasProgram();
    const weeklyGoal = this.weeklyGoal();
    const workoutsDone = this.workoutsDone();
    const myPostsCount = this.myPostsCount();

    if (profileActions.length > 0) {
      cards.push({
        id: 'profile',
        kicker: 'Etapa 1',
        title: 'Complete seu perfil antes de começar a aparecer de verdade no app.',
        description: 'Defina o básico do perfil para liberar publicação, identidade e progressão social dentro do feed.',
        reward: 'Perfil liberado',
        cta: 'Completar perfil',
        accentClass: 'from-primary/25 via-primary/10 to-transparent',
      });
    }

    if (!hasProgram) {
      cards.push({
        id: 'program',
        kicker: 'Etapa 2',
        title: 'Crie seu treino base para o app saber por onde começar.',
        description: 'Monte seus dias, grupos musculares e sessões. Sem programa, não existe rotina para converter em consistência.',
        reward: 'Base do jogo',
        cta: 'Criar treino',
        accentClass: 'from-[#00C2FF]/24 via-[#00C2FF]/8 to-transparent',
      });
    }

    if (weeklyGoal.goalDays <= 0) {
      cards.push({
        id: 'weekly-goal',
        kicker: 'Etapa 3',
        title: 'Defina sua meta da semana e transforme constância em XP extra.',
        description: 'Escolha quantos dias vai treinar para o app começar a cobrar execução e liberar recompensa semanal.',
        reward: '+150 a +250 XP',
        cta: 'Criar plano da semana',
        accentClass: 'from-[#7C5CFF]/24 via-[#7C5CFF]/8 to-transparent',
      });
    }

    if (hasProgram && workoutsDone === 0) {
      cards.push({
        id: 'first-workout',
        kicker: 'Etapa 4',
        title: 'Mate o primeiro treino e abra sua trilha real de XP.',
        description: 'Seu primeiro treino concluído ativa histórico, streak e libera a sensação de progresso real dentro do feed.',
        reward: '+70 XP estimados',
        cta: 'Começar primeiro treino',
        accentClass: 'from-[#FF7A00]/24 via-[#FF7A00]/8 to-transparent',
      });
    }

    if (workoutsDone > 0 && myPostsCount === 0) {
      cards.push({
        id: 'first-post',
        kicker: 'Etapa 5',
        title: 'Publique seu resultado e puxe seu primeiro desafio no feed.',
        description: 'Seu treino já rendeu XP. Agora transforme isso em presença, prova social e pressão sobre os amigos.',
        reward: 'Feed liberado',
        cta: 'Postar e desafiar',
        accentClass: 'from-[#FF4D6D]/24 via-[#FF4D6D]/8 to-transparent',
      });
    }

    return cards;
  });
  showNewUserOnboarding = computed(() => this.onboardingActionCards().length > 0);
  currentRank    = computed(() => this.ranking.myRank()?.rank ?? 0);
  currentXp      = computed(() => this.ranking.myRank()?.totalXp ?? 0);
  currentStreak  = computed(() => this.ranking.myRank()?.streakDays ?? 0);
  profileCompletionActions = computed<ProfileCompletionAction[]>(() => {
    const profile = this.auth.profile();
    const actions: ProfileCompletionAction[] = [];

    if (!this.auth.avatarUrl()) {
      actions.push({
        id: 'avatar',
        label: 'Adicionar foto do perfil',
      });
    }

    if (!profile.full_name.trim()) {
      actions.push({
        id: 'full_name',
        label: 'Preencher seu nome',
      });
    }

    if (!profile.username.trim()) {
      actions.push({
        id: 'username',
        label: 'Criar seu @username',
      });
    }

    if (!profile.bio.trim()) {
      actions.push({
        id: 'bio',
        label: 'Escrever uma bio rápida',
      });
    }

    return actions;
  });
  weeklyGoal     = computed(() => this.workoutService.weeklyGoalState());
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
    const slides: XpCarouselSlide[] = [{
      id: 'checkin',
      label: this.checkin.todayChecked() ? 'Check-in do dia fechado' : 'Check-in com XP imediato',
      reward: `+${CHECKIN_XP} XP`,
      hint: this.checkin.todayChecked()
        ? 'O ganho do check-in já contou hoje e o radar mostra esse avanço no XP total.'
        : 'Marque presença para ganhar XP instantâneo e reforçar sua sequência diária.',
    }];

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
  prefillOnboardingPost = signal(false);
  showWalk          = signal(false);
  showNotifications = signal(false);
  myPostsCount      = signal(0);
  myPostsCountResolved = signal(false);
  initialFeedResolved = signal(false);
  previousRankSnapshot = signal<number | null>(null);
  recentRankDelta = signal(0);
  recentXpGain = signal(0);
  todayWorkout = computed(() => this.workoutService.todayWorkout());
  todayWorkoutAccess = computed(() => this.workoutService.getWorkoutAccessState(this.todayWorkout()));
  showInitialViewLoading = computed(() => {
    if (!this.auth.initialized()) {
      return true;
    }

    if (!this.initialFeedResolved()) {
      return true;
    }

    if (this.isPreview()) {
      return false;
    }

    if (!this.auth.profileReady()) {
      return true;
    }

    if (!this.workoutService.hydrated()) {
      return true;
    }

    if (!this.myPostsCountResolved()) {
      return true;
    }

    return this.ranking.loading() && !this.ranking.myRank();
  });
  latestCompletedSession = computed<WorkoutSession | null>(() => {
    const history = this.workoutService.history();
    if (!history.length) return null;

    return [...history].sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null;
  });
  newPostWorkout = computed(() => {
    if (!this.prefillOnboardingPost()) return null;

    const session = this.latestCompletedSession();
    if (!session) return null;

    return { name: session.planName, muscleGroup: session.muscleGroup };
  });
  newPostSummary = computed<WorkoutPostPrefillSummary | null>(() => {
    if (!this.prefillOnboardingPost()) return null;

    const session = this.latestCompletedSession();
    if (!session) return null;

    return {
      title: session.planName,
      muscleGroup: session.muscleGroup,
      difficulty: session.difficulty,
      workoutType: 'Musculação',
      durationMinutes: session.estimatedDuration,
      exercisesDone: session.exercisesDone,
      totalExercises: session.totalExercises,
      calories: null,
      xpEarned: session.xpEarned,
      completedAtLabel: this.formatCompletedAt(session.completedAt),
      sessionLabel: session.dateLabel === 'Hoje' ? 'Treino de hoje' : session.dateLabel,
    };
  });
  newPostTitle = computed(() => this.prefillOnboardingPost() && this.latestCompletedSession() ? 'Postar treino concluído' : 'Novo post');
  newPostCaption = computed(() => {
    if (!this.prefillOnboardingPost()) return '';

    const session = this.latestCompletedSession();
    if (!session) return '';

    const streak = this.workoutService.streak();
    return [
      'Treino finalizado no Repify.',
      `${session.planName} • ${session.muscleGroup}`,
      `Exercícios concluídos: ${session.exercisesDone}/${session.totalExercises}`,
      `Duração estimada: ${session.estimatedDuration} min`,
      `XP ganho: +${session.xpEarned}`,
      `Nível do treino: ${session.difficulty}`,
      streak > 0 ? `Streak atual: ${streak} dia${streak === 1 ? '' : 's'}` : '',
      'Topa encarar esse desafio comigo?',
    ].filter(Boolean).join('\n');
  });

  posts      = signal<WorkoutPost[]>([]);
  loading    = signal(false);
  loadingMore = signal(false);
  hasMorePosts = signal(true);
  loadError  = signal('');
  refreshing = signal(false);
  pullHeight = signal(0);
  pullRotation = computed(() => Math.min((this.pullHeight() / 70) * 180, 180));
  private loadedPostCount = 0;

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
      if (pending.user.id && pending.user.id === this.auth.user()?.id) {
        this.myPostsCount.update(count => count + 1);
      }
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
    this.initialFeedResolved.set(false);
    void this.loadFeed({ reset: true });

    if (!this.isPreview()) {
      this.myPostsCountResolved.set(false);
      void this.workoutService.ensureHydrated();
      void this.loadMyPostsCount();
      void this.ranking.load(true);
      this.rankingPoll = setInterval(() => void this.ranking.load(true), 60000);
      this.xpCarouselTimer = setInterval(() => {
        const count = this.xpCarouselSlides().length;
        if (count <= 1) return;
        this.xpCarouselIndex.update(index => (index + 1) % count);
      }, 7200);
    } else {
      this.myPostsCountResolved.set(true);
    }
  }

  ngAfterViewInit(): void {
    const el = this.mainScrollRef.nativeElement;
    el.addEventListener('scroll', this.onMainScroll, { passive: true });
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    el.addEventListener('touchend',   this.onTouchEnd,   { passive: true });
    el.addEventListener('touchcancel', this.onTouchEnd,  { passive: true });
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
  }

  ngOnDestroy(): void {
    const el = this.mainScrollRef?.nativeElement;
    if (el) {
      el.removeEventListener('scroll', this.onMainScroll);
      el.removeEventListener('touchstart',  this.onTouchStart);
      el.removeEventListener('touchmove',   this.onTouchMove);
      el.removeEventListener('touchend',    this.onTouchEnd);
      el.removeEventListener('touchcancel', this.onTouchEnd);
    }
    window.removeEventListener('scroll', this.onWindowScroll);
    if (this.rankingPoll) clearInterval(this.rankingPoll);
    if (this.xpCarouselTimer) clearInterval(this.xpCarouselTimer);
    if (this.xpFeedbackTimer) clearTimeout(this.xpFeedbackTimer);
  }

  setXpCarouselIndex(index: number): void {
    this.xpCarouselIndex.set(index);
  }

  scrollToTop(): void {
    if (window.innerWidth >= 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const el = this.mainScrollRef?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
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
    await this.loadFeed({ reset: true });
    this.refreshing.set(false);
    this.pullHeight.set(0);
  }

  private onMainScroll = (): void => {
    const el = this.mainScrollRef?.nativeElement;
    if (!el) return;

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= 320) {
      void this.loadMorePosts();
    }
  };

  private onWindowScroll = (): void => {
    if (window.innerWidth < 1024) return;

    const doc = document.documentElement;
    const remaining = doc.scrollHeight - (window.scrollY + window.innerHeight);
    if (remaining <= 520) {
      void this.loadMorePosts();
    }
  };

  async loadFeed(options: { reset?: boolean } = {}): Promise<void> {
    const reset = options.reset ?? false;
    if (reset) {
      this.loading.set(true);
      this.loadedPostCount = 0;
      this.hasMorePosts.set(true);
    } else {
      if (this.loading() || this.loadingMore() || !this.hasMorePosts()) return;
      this.loadingMore.set(true);
    }

    this.loadError.set('');

    try {
      const page = await this.postService.listFeed(FEED_PAGE_SIZE, this.loadedPostCount);
      this.loadedPostCount += page.posts.length;
      this.hasMorePosts.set(page.hasMore);

      if (reset) {
        this.posts.set(page.posts);
      } else {
        this.posts.update(current => [...current, ...page.posts]);
      }
    } catch (err: any) {
      this.loadError.set(err?.message ?? 'Não foi possível carregar o feed.');
    } finally {
      if (reset) {
        this.loading.set(false);
        this.initialFeedResolved.set(true);
      } else {
        this.loadingMore.set(false);
      }
    }
  }

  async loadMorePosts(): Promise<void> {
    await this.loadFeed();
  }

  async retryFeedLoad(): Promise<void> {
    if (this.posts().length > 0) {
      await this.loadMorePosts();
      return;
    }

    await this.loadFeed({ reset: true });
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
    if (!this.permission.requireAuthenticated('registrar treinos e check-ins')) {
      return;
    }

    const workout = this.todayWorkout();
    if (!workout) return;

    const access = await this.workoutService.beginWorkout(workout);
    if (!access.canStart) return;

    await this.router.navigateByUrl(`/workout/${workout.id}`);
  }

  handleDailyChallenge(): void {
    if (!this.permission.requireAuthenticated('registrar treinos e check-ins')) {
      return;
    }

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
    if (post.user.id && post.user.id === this.auth.user()?.id) {
      this.myPostsCount.update(count => count + 1);
    }
    this.prefillOnboardingPost.set(false);
    this.showNewPost.set(false);
  }

  closeNewPostPanel(): void {
    this.prefillOnboardingPost.set(false);
    this.showNewPost.set(false);
  }

  openNewPostPanel(prefillFromLatestWorkout = false): void {
    if (!this.permission.requireAuthenticated('publicar conteúdo')) {
      return;
    }

    if (!this.postService.canCreatePost()) {
      void this.router.navigateByUrl('/profile');
      return;
    }

    this.prefillOnboardingPost.set(prefillFromLatestWorkout && !!this.latestCompletedSession());
    this.showNewPost.set(true);
  }

  openNotificationsPanel(): void {
    if (!this.permission.requireAuthenticated('interagir com a comunidade')) {
      return;
    }

    this.showNotifications.set(true);
  }

  openPreviewBlockedAction(reason: string): void {
    this.permission.requireAuthenticated(reason);
  }

  runOnboardingAction(actionId: OnboardingActionCard['id']): void {
    if (actionId === 'profile' || actionId === 'weekly-goal') {
      void this.router.navigateByUrl('/profile');
      return;
    }

    if (actionId === 'program') {
      void this.router.navigateByUrl('/my-workout');
      return;
    }

    if (actionId === 'first-post') {
      this.openNewPostPanel(true);
      return;
    }

    const workout = this.todayWorkout();
    if (workout) {
      void this.startWorkout(workout.id);
      return;
    }

    void this.router.navigateByUrl('/my-workout');
  }

  private async loadMyPostsCount(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.myPostsCount.set(0);
      this.myPostsCountResolved.set(true);
      return;
    }

    try {
      const posts = await this.postService.listByUser(userId);
      this.myPostsCount.set(posts.length);
    } catch {
      this.myPostsCount.set(0);
    } finally {
      this.myPostsCountResolved.set(true);
    }
  }

  private formatCompletedAt(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }


  async toggleLike(postId: string): Promise<void> {
    if (!this.permission.requireAuthenticated('curtir e comentar')) {
      return;
    }

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
