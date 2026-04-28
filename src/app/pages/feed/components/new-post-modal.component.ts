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
  durationMinutes: number;
  exercisesDone: number;
  totalExercises: number;
  xpEarned: number;
  completedAtLabel: string;
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
          @if (error()) {
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

  canPublish(): boolean {
    return !!this.photoFile() || !!this.caption.trim() || !!this.selectedWorkout();
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
    const reader = new FileReader();
    reader.onload = e => {
      this.cropSrc.set(e.target?.result as string);
      this.showFormatPicker.set(true);
    };
    reader.readAsDataURL(file);
  }

  useOriginal(): void {
    this.photoPreview.set(this.cropSrc()!);
    const dataUrl = this.cropSrc()!;
    fetch(dataUrl).then(r => r.blob()).then(blob => {
      this.photoFile.set(new File([blob], 'photo.png', { type: blob.type }));
    });
    this.showFormatPicker.set(false);
  }

  onPhotoCropped(result: { dataUrl: string; blob: Blob }): void {
    this.cropMode.set(null);
    this.photoPreview.set(result.dataUrl);
    this.photoFile.set(new File([result.blob], 'photo.png', { type: 'image/png' }));
  }

  clearPhoto(): void {
    this.photoFile.set(null);
    this.photoPreview.set('');
    this.cropSrc.set(null);
    this.cropMode.set(null);
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
}
