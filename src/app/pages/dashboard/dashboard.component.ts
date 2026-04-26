import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutService, LEVELS, ACHIEVEMENTS, WorkoutSession } from '../../core/services/workout.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';

const MOTIVATIONAL: string[] = [
  'O corpo conquista o que a mente acredita. 💪',
  'Cada treino te deixa mais perto da melhor versão de você.',
  'Disciplina é a ponte entre objetivos e conquistas. 🔥',
  'Ninguém se arrependeu de ter treinado.',
  'Seu futuro eu vai agradecer. ⚡',
  'Consistência bate intensidade todo dia.',
  'A dor de hoje é o poder de amanhã. 👊',
  'Não pare quando estiver cansado. Pare quando terminar.',
  'Cada rep conta. Cada série importa. 🏋️',
  'Você é mais forte do que pensa.',
];

const MUSCLE_EMOJI: Record<string, string> = {
  peito:'🫁', costas:'🔙', pernas:'🦵', ombros:'💪',
  biceps:'💪', triceps:'🤜', abdomen:'⚡', full:'🔥',
};

const MUSCLE_GRADIENT: Record<string, string> = {
  peito:  'from-blue-500/20 to-blue-600/5',
  costas: 'from-purple-500/20 to-purple-600/5',
  pernas: 'from-orange-500/20 to-orange-600/5',
  ombros: 'from-teal-500/20 to-teal-600/5',
  full:   'from-primary/15 to-primary/5',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BottomNavComponent],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto">

      <!-- Header -->
      <header class="glass border-b border-border px-4 py-3 sticky top-0 safe-top z-40">
        <h1 class="text-[18px] font-display font-bold text-white">Progresso</h1>
        <p class="text-[11px] font-body text-text-2">{{ motivational }}</p>
      </header>

      <main class="flex-1 overflow-y-auto px-4 pt-5 pb-28 space-y-5">

        <!-- ── NÍVEL + XP ── -->
        <div class="bg-card-2 border border-border rounded-2xl p-4 relative overflow-hidden">
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-[56px] opacity-[0.07] select-none">
            {{ ws.currentLevel().emoji }}
          </div>
          <div class="relative">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <span class="text-[22px]">{{ ws.currentLevel().emoji }}</span>
                <div>
                  <p class="text-[16px] font-display font-bold text-white leading-none">{{ ws.currentLevel().name }}</p>
                  <p class="text-[11px] font-body text-text-2">{{ ws.totalXp() }} XP total</p>
                </div>
              </div>
              @if (ws.nextLevel()) {
                <div class="text-right">
                  <p class="text-[11px] font-body text-text-2">próximo nível</p>
                  <p class="text-[13px] font-display font-bold text-primary">+{{ ws.xpToNextLevel() }} XP</p>
                </div>
              } @else {
                <span class="text-[11px] font-body text-primary">Nível máximo 🏆</span>
              }
            </div>
            <!-- XP bar -->
            <div class="h-2 bg-card rounded-full overflow-hidden mt-3">
              <div class="h-full rounded-full shadow-glow-sm transition-all duration-700"
                   [style.width]="ws.levelProgress() + '%'"
                   [style.background]="ws.currentLevel().color"></div>
            </div>
            @if (ws.nextLevel()) {
              <div class="flex justify-between mt-1">
                <span class="text-[10px] font-mono text-text-2">{{ ws.currentLevel().minXp }} XP</span>
                <span class="text-[10px] font-mono text-text-2">{{ ws.nextLevel()!.minXp }} XP</span>
              </div>
            }
          </div>
        </div>

        <!-- ── STATS ROW ── -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-card-2 border border-border rounded-2xl p-3 flex flex-col items-center gap-1">
            <span class="text-[24px]">🔥</span>
            <p class="text-[22px] font-display font-bold text-white leading-none">{{ ws.streak() }}</p>
            <p class="text-[10px] font-body text-text-2">dias seguidos</p>
          </div>
          <div class="bg-card-2 border border-border rounded-2xl p-3 flex flex-col items-center gap-1">
            <span class="text-[24px]">📅</span>
            <p class="text-[22px] font-display font-bold text-white leading-none">{{ ws.weekSessions() }}</p>
            <p class="text-[10px] font-body text-text-2">essa semana</p>
          </div>
          <div class="bg-card-2 border border-border rounded-2xl p-3 flex flex-col items-center gap-1">
            <span class="text-[24px]">🏋️</span>
            <p class="text-[22px] font-display font-bold text-white leading-none">{{ ws.history().length }}</p>
            <p class="text-[10px] font-body text-text-2">total treinos</p>
          </div>
        </div>

        <!-- ── CONQUISTAS ── -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-[13px] font-body font-semibold text-text-2 uppercase tracking-widest">Conquistas</h2>
            <span class="text-[11px] font-mono text-primary">{{ ws.unlockedAchievements().length }}/{{ total }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            @for (a of achievements; track a.id) {
              @if (isUnlocked(a.id)) {
                <div class="flex items-center gap-3 bg-primary/8 border border-primary/25 rounded-xl p-3">
                  <span class="text-[22px] shrink-0">{{ a.emoji }}</span>
                  <div class="min-w-0">
                    <p class="text-[12px] font-body font-semibold text-white leading-tight truncate">{{ a.name }}</p>
                    <p class="text-[10px] font-body text-text-2 leading-tight">{{ a.desc }}</p>
                  </div>
                </div>
              } @else {
                <div class="flex items-center gap-3 bg-card-2 border border-border rounded-xl p-3 opacity-40">
                  <span class="text-[22px] shrink-0 grayscale">{{ a.emoji }}</span>
                  <div class="min-w-0">
                    <p class="text-[12px] font-body font-semibold text-text-2 leading-tight truncate">{{ a.name }}</p>
                    <p class="text-[10px] font-body text-text-2/60 leading-tight">{{ a.desc }}</p>
                  </div>
                </div>
              }
            }
          </div>
        </div>

        <!-- ── HISTÓRICO ── -->
        <div>
          <h2 class="text-[13px] font-body font-semibold text-text-2 uppercase tracking-widest mb-3">Histórico</h2>

          @if (!ws.history().length) {
            @if (ws.hasProgram()) {
              <div class="bg-card-2 border border-border rounded-2xl p-6 text-center">
                <p class="text-[32px] mb-2">🎯</p>
                <p class="text-[14px] font-body font-semibold text-white mb-1">Seu programa está pronto!</p>
                <p class="text-[12px] font-body text-text-2 mb-4">
                  @if (ws.todayWorkout()) {
                    Hoje é dia de <span class="text-primary font-semibold">{{ ws.todayWorkout()!.name }}</span>. Bora treinar?
                  } @else {
                    Hoje é dia de descanso. Aproveite!
                  }
                </p>
                @if (ws.todayWorkout()) {
                  <button (click)="router.navigateByUrl('/workout/' + ws.todayWorkout()!.id)"
                          class="px-5 py-2.5 bg-primary text-bg rounded-xl font-body font-bold text-[13px] shadow-glow">
                    Iniciar treino de hoje
                  </button>
                } @else {
                  <button (click)="router.navigateByUrl('/my-workout')"
                          class="px-5 py-2.5 bg-card border border-border text-white rounded-xl font-body font-semibold text-[13px]">
                    Ver meu programa
                  </button>
                }
              </div>
            } @else {
              <div class="bg-card-2 border border-border rounded-2xl p-8 text-center">
                <p class="text-[32px] mb-2">🏋️</p>
                <p class="text-[14px] font-body font-semibold text-white mb-1">Nenhum treino ainda</p>
                <p class="text-[12px] font-body text-text-2">Monte seu programa e comece sua jornada!</p>
                <button (click)="router.navigateByUrl('/my-workout')"
                        class="mt-4 px-5 py-2.5 bg-primary text-bg rounded-xl font-body font-bold text-[13px] shadow-glow">
                  Montar meu treino
                </button>
              </div>
            }
          } @else {
            <div class="space-y-2">
              @for (session of ws.history(); track session.id) {
                <div class="flex items-center gap-3 bg-card-2 border border-border rounded-2xl p-3 bg-gradient-to-r"
                     [class]="muscleGradient(session.muscleGroup)">
                  <!-- Icon -->
                  <div class="w-10 h-10 rounded-xl bg-bg/50 flex items-center justify-center text-[20px] shrink-0">
                    {{ muscleEmoji(session.muscleGroup) }}
                  </div>
                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-body font-semibold text-white truncate">{{ session.planName }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-[10px] font-body text-text-2">{{ session.dateLabel }}</span>
                      <span class="w-px h-2.5 bg-border"></span>
                      <span class="text-[10px] font-body text-text-2">{{ session.exercisesDone }}/{{ session.totalExercises }} exerc.</span>
                      <span class="w-px h-2.5 bg-border"></span>
                      <span class="text-[10px] font-body text-text-2">{{ session.estimatedDuration }} min</span>
                    </div>
                  </div>
                  <!-- XP badge -->
                  <div class="shrink-0 flex flex-col items-center">
                    <span class="text-[13px] font-display font-bold text-primary">+{{ session.xpEarned }}</span>
                    <span class="text-[9px] font-mono text-text-2">XP</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

      </main>

      <app-bottom-nav [active]="'progress'" />
    </div>
  `,
})
export class DashboardComponent {
  ws     = inject(WorkoutService);
  router = inject(Router);

  readonly motivational = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  readonly achievements = ACHIEVEMENTS;
  readonly total        = ACHIEVEMENTS.length;

  isUnlocked(id: string): boolean {
    return this.ws.unlockedAchievements().some(a => a.id === id);
  }

  muscleEmoji(mg: string): string {
    return MUSCLE_EMOJI[mg] ?? '💪';
  }

  muscleGradient(mg: string): string {
    return MUSCLE_GRADIENT[mg] ?? MUSCLE_GRADIENT['full'];
  }
}
