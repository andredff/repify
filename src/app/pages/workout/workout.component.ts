import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkoutCompletionSummary, WorkoutService, StoredPlan, StoredExercise, WorkoutSession } from '../../core/services/workout.service';
import { PostService } from '../../core/services/post.service';
import { WorkoutPost } from '../../core/models/workout-post.model';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';
import { WorkoutCompletionStateComponent } from './components/workout-completion-state.component';
import { NewPostModalComponent, WorkoutPostPrefillSummary } from '../feed/components/new-post-modal.component';

const STATIC_PLANS: Record<string, StoredPlan> = {
  'peito-triceps': {
    id: 'peito-triceps', name: 'Peito + Tríceps', muscleGroup: 'peito',
    estimatedDuration: 60, totalExercises: 6, difficulty: 'Intermediário',
    dayLabel: '', dayIndex: 0,
    exercises: [
      { id:'1', name:'Supino reto',       sets:4, reps:'8-10 reps', done:false },
      { id:'2', name:'Supino inclinado',  sets:4, reps:'8-10 reps', done:false },
      { id:'3', name:'Crucifixo máquina', sets:3, reps:'12 reps',   done:false },
      { id:'4', name:'Desenvolvimento',   sets:3, reps:'10 reps',   done:false },
      { id:'5', name:'Tríceps corda',     sets:3, reps:'12 reps',   done:false },
      { id:'6', name:'Tríceps testa',     sets:3, reps:'12 reps',   done:false },
    ],
  },
  'costas-biceps': {
    id: 'costas-biceps', name: 'Costas + Bíceps', muscleGroup: 'costas',
    estimatedDuration: 55, totalExercises: 5, difficulty: 'Intermediário',
    dayLabel: '', dayIndex: 0,
    exercises: [
      { id:'1', name:'Puxada frente',     sets:4, reps:'10 reps', done:false },
      { id:'2', name:'Remada curvada',    sets:3, reps:'10 reps', done:false },
      { id:'3', name:'Remada unilateral', sets:3, reps:'12 reps', done:false },
      { id:'4', name:'Rosca direta',      sets:3, reps:'12 reps', done:false },
      { id:'5', name:'Rosca martelo',     sets:3, reps:'12 reps', done:false },
    ],
  },
  'pernas': {
    id: 'pernas', name: 'Pernas', muscleGroup: 'pernas',
    estimatedDuration: 70, totalExercises: 5, difficulty: 'Intermediário',
    dayLabel: '', dayIndex: 0,
    exercises: [
      { id:'1', name:'Agachamento',       sets:5, reps:'8 reps',  done:false },
      { id:'2', name:'Leg press',         sets:4, reps:'12 reps', done:false },
      { id:'3', name:'Cadeira extensora', sets:3, reps:'15 reps', done:false },
      { id:'4', name:'Mesa flexora',      sets:3, reps:'12 reps', done:false },
      { id:'5', name:'Panturrilha em pé', sets:4, reps:'20 reps', done:false },
    ],
  },
};

