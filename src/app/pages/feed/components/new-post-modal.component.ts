import { Component, inject, signal, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { WorkoutPost } from '../../../core/models/workout-post.model';

const MUSCLE_EMOJI: Record<string, string> = {
  peito:'🫁', costas:'🔙', pernas:'🦵', ombros:'🏔️',
  biceps:'💪', triceps:'🤜', abdomen:'⚡', full:'🔥',
};

interface WorkoutOption {
  name: string;
  muscleGroup: string;
}

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex flex-col max-w-[430px] mx-auto bg-card animate-slide-up">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 border-b border-border shrink-0"
           style="padding-top: calc(env(safe-area-inset-top) + 12px); padding-bottom: 12px">
        <button (click)="onClose.emit()" class="text-text-2 hover:text-white transition-colors text-[13px] font-body">
          Cancelar
        </button>
        <p class="text-[14px] font-body font-semibold text-white">Novo post</p>
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

          <!-- Caption -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Descrição</label>
            <textarea
              [(ngModel)]="caption"
              placeholder="Conte como foi o treino..."
              rows="3"
              maxlength="300"
              class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none resize-none focus:border-primary/60 placeholder:text-muted transition-colors">
            </textarea>
            <p class="text-[10px] text-text-2 text-right">{{ caption.length }}/300</p>
          </div>

          <!-- Workout selector (optional) -->
          <div class="space-y-2">
            <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">
              Marcar treino do dia <span class="text-text-2/60 normal-case">(opcional)</span>
            </label>

            @if (workoutOptions().length > 0) {
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

  onClose   = output<void>();
  onPublish = output<WorkoutPost>();

  photoFile     = signal<File | null>(null);
  photoPreview  = signal('');
  caption       = '';
  selectedWorkout = signal<WorkoutOption | null>(null);

  publishing = signal(false);
  error      = signal('');

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
    this.selectedWorkout.set(this.isSelected(opt) ? null : opt);
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

      this.onPublish.emit(post);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Erro ao publicar. Tente novamente.');
    } finally {
      this.publishing.set(false);
    }
  }
}
