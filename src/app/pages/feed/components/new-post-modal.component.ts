import { Component, inject, signal, output, computed, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { AuthService } from '../../../core/services/auth.service';
import { RankingService } from '../../../core/services/ranking.service';
import { WorkoutPost } from '../../../core/models/workout-post.model';
import { ImageCropperComponent } from '../../../shared/image-cropper.component';

const MUSCLE_EMOJI: Record<string, string> = {
  peito:'🫁', costas:'🔙', pernas:'🦵', ombros:'🏔️',
  biceps:'💪', triceps:'🤜', abdomen:'⚡', full:'🔥',
};

interface WorkoutOption {
  name: string;
  muscleGroup: string;
}

interface CaptionOption {
  id: string;
  label: string;
  value: string;
}

const CAPTION_HOOKS = [
  'Treino batido. Quero ver quem responde.',
  'Missão cumprida no Repify. Agora eu quero réplica.',
  'Fechei o treino e deixei o desafio no ar.',
  'Resultado entregue. Sua vez de tentar encostar.',
  'Acabei o treino do dia. Quem vier, vem forte.',
  'Treino concluído e régua levantada.',
  'Hoje eu fiz minha parte. Quero ver a sua.',
  'O treino caiu. O desafio ficou.',
  'Marquei presença e deixei trabalho pra concorrência.',
  'Treino do dia resolvido. Bora ver quem sustenta o ritmo.',
];

const CAPTION_METRICS = [
  (summary: WorkoutPostPrefillSummary) => `Foram ${summary.exercisesDone}/${summary.totalExercises} exercícios fechados em ${summary.durationMinutes} min.`,
  (summary: WorkoutPostPrefillSummary) => `Saí com +${summary.xpEarned} XP depois de ${summary.durationMinutes} min de execução real.`,
  (summary: WorkoutPostPrefillSummary) => `Completei ${summary.exercisesDone}/${summary.totalExercises} exercícios e o treino já ficou no histórico.`,
  (summary: WorkoutPostPrefillSummary) => `Treino encerrado às ${summary.completedAtLabel} com +${summary.xpEarned} XP no bolso.`,
  (summary: WorkoutPostPrefillSummary) => `Passei por ${summary.title} e fechei ${summary.exercisesDone}/${summary.totalExercises} exercícios sem cortar caminho.`,
];

const CAPTION_CLOSERS = [
  'Se você acha que bate, prova no app.',
  'Topa entrar nesse desafio comigo?',
  'Quero ver alguém passar disso hoje.',
  'Se vier, vem com treino completo.',
  'Agora é sua chance de responder no Repify.',
  'Vamos ver quem consegue devolver esse placar.',
  'Se for desafiar, fecha o treino inteiro.',
  'Duvido encostar nesse ritmo ainda hoje.',
];

export interface WorkoutPostPrefillSummary {
  title: string;
  muscleGroup: string;
  difficulty: string;
  workoutType: string;
  durationMinutes: number;
  exercisesDone: number;
  totalExercises: number;
  calories?: number | null;
  xpEarned: number;
  completedAtLabel: string;
  sessionLabel: string;
}

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [FormsModule, ImageCropperComponent],
  template: `
    @if (cropMode()) {
      <app-image-cropper
        [src]="cropSrc()!"
        shape="square"
        [aspectW]="cropMode() === 'story' ? 9 : 1"
        [aspectH]="cropMode() === 'story' ? 16 : 1"
        [outputSize]="1080"
        (onCancel)="cropMode.set(null)"
        (onCropped)="onPhotoCropped($event)" />
    }

    <!-- Format picker sheet -->
    @if (showFormatPicker()) {
      <div class="fixed inset-0 z-[55] flex items-end max-w-[460px] mx-auto"
           style="background:rgba(8,12,16,0.7)" (click)="showFormatPicker.set(false)">
        <div class="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3 animate-slide-up"
             (click)="$event.stopPropagation()">
          <p class="text-[13px] font-body font-semibold text-white mb-1">Formato da foto</p>

          <button (click)="useOriginal()"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card-2 hover:border-border-2 transition-all text-left">
            <div class="w-9 h-9 rounded-lg bg-border flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </div>
            <div>
              <p class="text-[13px] font-body font-semibold text-white">Usar original</p>
              <p class="text-[11px] font-body text-text-2">Mantém a proporção da foto</p>
            </div>
          </button>

          <button (click)="cropMode.set('square'); showFormatPicker.set(false)"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card-2 hover:border-border-2 transition-all text-left">
            <div class="w-9 h-9 rounded-lg bg-border flex items-center justify-center shrink-0">
              <div class="w-5 h-5 border-2 border-text-2 rounded-sm"></div>
            </div>
            <div>
              <p class="text-[13px] font-body font-semibold text-white">Quadrado (1:1)</p>
              <p class="text-[11px] font-body text-text-2">Formato padrão do feed</p>
            </div>
          </button>

          <button (click)="cropMode.set('story'); showFormatPicker.set(false)"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card-2 hover:border-border-2 transition-all text-left">
            <div class="w-9 h-9 rounded-lg bg-border flex items-center justify-center shrink-0">
              <div class="w-3.5 h-5 border-2 border-text-2 rounded-sm"></div>
            </div>
            <div>
              <p class="text-[13px] font-body font-semibold text-white">Stories (9:16)</p>
              <p class="text-[11px] font-body text-text-2">Formato vertical para stories</p>
            </div>
          </button>

          <button (click)="showFormatPicker.set(false)"
                  class="w-full py-3 text-[13px] font-body text-text-2 hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    }

    <div class="fixed inset-0 z-50 flex flex-col max-w-[460px] mx-auto bg-card animate-slide-up">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 border-b border-border shrink-0"
           style="padding-top: calc(env(safe-area-inset-top) + 12px); padding-bottom: 12px">
        <button (click)="onClose.emit()" class="text-text-2 hover:text-white transition-colors text-[13px] font-body">
          Cancelar
        </button>
        <p class="text-[14px] font-body font-semibold text-white">{{ title() }}</p>
        <button
          (click)="publish()"
          [disabled]="!canPublish() || publishing()"
          class="text-[13px] font-body font-semibold text-primary transition-colors disabled:opacity-30">
          Publicar
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5">

          <!-- Hidden file input -->
          <input #photoInput type="file" accept="image/*" class="hidden" (change)="onPhotoSelected($event)" />

          <!-- Photo area -->
          @if (photoPreview()) {
            <div class="relative rounded-2xl overflow-hidden bg-card-2">
              <img [src]="photoPreview()" class="w-full h-auto max-h-[70vh] object-contain" />
              <div class="absolute top-3 right-3 flex gap-2">
                @if (prefillSummary()) {
                  <button
                    type="button"
                    (click)="regenerateChallengeArtwork()"
                    class="h-8 px-3 bg-bg/80 rounded-full flex items-center gap-1.5 text-text-2 hover:text-white transition-colors text-[11px] font-body">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
                      <polyline points="21 3 21 9 15 9"/>
                    </svg>
                    Regenerar arte
                  </button>
                }
                <button
                  (click)="cropSrc.set(photoPreview()); showFormatPicker.set(true)"
                  class="h-8 px-3 bg-bg/80 rounded-full flex items-center gap-1.5 text-text-2 hover:text-white transition-colors text-[11px] font-body">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  Ajustar
                </button>
                <button
                  (click)="clearPhoto()"
                  class="w-8 h-8 bg-bg/80 rounded-full flex items-center justify-center text-white hover:bg-bg transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          } @else {
            <button
              (click)="photoInput.click()"
              class="w-full aspect-[4/3] bg-card-2 border-2 border-dashed border-border-2 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <div class="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div class="text-center">
                <p class="text-[14px] font-body font-semibold text-white group-hover:text-primary transition-colors">Adicionar foto</p>
                <p class="text-[11px] text-text-2 font-body mt-0.5">Opcional · JPG, PNG ou WEBP · máx 10MB</p>
              </div>
            </button>
          }

          @if (prefillSummary()) {
            <div class="rounded-2xl border border-primary/20 bg-primary/10 p-4 shadow-glow-sm">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-[11px] font-body font-medium uppercase tracking-[0.22em] text-primary/80">Treino concluído</p>
                  <p class="mt-1 text-[18px] font-display font-bold text-white">{{ prefillSummary()!.title }}</p>
                  <p class="mt-1 text-[12px] font-body capitalize text-text-2">
                    {{ prefillSummary()!.muscleGroup }} · {{ prefillSummary()!.difficulty }} · {{ prefillSummary()!.completedAtLabel }}
                  </p>
                </div>
                <div class="rounded-full border border-primary/20 bg-bg/40 px-3 py-1 text-[11px] font-mono font-semibold text-primary">
                  +{{ prefillSummary()!.xpEarned }} XP
                </div>
              </div>

              <div class="mt-4 grid grid-cols-3 gap-2">
                <div class="rounded-xl border border-white/8 bg-bg/30 px-3 py-2">
                  <p class="text-[10px] font-body uppercase tracking-[0.16em] text-text-2">Execução</p>
                  <p class="mt-1 text-[15px] font-display font-bold text-white">
                    {{ prefillSummary()!.exercisesDone }}/{{ prefillSummary()!.totalExercises }}
                  </p>
                </div>
                <div class="rounded-xl border border-white/8 bg-bg/30 px-3 py-2">
                  <p class="text-[10px] font-body uppercase tracking-[0.16em] text-text-2">Duração</p>
                  <p class="mt-1 text-[15px] font-display font-bold text-white">{{ prefillSummary()!.durationMinutes }} min</p>
                </div>
                <div class="rounded-xl border border-white/8 bg-bg/30 px-3 py-2">
                  <p class="text-[10px] font-body uppercase tracking-[0.16em] text-text-2">Desafio</p>
                  <p class="mt-1 text-[15px] font-display font-bold text-white">Real</p>
                </div>
              </div>
            </div>
          }

          @if (captionOptions().length > 0) {
            <div class="space-y-2">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Legendas de provocação</label>
              <div class="rounded-xl border border-border bg-card-2 p-3.5 space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-[13px] font-body font-semibold text-white">{{ generatedCaptionLabel() || 'Gerar legenda de desafio' }}</p>
                    <p class="text-[11px] font-body text-text-2">40 variações para provocar, desafiar e desafiar a turma.</p>
                  </div>
                  <button type="button"
                          (click)="generateCaption()"
                          class="shrink-0 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-[12px] font-body font-semibold text-primary transition-all hover:bg-primary/18 active:scale-[0.98]">
                    Gerar legenda
                  </button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button"
                          (click)="setManualCaptionMode()"
                          class="rounded-full border px-3 py-1.5 text-[11px] font-body transition-colors"
                          [class]="selectedCaptionOption() === 'manual' ? 'border-primary/40 bg-primary/12 text-primary' : 'border-border text-text-2 hover:text-white'">
                    Escrever manualmente
                  </button>
                  <!-- <span class="rounded-full border border-border bg-bg/30 px-3 py-1.5 text-[11px] font-mono text-text-2">
                    {{ captionOptions().length }} estilos
                  </span> -->
                </div>
              </div>
              <p class="text-[11px] font-body text-text-2">Gere quantas vezes quiser e, se preferir, edite tudo manualmente no campo abaixo.</p>
            </div>
          }

          <!-- Caption -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Descrição</label>
            <textarea
              [ngModel]="caption"
              (ngModelChange)="onCaptionChange($event)"
              placeholder="Conte como foi o treino..."
              rows="3"
              maxlength="300"
              class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none resize-none focus:border-primary/60 placeholder:text-muted transition-colors">
            </textarea>
            <p class="text-[10px] text-text-2 text-right">{{ caption.length }}/300</p>
          </div>

          <!-- Workout selector (optional) -->
          <div class="space-y-2">
            <!-- <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">
              Marcar treino do dia <span class="text-text-2/60 normal-case">{{ prefillSummary() ? '(automático)' : '(opcional)' }}</span>
            </label> -->

            @if (prefillSummary() && selectedWorkout()) {
              <!-- <div class="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 shadow-glow-sm">
                <div class="w-10 h-10 rounded-xl bg-bg/50 flex items-center justify-center text-[18px] shrink-0">
                  {{ muscleEmoji(selectedWorkout()!.muscleGroup) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[13px] font-body font-semibold text-white truncate">{{ selectedWorkout()!.name }}</p>
                  <p class="text-[11px] font-body text-text-2 capitalize">{{ selectedWorkout()!.muscleGroup }}</p>
                </div>
                <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div> -->
            } @else if (workoutOptions().length > 0) {
              <div class="space-y-2">
                @for (opt of workoutOptions(); track opt.name) {
                  <button
                    type="button"
                    (click)="toggleWorkout(opt)"
                    class="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                    [class]="isSelected(opt)
                      ? 'border-primary/50 bg-primary/10 shadow-glow-sm'
                      : 'border-border bg-card-2 hover:border-border-2'">
                    <div class="w-10 h-10 rounded-xl bg-bg/50 flex items-center justify-center text-[18px] shrink-0">
                      {{ muscleEmoji(opt.muscleGroup) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[13px] font-body font-semibold text-white truncate">{{ opt.name }}</p>
                      <p class="text-[11px] font-body text-text-2 capitalize">{{ opt.muscleGroup }}</p>
                    </div>
                    @if (isSelected(opt)) {
                      <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    }
                  </button>
                }
              </div>
            } @else {
              <div class="bg-card-2 border border-dashed border-border rounded-xl p-4 text-center">
                <p class="text-[12px] font-body text-text-2">
                  Nenhum treino cadastrado. Monte seu programa em <span class="text-primary">Meu Treino</span>.
                </p>
              </div>
            }
          </div>

          <!-- Meta anual toggle -->
          @if (auth.profile().yearly_goal) {
            <div class="flex items-center justify-between bg-card-2 border border-border rounded-xl px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <p class="text-[12px] font-body font-semibold text-white">Exibir meta anual</p>
                  <p class="text-[10px] font-body text-text-2">
                    {{ workoutsDone() }}/{{ auth.profile().yearly_goal }} treinos
                  </p>
                </div>
              </div>
              <button type="button" (click)="showGoal.update(v => !v)"
                      class="relative w-11 h-6 rounded-full transition-colors duration-200"
                      [class]="showGoal() ? 'bg-primary' : 'bg-border'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                      [class]="showGoal() ? 'translate-x-5' : 'translate-x-0'"></span>
              </button>
            </div>
          }

          <!-- Error -->
          @if (publishProfileError()) {
            <p class="text-danger text-[12px] font-body text-center">{{ publishProfileError() }}</p>
          } @else if (error()) {
            <p class="text-danger text-[12px] font-body text-center">{{ error() }}</p>
          }
      </div>

      <!-- Loading overlay -->
      @if (publishing()) {
        <div class="absolute inset-0 bg-bg/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
          <div class="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2.5" stroke-linecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <p class="text-[13px] font-body text-primary">{{ photoFile() ? 'Enviando foto...' : 'Publicando...' }}</p>
        </div>
      }
    </div>
  `,

})
export class NewPostModalComponent {
  private postService    = inject(PostService);
  private workoutService = inject(WorkoutService);
  auth                   = inject(AuthService);
  ranking                = inject(RankingService);

