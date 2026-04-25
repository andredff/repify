import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutPost } from '../../../core/models/workout-post.model';

const MUSCLE_ICONS: Record<string, string> = {
  peito:   '🫁',
  costas:  '🔙',
  pernas:  '🦵',
  ombros:  '💪',
  biceps:  '💪',
  triceps: '🤜',
  abdomen: '⚡',
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
  template: `
    <article class="bg-card-2 border border-border rounded-2xl overflow-hidden shadow-card card-hover">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <div class="flex items-center gap-3">
          <!-- Avatar (clickable -> public profile) -->
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

          <!-- Name + time -->
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-body font-semibold text-white cursor-pointer hover:text-primary transition-colors"
                    (click)="goToProfile()">{{ post().user.name }}</span>
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
        <button class="text-text-2 hover:text-white transition-colors p-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>

      <!-- Workout photo -->
      @if (post().photo) {
        <div class="mx-4 mb-3 rounded-xl overflow-hidden" style="max-height:320px">
          <img [src]="post().photo" alt="foto do treino" class="w-full h-full object-cover" />
        </div>
      }

      <!-- Workout hero banner -->
      <div class="mx-4 mb-3 rounded-xl p-3 bg-gradient-to-br border border-border relative overflow-hidden"
           [class]="muscleGradient()">

        <!-- Decorative pattern -->
        <div class="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center opacity-10">
          <span class="text-[64px] font-display font-black select-none">{{ muscleEmoji() }}</span>
        </div>

        <div class="relative">
          <!-- Workout name -->
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[10px] font-body text-text-2 uppercase tracking-widest mb-0.5">Treino concluído</p>
              <h3 class="text-[18px] font-display font-bold text-white leading-tight">{{ post().workout.name }}</h3>
            </div>
            <div class="bg-primary/20 border border-primary/30 rounded-lg px-2 py-1 text-right shrink-0">
              <p class="text-[18px] font-display font-bold text-primary leading-none">{{ post().workout.duration }}'</p>
              <p class="text-[9px] font-body text-primary/70">duração</p>
            </div>
          </div>

          <!-- Stats row -->
          <div class="flex gap-3 mt-3">
            <div class="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round">
                <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18"/>
              </svg>
              <span class="text-[12px] font-mono font-semibold text-white">{{ post().workout.totalVolume.toLocaleString('pt-BR') }}</span>
              <span class="text-[10px] text-text-2 font-body">kg vol.</span>
            </div>
            <div class="w-px bg-border"></div>
            <div class="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span class="text-[12px] font-mono font-semibold text-white">{{ post().workout.caloriesBurned }}</span>
              <span class="text-[10px] text-text-2 font-body">kcal</span>
            </div>
            <div class="w-px bg-border"></div>
            <div class="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span class="text-[12px] font-mono font-semibold text-white">{{ post().workout.exercises.length }}</span>
              <span class="text-[10px] text-text-2 font-body">exerc.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Exercises list -->
      <div class="px-4 pb-3 space-y-1">
        @for (ex of post().workout.exercises; track ex.name) {
          <div class="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0"></div>
              <span class="text-[12px] font-body text-white">{{ ex.name }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-mono text-text-2">{{ ex.sets }}×{{ ex.reps }}</span>
              @if (ex.weight) {
                <span class="text-[11px] font-mono bg-card border border-border rounded px-1.5 py-0.5 text-text-2">{{ ex.weight }}kg</span>
              }
            </div>
          </div>
        }
      </div>

      <!-- Actions footer -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-border">

        <!-- Like + Comment -->
        <div class="flex items-center gap-4">
          <button
            (click)="onLike.emit()"
            class="flex items-center gap-1.5 transition-all active:scale-90"
            [class]="post().liked ? 'text-primary' : 'text-text-2 hover:text-white'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
                 [attr.fill]="post().liked ? 'currentColor' : 'none'"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span class="text-[12px] font-body font-medium">{{ post().likes }}</span>
          </button>

          <button class="flex items-center gap-1.5 text-text-2 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="text-[12px] font-body font-medium">{{ post().comments }}</span>
          </button>
        </div>

        <!-- Share -->
        <button class="text-text-2 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </article>
  `,
})
export class WorkoutPostComponent {
  post = input.required<WorkoutPost>();
  onLike = output<void>();

  private router = inject(Router);

  goToProfile(): void {
    const username = this.post().user.username;
    const id       = this.post().user.id;
    if (username) this.router.navigateByUrl(`/u/${username}`);
    else if (id)  this.router.navigateByUrl(`/u/${id}`);
  }

  muscleEmoji(): string {
    return MUSCLE_ICONS[this.post().workout.muscleGroup] ?? '💪';
  }

  muscleGradient(): string {
    return MUSCLE_COLORS[this.post().workout.muscleGroup] ?? MUSCLE_COLORS['default'];
  }

  levelClass(): string {
    const level = this.post().user.level;
    if (level === 'Elite') return 'bg-primary/15 text-primary border border-primary/30';
    if (level === 'Pro') return 'bg-secondary/15 text-secondary border border-secondary/30';
    return 'bg-border text-text-2 border border-border-2';
  }
}