@Component({
  selector: 'app-workout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedHeaderComponent, NotificationsPanelComponent, WorkoutCompletionStateComponent, NewPostModalComponent],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto lg:max-w-3xl">

      @if (!showWorkoutPostComposer()) {
        <app-feed-header
          [showBack]="true"
          (onBack)="location.back()"
          (onOpenNotifications)="showNotifications.set(true)" />
      }

      <main class="flex-1 px-4 pb-32 lg:pb-12 overflow-y-auto lg:pt-8"
            style="padding-top: calc(76px + env(safe-area-inset-top))">

        <!-- ── COMPLETED ── -->
        @if (viewMode() === 'completed' && completionSummary()) {
          <section class="pt-6">
            <app-workout-completion-state
              [quote]="completionSummary()!.motivationalQuote"
              [completedAt]="completionSummary()!.completedAt"
              (createPost)="openWorkoutPostComposer()"
              (viewProgress)="goToProgress()"
              (backToFeed)="goToFeed()" />
          </section>

        <!-- ── LOCKED ── -->
        } @else if (viewMode() === 'locked') {
          <section class="pt-6">
            <div class="rounded-[28px] border border-border bg-card-2 px-5 py-6 text-center">
              <p class="text-[30px]">🔒</p>
              <p class="mt-4 text-[24px] font-display font-black text-white">Treino bloqueado</p>
              <p class="mt-2 text-[13px] font-body leading-relaxed text-text-2">
                Você só pode executar o treino do dia uma vez. O restante do fluxo libera automaticamente amanhã.
              </p>
              <p class="mt-5 inline-flex rounded-full border border-border px-3 py-1 text-[11px] font-body font-semibold text-text-2">
                {{ blockedMessage() || '🔒 Disponível amanhã' }}
              </p>
              <div class="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" (click)="goToProgram()"
                        class="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-[14px] font-display font-bold text-primary transition-all hover:bg-primary/15">
                  Ver meu plano
                </button>
                <button type="button" (click)="goToFeed()"
                        class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-display font-bold text-white transition-all hover:border-white/20">
                  Voltar ao feed
                </button>
              </div>
            </div>
          </section>

        <!-- ── ACTIVE ── -->
        } @else if (plan()) {
          <section class="pt-5 pb-1">
            <p class="text-[22px] font-display font-bold text-white">Treino</p>
            <p class="text-[12px] font-body text-text-2 mt-1">{{ plan()?.difficulty ?? 'Execução do treino' }}</p>
          </section>

          <h1 class="text-[28px] font-display font-bold text-white leading-tight mb-1">
            {{ plan()!.name }}
          </h1>
          <p class="text-[12px] font-body text-text-2 mb-3">
            ⏱ {{ plan()!.estimatedDuration }} min · {{ plan()!.totalExercises }} exercícios
          </p>

          <!-- Progress bar -->
          <div class="flex items-center justify-between mb-2">
            <span class="text-[13px] font-body text-text-2">
              {{ doneCount() }}/{{ plan()!.exercises.length }} concluídos
            </span>
            <span class="text-[13px] font-mono font-semibold text-primary">
              {{ progressPct() }}%
            </span>
          </div>
          <div class="h-1.5 bg-card-2 rounded-full mb-6 overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-500 shadow-glow-sm"
                 [style.width]="progressPct() + '%'"></div>
          </div>

          <!-- Exercise list -->
          <div class="space-y-3">
            @for (ex of exercises(); track ex.id; let i = $index) {
              <button type="button" (click)="toggleExercise(ex.id)"
                      class="w-full rounded-2xl border transition-all p-4 text-left flex items-center gap-4"
                      [class]="ex.done ? 'bg-primary/8 border-primary/30' : 'bg-card-2 border-border'">

                <!-- Checkbox -->
                <div class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border transition-all"
                     [class]="ex.done ? 'bg-primary border-primary' : 'bg-card border-border'">
                  @if (ex.done) {
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3"
                         stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  } @else {
                    <span class="text-[12px] font-mono font-bold text-text-2">{{ i + 1 }}</span>
                  }
                </div>

                <!-- Name -->
                <div class="flex-1 min-w-0">
                  <p class="text-[15px] font-body font-semibold leading-tight transition-colors"
                     [class]="ex.done ? 'text-text-2 line-through' : 'text-white'">
                    {{ ex.name }}
                  </p>
                </div>

                <!-- Sets × Reps badge -->
                <div class="shrink-0 text-right">
                  <p class="text-[20px] font-display font-black leading-none transition-colors"
                     [class]="ex.done ? 'text-primary/50' : 'text-primary'">
                    {{ ex.sets }}
                  </p>
                  <p class="text-[10px] font-body text-text-2 mt-0.5 uppercase tracking-wider">séries</p>
                  <p class="text-[13px] font-body font-semibold mt-1 transition-colors"
                     [class]="ex.done ? 'text-text-2/50' : 'text-white'">
                    {{ ex.reps }}
                  </p>
                </div>

              </button>
            }
          </div>

        <!-- ── NOT FOUND ── -->
        } @else {
          <div class="flex flex-col items-center justify-center h-64 text-center">
            <p class="text-[32px] mb-3">🤔</p>
            <p class="text-text-2 font-body text-[14px]">Treino não encontrado.</p>
          </div>
        }

      </main>

      <!-- Sticky CTA -->
      @if (plan() && viewMode() === 'active') {
        <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-8 pt-4 glass border-t border-border">
          <button (click)="finishWorkout()"
                  [disabled]="finishing()"
                  class="w-full py-4 rounded-2xl font-display font-bold text-[16px] transition-all bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-[0.98] disabled:opacity-70">
            {{ finishing() ? 'Finalizando...' : allDone() ? 'Finalizar treino ✓' : 'Finalizar treino' }}
          </button>
          @if (errorMessage()) {
            <p class="mt-3 text-center text-[12px] font-body text-danger">{{ errorMessage() }}</p>
          }
        </div>
      }

    </div>

    @if (showNotifications()) {
      <app-notifications-panel (onClose)="showNotifications.set(false)" />
    }

    @if (showWorkoutPostComposer()) {
      <app-new-post-modal
        [title]="'Postar treino do dia'"
        [prefillCaption]="workoutPostCaption()"
        [prefillWorkout]="workoutPostWorkout()"
        [prefillSummary]="workoutPostSummary()"
        (onClose)="showWorkoutPostComposer.set(false)"
        (onPublish)="onWorkoutPostPublished($event)" />
    }

  `,
})
export class WorkoutComponent implements OnInit {
  location               = inject(Location);
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private workoutService = inject(WorkoutService);
  private postService    = inject(PostService);

  showNotifications       = signal(false);
  showWorkoutPostComposer = signal(false);
  finishing               = signal(false);
  errorMessage            = signal('');
  viewMode                = signal<'active' | 'completed' | 'locked'>('active');
  blockedMessage          = signal('');
  completionSummary       = signal<WorkoutCompletionSummary | null>(null);
  exercises               = signal<StoredExercise[]>([]);
  plan                    = signal<StoredPlan | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  doneCount    = computed(() => this.exercises().filter(e => e.done).length);
  progressPct  = computed(() => {
    const total = this.exercises().length;
    return total === 0 ? 0 : Math.round((this.doneCount() / total) * 100);
  });
  allDone      = computed(() => this.exercises().length > 0 && this.doneCount() === this.exercises().length);

  completedSession = computed<WorkoutSession | null>(() => {
    const plan    = this.plan();
    const summary = this.completionSummary();
    if (!plan || !summary) return null;
    const history = this.workoutService.history();
    return history.find(s => s.planId === plan.id && s.completedAt === summary.completedAt)
      ?? history.find(s => s.planId === plan.id)
      ?? null;
  });

  workoutPostWorkout = computed(() => {
    const session = this.completedSession();
    const plan    = this.plan();
    if (session) return { name: session.planName, muscleGroup: session.muscleGroup };
    if (plan)    return { name: plan.name,        muscleGroup: plan.muscleGroup };
    return null;
  });

  workoutPostSummary = computed<WorkoutPostPrefillSummary | null>(() => {
    const session = this.completedSession();
    if (!session) return null;
    return {
      title:            session.planName,
      muscleGroup:      session.muscleGroup,
      difficulty:       session.difficulty,
      workoutType:      'Musculação',
      durationMinutes:  session.estimatedDuration,
      exercisesDone:    session.exercisesDone,
      totalExercises:   session.totalExercises,
      calories:         null,
      xpEarned:         session.xpEarned,
      completedAtLabel: this._formatTime(session.completedAt),
      sessionLabel:     session.dateLabel === 'Hoje' ? 'Treino de hoje' : session.dateLabel,
    };
  });

  workoutPostCaption = computed(() => {
    const session = this.completedSession();
    if (!session) return '';
    const streak = this.workoutService.streak();
    return [
      'Treino concluído. A régua ficou alta.',
      streak > 0
        ? `Streak em ${streak} dia${streak === 1 ? '' : 's'}. Quero ver responder.`
        : 'Quero ver quem responde no mesmo ritmo.',
    ].join('\n');
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    void this._initializeWorkout();
  }

  private async _initializeWorkout(): Promise<void> {
    await this.workoutService.ensureHydrated();

    const id    = this.route.snapshot.paramMap.get('id') ?? '';
    const found = STATIC_PLANS[id] ?? this.workoutService.getPlan(id) ?? null;

    if (!found) {
      this.plan.set(null);
      this.viewMode.set('active');
      return;
    }

    const access = await this.workoutService.beginWorkout(found);

    if (access.state === 'locked') {
      this.plan.set(found);
      this.viewMode.set('locked');
      this.blockedMessage.set(access.label);
      return;
    }

    if (access.state === 'completed') {
      this.plan.set(found);
      this.viewMode.set('completed');
      this.completionSummary.set({
        completedAt:      this.workoutService.completedAt() ?? new Date().toISOString(),
        motivationalQuote: this.workoutService.completionQuote() ?? this.workoutService.motivationalQuotes[0],
        state:            'completed',
      });
      return;
    }

    this.plan.set(found);
    this.exercises.set(found.exercises.map(e => ({ ...e })));
    this.viewMode.set('active');

  }

  // ── Actions ────────────────────────────────────────────────────────────────

  toggleExercise(id: string): void {
    this.exercises.update(list =>
      list.map(e => e.id === id ? { ...e, done: !e.done } : e)
    );
  }

  async finishWorkout(): Promise<void> {
    if (this.finishing()) return;
    const p = this.plan();
    if (!p) return;

    this.finishing.set(true);
    this.errorMessage.set('');

    try {
      const planWithState: StoredPlan = { ...p, exercises: this.exercises() };
      const summary = await this.workoutService.markFinished(planWithState, this.doneCount());
      this.completionSummary.set(summary);
      this.viewMode.set('completed');
    } catch (error: any) {
      this.errorMessage.set(error?.message ?? 'Não foi possível concluir o treino agora. Tente novamente.');
    } finally {
      this.finishing.set(false);
    }
  }

  openWorkoutPostComposer(): void { this.showWorkoutPostComposer.set(true); }

  onWorkoutPostPublished(post: WorkoutPost): void {
    post.streak = this.workoutService.streak();
    this.postService.setPendingPost(post);
    this.showWorkoutPostComposer.set(false);
    void this.router.navigateByUrl('/feed');
  }

  goToProgress(): void  { this.router.navigateByUrl('/progress'); }
  goToFeed(): void      { this.router.navigateByUrl('/feed'); }
  goToProgram(): void   { this.router.navigateByUrl('/my-workout'); }

  private _formatTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }
}
