import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService, NewPostData } from '../../../core/services/post.service';
import { WorkoutPost, WorkoutExercise } from '../../../core/models/workout-post.model';

const MUSCLE_GROUPS = [
  { value: 'peito',   label: 'Peito',   emoji: '🫁' },
  { value: 'costas',  label: 'Costas',  emoji: '🔙' },
  { value: 'pernas',  label: 'Pernas',  emoji: '🦵' },
  { value: 'ombros',  label: 'Ombros',  emoji: '🏔️' },
  { value: 'biceps',  label: 'Bíceps',  emoji: '💪' },
  { value: 'triceps', label: 'Tríceps', emoji: '🤜' },
  { value: 'abdomen', label: 'Abdômen', emoji: '⚡' },
  { value: 'full',    label: 'Full Body',emoji: '🔥' },
];

type Step = 'photo' | 'workout' | 'exercises' | 'preview';

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex items-end justify-center"
         (click)="onBackdrop($event)">

      <!-- Sheet -->
      <div class="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-3xl overflow-hidden animate-slide-up"
           style="max-height:92dvh"
           (click)="$event.stopPropagation()">

        <!-- Handle bar -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 bg-border-2 rounded-full"></div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border">
          <button (click)="back()" class="text-text-2 hover:text-white transition-colors text-[13px] font-body">
            @if (step() === 'photo') { Cancelar } @else { Voltar }
          </button>
          <p class="text-[14px] font-body font-semibold text-white">Novo post</p>
          <button
            (click)="next()"
            [disabled]="!canAdvance()"
            class="text-[13px] font-body font-semibold transition-colors disabled:opacity-30"
            [class]="step() === 'preview' ? 'text-primary' : 'text-primary'">
            {{ step() === 'preview' ? 'Publicar' : 'Próximo' }}
          </button>
        </div>

        <!-- Step indicator -->
        <div class="flex gap-1 px-5 pt-3">
          @for (s of steps; track s) {
            <div class="flex-1 h-0.5 rounded-full transition-all"
                 [class]="stepIndex() >= $index ? 'bg-primary' : 'bg-border'"></div>
          }
        </div>

        <!-- Scrollable content -->
        <div class="overflow-y-auto" style="max-height: calc(92dvh - 130px)">

          <!-- ── STEP 1: Foto ── -->
          @if (step() === 'photo') {
            <div class="p-5 space-y-4">

              <!-- Hidden file input -->
              <input #photoInput type="file" accept="image/*" class="hidden" (change)="onPhotoSelected($event)" />

              <!-- Photo area -->
              @if (photoPreview()) {
                <div class="relative rounded-2xl overflow-hidden aspect-square bg-card-2">
                  <img [src]="photoPreview()" class="w-full h-full object-cover" />
                  <button
                    (click)="clearPhoto()"
                    class="absolute top-3 right-3 w-8 h-8 bg-bg/80 rounded-full flex items-center justify-center text-white hover:bg-bg transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              } @else {
                <button
                  (click)="photoInput.click()"
                  class="w-full aspect-square bg-card-2 border-2 border-dashed border-border-2 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all group">
                  <div class="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div class="text-center">
                    <p class="text-[14px] font-body font-semibold text-white group-hover:text-primary transition-colors">Adicionar foto</p>
                    <p class="text-[11px] text-text-2 font-body mt-0.5">JPG, PNG ou WEBP · máx 10MB</p>
                  </div>
                </button>
              }

              <!-- Caption -->
              <div class="space-y-1.5">
                <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Legenda</label>
                <textarea
                  [(ngModel)]="caption"
                  placeholder="Conte como foi o treino..."
                  rows="3"
                  maxlength="300"
                  class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none resize-none focus:border-primary/60 placeholder:text-muted transition-colors">
                </textarea>
                <p class="text-[10px] text-text-2 text-right">{{ caption.length }}/300</p>
              </div>

              <!-- Skip photo hint -->
              <p class="text-[11px] text-text-2 font-body text-center">
                A foto é opcional — você pode postar só o treino
              </p>
            </div>
          }

          <!-- ── STEP 2: Workout info ── -->
          @if (step() === 'workout') {
            <div class="p-5 space-y-5">

              <!-- Workout name -->
              <div class="space-y-1.5">
                <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Nome do treino</label>
                <input
                  type="text"
                  [(ngModel)]="workoutName"
                  placeholder="Ex: Peito + Tríceps"
                  maxlength="60"
                  class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none focus:border-primary/60 placeholder:text-muted transition-colors"
                />
              </div>

              <!-- Muscle group -->
              <div class="space-y-2">
                <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Grupo muscular</label>
                <div class="grid grid-cols-4 gap-2">
                  @for (mg of muscleGroups; track mg.value) {
                    <button
                      type="button"
                      (click)="muscleGroup = mg.value"
                      class="flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all"
                      [class]="muscleGroup === mg.value
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-glow-sm'
                        : 'border-border bg-card-2 text-text-2 hover:border-border-2'">
                      <span class="text-lg">{{ mg.emoji }}</span>
                      <span class="text-[9px] font-body font-medium leading-tight text-center">{{ mg.label }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Duration + Calories side by side -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Duração</label>
                  <div class="relative">
                    <input type="number" [(ngModel)]="duration" min="1" max="300" placeholder="60"
                           class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none focus:border-primary/60 placeholder:text-muted transition-colors pr-10" />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">min</span>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Calorias</label>
                  <div class="relative">
                    <input type="number" [(ngModel)]="calories" min="0" max="9999" placeholder="400"
                           class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none focus:border-primary/60 placeholder:text-muted transition-colors pr-12" />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">kcal</span>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- ── STEP 3: Exercícios ── -->
          @if (step() === 'exercises') {
            <div class="p-5 space-y-4">

              <div class="flex items-center justify-between">
                <p class="text-[13px] font-body font-semibold text-white">Exercícios</p>
                <button
                  (click)="addExercise()"
                  class="flex items-center gap-1 text-[12px] font-body text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Adicionar
                </button>
              </div>

              @if (exercises().length === 0) {
                <div class="flex flex-col items-center justify-center py-8 gap-3 bg-card-2 rounded-2xl border border-border">
                  <span class="text-2xl">🏋️</span>
                  <p class="text-[12px] text-text-2 font-body">Adicione pelo menos um exercício</p>
                </div>
              }

              @for (ex of exercises(); track $index; let i = $index) {
                <div class="bg-card-2 border border-border rounded-xl p-3 space-y-3 animate-fade-in">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-mono text-text-2">Exercício {{ i + 1 }}</span>
                    <button (click)="removeExercise(i)" class="text-text-2 hover:text-danger transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <input type="text" [(ngModel)]="exercises()[i].name" placeholder="Nome do exercício"
                         class="w-full bg-card border border-border rounded-lg px-3 py-2 text-[13px] font-body outline-none focus:border-primary/60 placeholder:text-muted transition-colors" />

                  <div class="grid grid-cols-3 gap-2">
                    <div class="space-y-1">
                      <label class="text-[9px] font-body text-text-2 uppercase tracking-wider">Séries</label>
                      <input type="number" [(ngModel)]="exercises()[i].sets" min="1" max="20" placeholder="4"
                             class="w-full bg-card border border-border rounded-lg px-2 py-2 text-[13px] font-body outline-none focus:border-primary/60 text-center" />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[9px] font-body text-text-2 uppercase tracking-wider">Reps</label>
                      <input type="number" [(ngModel)]="exercises()[i].reps" min="1" max="100" placeholder="12"
                             class="w-full bg-card border border-border rounded-lg px-2 py-2 text-[13px] font-body outline-none focus:border-primary/60 text-center" />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[9px] font-body text-text-2 uppercase tracking-wider">Peso (kg)</label>
                      <input type="number" [(ngModel)]="exercises()[i].weight" min="0" max="999" placeholder="—"
                             class="w-full bg-card border border-border rounded-lg px-2 py-2 text-[13px] font-body outline-none focus:border-primary/60 text-center" />
                    </div>
                  </div>
                </div>
              }

              <!-- Volume calculado -->
              @if (exercises().length > 0 && totalVolume() > 0) {
                <div class="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                  <span class="text-[12px] font-body text-text-2">Volume total calculado</span>
                  <span class="text-[14px] font-mono font-bold text-primary">{{ totalVolume().toLocaleString('pt-BR') }} kg</span>
                </div>
              }
            </div>
          }

          <!-- ── STEP 4: Preview ── -->
          @if (step() === 'preview') {
            <div class="p-5 space-y-4">
              <p class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Pré-visualização</p>

              <!-- Photo preview -->
              @if (photoPreview()) {
                <div class="rounded-2xl overflow-hidden aspect-video bg-card-2">
                  <img [src]="photoPreview()" class="w-full h-full object-cover" />
                </div>
              }

              <!-- Caption -->
              @if (caption) {
                <p class="text-[13px] font-body text-white leading-relaxed">{{ caption }}</p>
              }

              <!-- Workout card preview -->
              <div class="bg-card-2 border border-border rounded-xl p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] text-text-2 font-body uppercase tracking-widest">Treino concluído</p>
                    <p class="text-[17px] font-display font-bold text-white">{{ workoutName || 'Sem nome' }}</p>
                  </div>
                  <div class="bg-primary/20 border border-primary/30 rounded-lg px-2 py-1 text-right">
                    <p class="text-[16px] font-display font-bold text-primary leading-none">{{ duration || 0 }}'</p>
                    <p class="text-[9px] font-body text-primary/70">duração</p>
                  </div>
                </div>
                <div class="flex gap-4 text-[12px] font-body text-text-2">
                  <span class="font-mono font-semibold text-white">{{ totalVolume().toLocaleString('pt-BR') }}</span> kg vol.
                  <span>·</span>
                  <span class="font-mono font-semibold text-white">{{ calories || 0 }}</span> kcal
                  <span>·</span>
                  <span class="font-mono font-semibold text-white">{{ exercises().length }}</span> exerc.
                </div>
              </div>

              <!-- Error -->
              @if (error()) {
                <p class="text-danger text-[12px] font-body text-center">{{ error() }}</p>
              }
            </div>
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
    </div>
  `,
})
export class NewPostModalComponent {
  private postService = inject(PostService);

  onClose   = output<void>();
  onPublish = output<WorkoutPost>();

  // Steps
  readonly steps: Step[] = ['photo', 'workout', 'exercises', 'preview'];
  step      = signal<Step>('photo');
  stepIndex = signal(0);

  // Photo
  photoFile    = signal<File | null>(null);
  photoPreview = signal('');
  caption      = '';

  // Workout
  muscleGroups = MUSCLE_GROUPS;
  workoutName  = '';
  muscleGroup  = '';
  duration     = 60;
  calories     = 0;

  // Exercises
  exercises = signal<WorkoutExercise[]>([]);

  // State
  publishing = signal(false);
  error      = signal('');

  totalVolume = () => {
    return this.exercises().reduce((sum, ex) => {
      return sum + (ex.sets * ex.reps * (ex.weight ?? 0));
    }, 0);
  };

  canAdvance(): boolean {
    if (this.step() === 'photo')      return true; // photo is optional
    if (this.step() === 'workout')    return !!this.workoutName.trim() && !!this.muscleGroup && this.duration > 0;
    if (this.step() === 'exercises')  return this.exercises().length > 0;
    if (this.step() === 'preview')    return !this.publishing();
    return false;
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.error.set('Foto muito grande. Máximo 10MB.'); return; }
    this.photoFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.photoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  clearPhoto(): void {
    this.photoFile.set(null);
    this.photoPreview.set('');
  }

  addExercise(): void {
    this.exercises.update(list => [...list, { name: '', sets: 3, reps: 12, weight: undefined }]);
  }

  removeExercise(index: number): void {
    this.exercises.update(list => list.filter((_, i) => i !== index));
  }

  next(): void {
    if (!this.canAdvance()) return;

    if (this.step() === 'preview') {
      this.publish();
      return;
    }

    const idx = this.steps.indexOf(this.step());
    this.step.set(this.steps[idx + 1]);
    this.stepIndex.set(idx + 1);
  }

  back(): void {
    const idx = this.steps.indexOf(this.step());
    if (idx === 0) { this.onClose.emit(); return; }
    this.step.set(this.steps[idx - 1]);
    this.stepIndex.set(idx - 1);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onClose.emit();
  }

  private async publish(): Promise<void> {
    this.publishing.set(true);
    this.error.set('');

    try {
      const post = await this.postService.createPost({
        photo:   this.photoFile(),
        caption: this.caption,
        workout: {
          name:          this.workoutName,
          muscleGroup:   this.muscleGroup,
          duration:      this.duration,
          exercises:     this.exercises().filter(e => e.name.trim()),
          totalVolume:   this.totalVolume(),
          caloriesBurned: this.calories,
        },
      });

      this.onPublish.emit(post);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Erro ao publicar. Tente novamente.');
    } finally {
      this.publishing.set(false);
    }
  }
}

type WorkoutExercise = import('../../../core/models/workout-post.model').WorkoutExercise;