  title = input('Novo post');
  prefillCaption = input('');
  prefillWorkout = input<WorkoutOption | null>(null);
  prefillSummary = input<WorkoutPostPrefillSummary | null>(null);

  onClose   = output<void>();
  onPublish = output<WorkoutPost>();

  photoFile        = signal<File | null>(null);
  photoPreview     = signal('');
  cropSrc          = signal<string | null>(null);
  cropMode         = signal<'square' | 'story' | null>(null);
  showFormatPicker = signal(false);
  autoGeneratedVisual = signal(false);
  caption          = '';
  selectedWorkout  = signal<WorkoutOption | null>(null);
  showGoal         = signal(true);
  workoutsDone     = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));
  selectedCaptionOption = signal('manual');
  generatedCaptionLabel = signal('');

  publishing = signal(false);
  error      = signal('');
  private captionTouched = false;
  private workoutTouched = false;
  private photoManuallyManaged = false;
  private autoArtworkAttemptedKey = '';

  constructor() {
    effect(() => {
      const initialCaption = this.prefillCaption();
      const initialWorkout = this.prefillWorkout();
      const options = this.captionOptions();

      if (!this.captionTouched && !this.caption && initialCaption) {
        this.caption = initialCaption;
      }

      if (!this.workoutTouched && !this.selectedWorkout() && initialWorkout) {
        this.selectedWorkout.set(initialWorkout);
      }
    });

    effect(() => {
      const summary = this.prefillSummary();
      const currentPhoto = this.photoFile();

      if (!summary || currentPhoto || this.photoManuallyManaged) {
        return;
      }

      const artworkKey = this.buildArtworkKey(summary);
      if (this.autoArtworkAttemptedKey === artworkKey) {
        return;
      }

      this.autoArtworkAttemptedKey = artworkKey;
      void this.generateChallengeArtwork(summary);
    });
  }

  workoutOptions = computed<WorkoutOption[]>(() => {
    const today = this.workoutService.todayWorkout();
    const program = this.workoutService.program();
    const opts: WorkoutOption[] = [];
    const seen = new Set<string>();

    if (today) {
      opts.push({ name: today.name, muscleGroup: today.muscleGroup });
      seen.add(today.name);
    }
    if (program) {
      for (const p of program.plans) {
        if (!seen.has(p.name)) {
          opts.push({ name: p.name, muscleGroup: p.muscleGroup });
          seen.add(p.name);
        }
      }
    }
    return opts;
  });

  captionOptions = computed<CaptionOption[]>(() => {
    const summary = this.prefillSummary();
    const workout = this.prefillWorkout();
    if (!summary || !workout) return [];

    const options: CaptionOption[] = [];
    let variant = 1;

    for (const hook of CAPTION_HOOKS) {
      for (const metric of CAPTION_METRICS) {
        const closer = CAPTION_CLOSERS[(variant - 1) % CAPTION_CLOSERS.length];
        options.push({
          id: `provocation-${variant}`,
          label: `Provocação ${String(variant).padStart(2, '0')}`,
          value: [
            hook,
            `${summary.title} • ${workout.muscleGroup}.`,
            metric(summary),
            closer,
          ].join('\n'),
        });
        variant++;
        if (options.length === 40) return options;
      }
    }

    return options;
  });

  publishProfileError = computed(() => this.postService.canCreatePost() ? '' : this.postService.createPostRequirementMessage());

  canPublish(): boolean {
    return this.postService.canCreatePost() && (!!this.photoFile() || !!this.caption.trim() || !!this.selectedWorkout());
  }

  muscleEmoji(mg: string): string {
    return MUSCLE_EMOJI[mg] ?? '💪';
  }

  isSelected(opt: WorkoutOption): boolean {
    return this.selectedWorkout()?.name === opt.name;
  }

  toggleWorkout(opt: WorkoutOption): void {
    this.workoutTouched = true;
    this.selectedWorkout.set(this.isSelected(opt) ? null : opt);
  }

  onCaptionChange(value: string): void {
    this.captionTouched = true;
    this.selectedCaptionOption.set('manual');
    this.generatedCaptionLabel.set('');
    this.caption = value;
  }

  setManualCaptionMode(): void {
    this.captionTouched = true;
    this.selectedCaptionOption.set('manual');
    this.generatedCaptionLabel.set('');
    this.caption = '';
  }

  generateCaption(): void {
    const options = this.captionOptions();
    if (options.length === 0) return;

    const current = this.selectedCaptionOption();
    let next = options[Math.floor(Math.random() * options.length)];

    if (options.length > 1) {
      while (next.id === current) {
        next = options[Math.floor(Math.random() * options.length)];
      }
    }

    this.captionTouched = true;
    this.selectedCaptionOption.set(next.id);
    this.generatedCaptionLabel.set(next.label);
    this.caption = next.value;
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.error.set('Foto muito grande. Máximo 10MB.'); return; }
    this.photoManuallyManaged = true;
    this.autoGeneratedVisual.set(false);
    const reader = new FileReader();
    reader.onload = e => {
      this.cropSrc.set(e.target?.result as string);
      this.showFormatPicker.set(true);
    };
    reader.readAsDataURL(file);
  }

  useOriginal(): void {
    this.photoManuallyManaged = true;
    this.autoGeneratedVisual.set(false);
    this.photoPreview.set(this.cropSrc()!);
    const dataUrl = this.cropSrc()!;
    fetch(dataUrl).then(r => r.blob()).then(blob => {
      this.photoFile.set(new File([blob], 'photo.png', { type: blob.type }));
    });
    this.showFormatPicker.set(false);
  }

  onPhotoCropped(result: { dataUrl: string; blob: Blob }): void {
    this.photoManuallyManaged = true;
    this.autoGeneratedVisual.set(false);
    this.cropMode.set(null);
    this.photoPreview.set(result.dataUrl);
    this.photoFile.set(new File([result.blob], 'photo.png', { type: 'image/png' }));
  }

  clearPhoto(): void {
    this.photoManuallyManaged = true;
    this.autoGeneratedVisual.set(false);
    this.photoFile.set(null);
    this.photoPreview.set('');
    this.cropSrc.set(null);
    this.cropMode.set(null);
  }

  async regenerateChallengeArtwork(): Promise<void> {
    const summary = this.prefillSummary();
    if (!summary) {
      return;
    }

    this.photoManuallyManaged = false;
    this.autoArtworkAttemptedKey = this.buildArtworkKey(summary);
    await this.generateChallengeArtwork(summary);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onClose.emit();
  }

  async publish(): Promise<void> {
    if (!this.canPublish() || this.publishing()) return;
    this.publishing.set(true);
    this.error.set('');

    try {
      const post = await this.postService.createPost({
        photo:   this.photoFile(),
        caption: this.caption,
        workout: this.selectedWorkout(),
      });

      // Inject yearly goal into the freshly created post if user opted in
      const profile = this.auth.profile();
      if (this.showGoal() && profile.yearly_goal) {
        post.user.yearlyGoal   = profile.yearly_goal;
        post.user.workoutsDone = this.workoutsDone();
      }

      post.streak = this.ranking.myRank()?.streakDays ?? this.workoutService.streak();

      this.onPublish.emit(post);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Erro ao publicar. Tente novamente.');
    } finally {
      this.publishing.set(false);
    }
  }

  private buildArtworkKey(summary: WorkoutPostPrefillSummary): string {
    return [
      summary.title,
      summary.muscleGroup,
      summary.durationMinutes,
      summary.exercisesDone,
      summary.totalExercises,
      summary.calories ?? 'na',
      summary.xpEarned,
      summary.completedAtLabel,
      summary.sessionLabel,
    ].join('|');
  }

  private async generateChallengeArtwork(summary: WorkoutPostPrefillSummary): Promise<void> {
    try {
      const result = await this.buildChallengeArtwork(summary);
      if (this.photoManuallyManaged) {
        return;
      }

      this.photoPreview.set(result.dataUrl);
      this.photoFile.set(result.file);
      this.autoGeneratedVisual.set(true);
    } catch {
      // If artwork generation fails, the user can still publish with caption only.
    }
  }

  private async buildChallengeArtwork(summary: WorkoutPostPrefillSummary): Promise<{ dataUrl: string; file: File }> {
    const width = 1080;
    const height = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas indisponivel.');
    }

    const profile = this.auth.profile();
    const exerciseProgress = summary.totalExercises > 0
      ? Math.min(1, summary.exercisesDone / summary.totalExercises)
      : 0;
    const todayDateLabel = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
    const dateLabel = summary.sessionLabel === 'Treino de hoje' ? todayDateLabel : summary.sessionLabel;
    const metrics = [
      { label: 'Tempo', value: `${summary.durationMinutes} min` },
      { label: 'Tipo', value: summary.workoutType },
      { label: 'Exercicios', value: `${summary.exercisesDone}/${summary.totalExercises}` },
      ...(summary.calories ? [{ label: 'Calorias', value: `${summary.calories} kcal` }] : []),
      { label: 'XP ganho', value: `+${summary.xpEarned}` },
      { label: 'Data', value: dateLabel },
    ];

    const fillRoundedRect = (x: number, y: number, rectWidth: number, rectHeight: number, radius: number, fillStyle: string) => {
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + rectWidth - radius, y);
      context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
      context.lineTo(x + rectWidth, y + rectHeight - radius);
      context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
      context.lineTo(x + radius, y + rectHeight);
      context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
      context.fillStyle = fillStyle;
      context.fill();
    };

    const strokeRoundedRect = (x: number, y: number, rectWidth: number, rectHeight: number, radius: number, strokeStyle: string, lineWidth: number) => {
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + rectWidth - radius, y);
      context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
      context.lineTo(x + rectWidth, y + rectHeight - radius);
      context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
      context.lineTo(x + radius, y + rectHeight);
      context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth) {
          current = candidate;
          continue;
        }

        if (current) {
          lines.push(current);
        }
        current = word;
      }

      if (current) {
        lines.push(current);
      }

      return lines;
    };

    const fitText = (text: string, fontFamily: string, fontWeight: string | number, maxFontSize: number, minFontSize: number, maxWidth: number) => {
      let fontSize = maxFontSize;

      while (fontSize > minFontSize) {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        if (context.measureText(text).width <= maxWidth) {
          return fontSize;
        }
        fontSize -= 2;
      }

      return minFontSize;
    };

    const drawFittedText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      options: {
        fontFamily: string;
        fontWeight: string | number;
        maxFontSize: number;
        minFontSize: number;
        color: string;
      },
    ) => {
      const fontSize = fitText(text, options.fontFamily, options.fontWeight, options.maxFontSize, options.minFontSize, maxWidth);
      context.font = `${options.fontWeight} ${fontSize}px ${options.fontFamily}`;
      context.fillStyle = options.color;
      context.fillText(text, x, y);
      return fontSize;
    };

    const drawWrappedText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      options: {
        fontFamily: string;
        fontWeight: string | number;
        maxFontSize: number;
        minFontSize: number;
        color: string;
        maxLines: number;
        lineHeight: number;
      },
    ) => {
      let fontSize = options.maxFontSize;
      let lines: string[] = [];

      while (fontSize >= options.minFontSize) {
        context.font = `${options.fontWeight} ${fontSize}px ${options.fontFamily}`;
        lines = wrapText(text, maxWidth);
        if (lines.length <= options.maxLines) {
          break;
        }
        fontSize -= 2;
      }

      const visibleLines = lines.slice(0, options.maxLines);
      if (lines.length > options.maxLines && visibleLines.length > 0) {
        const lastIndex = visibleLines.length - 1;
        let lastLine = visibleLines[lastIndex];
        while (`${lastLine}...` && context.measureText(`${lastLine}...`).width > maxWidth && lastLine.length > 0) {
          lastLine = lastLine.slice(0, -1).trim();
        }
        visibleLines[lastIndex] = `${lastLine}...`;
      }

      context.fillStyle = options.color;
      context.font = `${options.fontWeight} ${fontSize}px ${options.fontFamily}`;
      visibleLines.forEach((line, index) => {
        context.fillText(line, x, y + (index * options.lineHeight));
      });

      return { fontSize, lines: visibleLines };
    };

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#04120d');
    background.addColorStop(0.32, '#0a1720');
    background.addColorStop(0.68, '#110d1f');
    background.addColorStop(1, '#05080c');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glowTop = context.createRadialGradient(230, 140, 40, 230, 140, 420);
    glowTop.addColorStop(0, 'rgba(0,255,136,0.34)');
    glowTop.addColorStop(1, 'rgba(0,255,136,0)');
    context.fillStyle = glowTop;
    context.fillRect(0, 0, width, height);

    const glowBottom = context.createRadialGradient(900, 1020, 60, 900, 1020, 420);
    glowBottom.addColorStop(0, 'rgba(0,194,255,0.28)');
    glowBottom.addColorStop(1, 'rgba(0,194,255,0)');
    context.fillStyle = glowBottom;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.08;
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 1;
    for (let gridX = 60; gridX < width; gridX += 80) {
      context.beginPath();
      context.moveTo(gridX, 0);
      context.lineTo(gridX, height);
      context.stroke();
    }
    for (let gridY = 90; gridY < height; gridY += 80) {
      context.beginPath();
      context.moveTo(0, gridY);
      context.lineTo(width, gridY);
      context.stroke();
    }
    context.restore();

    fillRoundedRect(748, 56, 268, 52, 26, 'rgba(0,255,136,0.12)');
    strokeRoundedRect(748, 56, 268, 52, 26, 'rgba(0,255,136,0.22)', 2);
    drawFittedText(dateLabel.toUpperCase(), 778, 90, 208, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 24,
      minFontSize: 14,
      color: '#00FF88',
    });

    context.font = '900 114px "Arial Black", sans-serif';
    context.fillStyle = '#F6FAFF';
    context.fillText('TREINO', 72, 238);
    context.fillStyle = '#00FF88';
    context.fillText('CONCLUIDO', 72, 338);

    context.font = '700 34px "Arial", sans-serif';
    context.fillStyle = 'rgba(234,242,255,0.82)';
    context.fillText('RESULTADO ENTREGUE. AGORA QUERO RESPOSTA.', 74, 394);

    fillRoundedRect(64, 444, 952, 250, 38, 'rgba(8,12,16,0.56)');
    strokeRoundedRect(64, 444, 952, 250, 38, 'rgba(255,255,255,0.08)', 2);

    drawFittedText(summary.workoutType.toUpperCase(), 102, 496, 500, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 22,
      minFontSize: 14,
      color: 'rgba(0,194,255,0.95)',
    });

    drawFittedText(`+${summary.xpEarned}`, 96, 622, 360, {
      fontFamily: '"Arial Black", sans-serif',
      fontWeight: 900,
      maxFontSize: 52,
      minFontSize: 44,
      color: '#FFFFFF',
    });
    context.font = '700 36px "Arial", sans-serif';
    context.fillStyle = '#00FF88';
    context.fillText('XP GANHO', 102, 664);

    const athleteName = profile.full_name.trim() || profile.username.trim() || 'Seu treino';
    drawFittedText(athleteName.toUpperCase(), 102, 560, 500, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 22,
      minFontSize: 14,
      color: 'rgba(234,242,255,0.78)',
    });

    fillRoundedRect(654, 486, 320, 170, 30, 'rgba(255,255,255,0.04)');
    strokeRoundedRect(654, 486, 320, 170, 30, 'rgba(255,255,255,0.12)', 2);
    drawFittedText('EXECUCAO DO TREINO', 686, 526, 236, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 18,
      minFontSize: 12,
      color: 'rgba(234,242,255,0.75)',
    });
    context.font = '900 74px "Arial Black", sans-serif';
    context.fillStyle = '#FFFFFF';
    context.fillText(`${Math.round(exerciseProgress * 100)}%`, 682, 610);

    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(686, 626, 256, 12);
    context.fillStyle = '#00FF88';
    context.fillRect(686, 626, 256 * exerciseProgress, 12);

    drawFittedText(`${summary.exercisesDone}/${summary.totalExercises} exercicios fechados`, 686, 662, 236, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 18,
      minFontSize: 12,
      color: 'rgba(234,242,255,0.82)',
    });

    drawWrappedText(summary.title.toUpperCase(), 74, 790, 932, {
      fontFamily: '"Arial Black", sans-serif',
      fontWeight: 800,
      maxFontSize: 52,
      minFontSize: 28,
      color: '#FFFFFF',
      maxLines: 2,
      lineHeight: 62,
    });

    drawFittedText(`${summary.muscleGroup.toUpperCase()}  •  ${summary.difficulty.toUpperCase()}  •  ${summary.completedAtLabel}`, 76, 918, 928, {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700,
      maxFontSize: 26,
      minFontSize: 16,
      color: 'rgba(234,242,255,0.68)',
    });

    const columns = 3;
    const cardWidth = 286;
    const gap = 28;
    const startX = 72;
    const startY = 972;
    metrics.forEach((metric, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * 126;
      fillRoundedRect(x, y, cardWidth, 98, 28, 'rgba(255,255,255,0.05)');
      strokeRoundedRect(x, y, cardWidth, 98, 28, 'rgba(255,255,255,0.1)', 2);
      drawFittedText(metric.label.toUpperCase(), x + 24, y + 34, cardWidth - 48, {
        fontFamily: '"Arial", sans-serif',
        fontWeight: 700,
        maxFontSize: 18,
        minFontSize: 12,
        color: 'rgba(0,255,136,0.82)',
      });
      drawWrappedText(metric.value.toUpperCase(), x + 24, y + 68, cardWidth - 48, {
        fontFamily: '"Arial Black", sans-serif',
        fontWeight: 800,
        maxFontSize: 32,
        minFontSize: 18,
        color: '#F5FAFF',
        maxLines: 2,
        lineHeight: 28,
      });
    });

    context.font = '700 20px "Arial", sans-serif';
    context.fillStyle = 'rgba(234,242,255,0.62)';
    context.fillText('Post gerado automaticamente pelo Repify para desafiar o feed.', 74, 1288);

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(createdBlob => {
        if (createdBlob) {
          resolve(createdBlob);
          return;
        }

        reject(new Error('Falha ao gerar imagem.'));
      }, 'image/png');
    });

    return {
      dataUrl,
      file: new File([blob], 'repify-challenge.png', { type: 'image/png' }),
    };
  }
}
