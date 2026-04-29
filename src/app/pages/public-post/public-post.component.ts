import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface PublicPostUser {
  id: string;
  name: string;
  username: string | null;
  avatar: string;
  level: string;
  workouts_done: number;
  streak_days: number;
  total_xp: number;
}

interface PublicPost {
  id: string;
  caption: string | null;
  photo_url: string | null;
  photo_url_medium: string | null;
  photo_url_thumb: string | null;
  workout: { name: string; muscleGroup: string } | null;
  likes: number;
  comments: number;
  time_ago: string;
  user: PublicPostUser;
}

interface WorkoutLine {
  name: string;
  muscle: string;
  prescription: string;
}

interface WorkoutBlueprint {
  heroTag: string;
  title: string;
  exercises: WorkoutLine[];
  duration: number;
  calories: number;
  heartRate: number;
}

interface XpTier {
  label: string;
  min: number;
  max: number;
  level: number;
}

const MUSCLE_ICONS: Record<string, string> = {
  peito: '🫁', costas: '🔙', pernas: '🦵', ombros: '💪',
  biceps: '💪', triceps: '🤜', abdomen: '⚡', full: '🔥',
};

const LEVEL_COLORS: Record<string, string> = {
  'Elite':         'text-primary bg-primary/10 border-primary/30',
  'Pro':           'text-primary bg-primary/10 border-primary/25',
  'Avançado':      'text-primary bg-primary/10 border-primary/20',
  'Intermediário': 'text-primary bg-primary/10 border-primary/30',
  'Iniciante':     'text-text-2 bg-white/5 border-border',
};

const XP_TIERS: XpTier[] = [
  { label: 'Iniciante', min: 0, max: 200, level: 1 },
  { label: 'Intermediário', min: 200, max: 500, level: 2 },
  { label: 'Avançado', min: 500, max: 900, level: 3 },
  { label: 'Pro', min: 900, max: 1500, level: 4 },
  { label: 'Elite', min: 1500, max: 2200, level: 5 },
  { label: 'Legend', min: 2200, max: 3200, level: 6 },
];

const WORKOUT_BLUEPRINTS: Record<string, WorkoutBlueprint> = {
  peito: {
    heroTag: 'Upper Body Session',
    title: 'Upper Body',
    duration: 45,
    calories: 486,
    heartRate: 148,
    exercises: [
      { name: 'Supino reto', muscle: 'Peito', prescription: '3x10' },
      { name: 'Remada curvada', muscle: 'Costas', prescription: '3x10' },
      { name: 'Desenvolvimento', muscle: 'Ombros', prescription: '3x12' },
      { name: 'Crucifixo inclinado', muscle: 'Peito', prescription: '3x12' },
      { name: 'Tríceps corda', muscle: 'Tríceps', prescription: '3x12' },
    ],
  },
  costas: {
    heroTag: 'Pull Day Session',
    title: 'Upper Body',
    duration: 47,
    calories: 452,
    heartRate: 145,
    exercises: [
      { name: 'Puxada frente', muscle: 'Costas', prescription: '4x10' },
      { name: 'Remada curvada', muscle: 'Costas', prescription: '3x10' },
      { name: 'Rosca direta', muscle: 'Bíceps', prescription: '3x12' },
      { name: 'Rosca martelo', muscle: 'Bíceps', prescription: '3x12' },
      { name: 'Face pull', muscle: 'Deltoide', prescription: '3x15' },
    ],
  },
  pernas: {
    heroTag: 'Leg Day Session',
    title: 'Lower Body',
    duration: 52,
    calories: 564,
    heartRate: 154,
    exercises: [
      { name: 'Agachamento livre', muscle: 'Quadríceps', prescription: '4x8' },
      { name: 'Leg press', muscle: 'Quadríceps', prescription: '4x12' },
      { name: 'Stiff', muscle: 'Posterior', prescription: '3x10' },
      { name: 'Afundo', muscle: 'Glúteos', prescription: '3x12' },
      { name: 'Panturrilha', muscle: 'Panturrilha', prescription: '4x20' },
    ],
  },
  ombros: {
    heroTag: 'Shoulder Session',
    title: 'Upper Body',
    duration: 42,
    calories: 418,
    heartRate: 142,
    exercises: [
      { name: 'Desenvolvimento militar', muscle: 'Ombros', prescription: '4x10' },
      { name: 'Elevação lateral', muscle: 'Ombros', prescription: '3x15' },
      { name: 'Crucifixo invertido', muscle: 'Posterior', prescription: '3x15' },
      { name: 'Encolhimento', muscle: 'Trapézio', prescription: '3x12' },
      { name: 'Flexão pike', muscle: 'Ombros', prescription: '3x10' },
    ],
  },
  full: {
    heroTag: 'Full Body Session',
    title: 'Full Body',
    duration: 50,
    calories: 528,
    heartRate: 151,
    exercises: [
      { name: 'Burpee controlado', muscle: 'Full body', prescription: '3x12' },
      { name: 'Supino reto', muscle: 'Peito', prescription: '3x10' },
      { name: 'Remada curvada', muscle: 'Costas', prescription: '3x10' },
      { name: 'Agachamento', muscle: 'Pernas', prescription: '4x10' },
      { name: 'Prancha', muscle: 'Core', prescription: '3x45s' },
    ],
  },
};

const DEFAULT_BLUEPRINT: WorkoutBlueprint = {
  heroTag: 'Repify Training Session',
  title: 'Treino de hoje',
  duration: 45,
  calories: 470,
  heartRate: 146,
  exercises: [
    { name: 'Supino reto', muscle: 'Peito', prescription: '3x10' },
    { name: 'Remada curvada', muscle: 'Costas', prescription: '3x10' },
    { name: 'Desenvolvimento', muscle: 'Ombros', prescription: '3x12' },
    { name: 'Agachamento goblet', muscle: 'Pernas', prescription: '3x12' },
    { name: 'Prancha', muscle: 'Core', prescription: '3x45s' },
  ],
};

const SOCIAL_PROOF = [
  { name: 'LA', color: 'linear-gradient(135deg, #00FF88, #24F59A)' },
  { name: 'MK', color: 'linear-gradient(135deg, #0EEA86, #00FF88)' },
  { name: 'TR', color: 'linear-gradient(135deg, #00FF88, #19E391)' },
  { name: 'SA', color: 'linear-gradient(135deg, #18E08F, #00FF88)' },
];

@Component({
  selector: 'app-public-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    <div class="public-post-shell min-h-screen overflow-hidden bg-bg text-white">
      <div class="pointer-events-none absolute inset-0 opacity-80">
        <div class="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full blur-3xl"
             style="background: radial-gradient(circle, rgba(0,255,136,0.16), rgba(0,255,136,0));"></div>
        <div class="absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full blur-3xl"
             style="background: radial-gradient(circle, rgba(0,194,255,0.09), rgba(0,194,255,0));"></div>
        <div class="absolute inset-0 bg-noise opacity-40"></div>
      </div>

      <header class="relative z-20 border-b border-primary/15 bg-[rgba(6,10,14,0.72)] backdrop-blur-xl">
        <div class="mx-auto flex w-full max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-10"
             style="padding-top: calc(16px + env(safe-area-inset-top));">
          <div class="flex items-center gap-3">
            <div class="flex h-11 min-w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 px-3 shadow-glow">
              <img ngSrc="/logo-transparent.png"
                   width="92"
                   height="28"
                   alt="Repify"
                   class="h-6 w-auto object-contain"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
              <span class="hidden font-display text-[16px] font-bold tracking-[0.18em] text-primary">REPIFY</span>
            </div>
            <div>
              <p class="text-[10px] font-body uppercase tracking-[0.34em] text-primary/70">Repify challenge</p>
              <!-- <p class="font-display text-[20px] font-bold tracking-[0.06em] text-white">PUBLIC SHARE</p> -->
            </div>
          </div>

          <div class="hidden items-center gap-3 lg:flex">
            <p class="text-[12px] font-body text-text-2">Treine, pontue, suba no ranking.</p>
            <button type="button"
                    (click)="goToLogin()"
                    class="rounded-full border border-primary/15 bg-white/[0.03] px-4 py-2 text-[12px] font-body font-semibold text-white transition-all hover:border-primary/30 hover:bg-white/[0.05]">
              Entrar
            </button>
            <button type="button"
                    (click)="goToRegister()"
                    class="rounded-full bg-primary px-5 py-2.5 text-[12px] font-body font-bold text-bg shadow-glow transition-all hover:scale-[1.02] hover:shadow-[0_0_34px_rgba(0,255,136,0.38)]">
              Aceitar desafio
            </button>
          </div>

          <button type="button"
                  (click)="goToRegister()"
                  class="rounded-full bg-primary px-4 py-2 text-[12px] font-body font-bold text-bg shadow-glow lg:hidden">
            Cadastrar
          </button>
        </div>
      </header>

      <main class="relative z-10 mx-auto grid w-full max-w-[1380px] gap-6 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:px-8 lg:pt-8 xl:px-10">

      <!-- Loading -->
      @if (loading()) {
        <div class="grid gap-6 lg:col-span-2 lg:grid-cols-[1.08fr_0.92fr] animate-pulse">
          <div class="h-[420px] rounded-[32px] border border-primary/15 bg-card"></div>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div class="h-40 rounded-[28px] border border-primary/15 bg-card"></div>
            <div class="h-40 rounded-[28px] border border-primary/15 bg-card"></div>
            <div class="h-48 rounded-[28px] border border-primary/15 bg-card md:col-span-2 lg:col-span-1"></div>
          </div>
        </div>
      }

      <!-- Error -->
      @else if (error()) {
        <div class="lg:col-span-2 flex min-h-[72vh] flex-col items-center justify-center gap-5 rounded-[34px] border border-primary/15 bg-[linear-gradient(180deg,rgba(19,28,38,0.95),rgba(8,12,16,1))] px-6 text-center shadow-card">
          <div class="flex h-20 w-20 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-4xl">⚠</div>
          <div class="space-y-2">
            <p class="font-display text-[28px] font-black tracking-tight text-white">Post não encontrado</p>
            <p class="mx-auto max-w-[460px] text-[14px] font-body leading-relaxed text-text-2">Esse link pode ter expirado ou o treino já foi removido. Entre no Repify para publicar seus próprios desafios e acompanhar seu ranking.</p>
          </div>
          <button type="button"
                  (click)="goToRegister()"
                  class="rounded-full bg-primary px-7 py-3.5 text-[14px] font-body font-bold text-bg shadow-glow transition-all hover:scale-[1.02]">
            Criar conta grátis
          </button>
        </div>
      }

      <!-- Post -->
      @else if (post()) {
        <section class="space-y-6 lg:sticky lg:top-[92px] lg:self-start">
          <article class="cinema-card group relative overflow-hidden rounded-[34px] border border-primary/15 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
            <div class="absolute inset-0">
              @if (post()!.photo_url) {
                <img [src]="post()!.photo_url" alt="Foto do treino de {{ post()!.user.name }}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              } @else {
                <div class="h-full w-full"
                style="background: radial-gradient(circle at 20% 10%, rgba(0,255,136,0.26), transparent 30%), radial-gradient(circle at 78% 28%, rgba(0,194,255,0.12), transparent 34%), linear-gradient(135deg, #080C10 10%, #131C26 60%, #0E151D 100%);"></div>
              }
              <div class="absolute inset-0"
                   style="background: linear-gradient(180deg, rgba(4,8,12,0.15) 0%, rgba(4,8,12,0.42) 36%, rgba(4,8,12,0.88) 100%);"></div>
              <div class="absolute inset-0"
                  style="background: linear-gradient(120deg, rgba(0,255,136,0.22) 0%, rgba(0,0,0,0) 44%, rgba(0,194,255,0.08) 100%);"></div>
            </div>

            <div class="relative z-[1] flex min-h-[520px] flex-col justify-between p-5 sm:p-7 lg:min-h-[720px] xl:p-8">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="glass inline-flex items-center gap-2 rounded-full border border-primary/15 px-3 py-1.5 text-[10px] font-body uppercase tracking-[0.28em] text-primary/85">
                  <span class="neon-dot"></span>
                  {{ blueprint().heroTag }}
                </div>
                <div class="glass inline-flex items-center gap-2 rounded-full border border-primary/15 px-3 py-1.5 text-[11px] font-body text-white/80">
                  <span>🔥 {{ post()!.user.streak_days }} dias</span>
                  <span class="text-white/25">|</span>
                  <span>{{ post()!.time_ago }}</span>
                </div>
              </div>

              <div class="max-w-[620px] space-y-5">
                <div class="inline-flex items-center gap-3 rounded-full border border-primary/15 bg-[rgba(8,12,16,0.44)] px-3 py-2 backdrop-blur-md">
                  <div class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
                    @if (post()!.user.avatar) {
                      <img [src]="post()!.user.avatar" alt="Avatar de {{ post()!.user.name }}" class="h-full w-full object-cover" />
                    } @else {
                      <span class="font-display text-[18px] font-bold text-white">{{ post()!.user.name.charAt(0).toUpperCase() }}</span>
                    }
                  </div>
                  <div>
                    <p class="font-display text-[17px] font-bold tracking-tight text-white sm:text-[20px]">{{ post()!.user.name }}</p>
                    <p class="text-[11px] font-body text-text-2">
                      @if (post()!.user.username) {
                        <span>&#64;{{ post()!.user.username }} · </span>
                      }
                      {{ tier().label }} · {{ post()!.user.total_xp }} XP
                    </p>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] font-body uppercase tracking-[0.34em] text-primary/75">Public workout drop</p>
                  <h1 class="mt-3 max-w-[12ch] font-display text-[48px] font-black uppercase leading-[0.9] tracking-[-0.03em] text-white sm:text-[62px] xl:text-[78px]">
                    {{ firstName() }} treinou <span class="text-gradient-neon">hoje</span>.
                  </h1>
                  <p class="mt-4 max-w-[20ch] text-[18px] font-body leading-tight text-white/78 sm:text-[22px]">
                    E você, vai ficar parado?
                  </p>
                </div>

                @if (post()!.caption) {
                  <div class="glass max-w-[540px] rounded-[26px] border border-primary/15 p-4 sm:p-5">
                    <p class="text-[11px] font-body uppercase tracking-[0.28em] text-text-2">Legenda do treino</p>
                    <p class="mt-2 text-[14px] font-body leading-relaxed text-white/90 whitespace-pre-wrap">{{ post()!.caption }}</p>
                  </div>
                }
              </div>
            </div>
          </article>

          <section class="challenge-banner overflow-hidden rounded-[30px] border border-primary/20 bg-[linear-gradient(120deg,rgba(0,255,136,0.18),rgba(0,255,136,0.08)_55%,rgba(8,12,16,0.95)_100%)] p-[1px] shadow-[0_14px_54px_rgba(0,255,136,0.12)]">
            <div class="relative overflow-hidden rounded-[29px] bg-[linear-gradient(180deg,#131C26,#080C10)] px-5 py-6 sm:px-6">
              <div class="absolute right-[-18px] top-[-20px] h-28 w-28 rounded-full blur-2xl"
                   style="background: radial-gradient(circle, rgba(0,255,136,0.34), rgba(0,255,136,0));"></div>
              <p class="text-[12px] font-body uppercase tracking-[0.28em] text-primary/75">Desafio aberto</p>
              <h2 class="mt-2 font-display text-[28px] font-black uppercase leading-[0.92] tracking-[-0.03em] text-white sm:text-[34px]">
                Ele fez. Agora é sua vez.
              </h2>
              <p class="mt-3 max-w-[580px] text-[14px] font-body leading-relaxed text-white/72 sm:text-[15px]">
                Complete um treino hoje, empilhe XP e entre no ranking do Repify para superar esse resultado antes que ele aumente a distância.
              </p>

              <div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center -space-x-3">
                  @for (avatar of socialProof(); track avatar.name) {
                    <div class="flex h-11 w-11 items-center justify-center rounded-full border-2 border-bg text-[11px] font-body font-bold text-bg shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                         [style.background]="avatar.color">
                      {{ avatar.name }}
                    </div>
                  }
                </div>

                <div class="flex-1 sm:max-w-[420px] sm:px-3">
                  <p class="text-[12px] font-body text-white/88">+12.458 pessoas aceitaram o desafio hoje</p>
                  <p class="mt-1 text-[11px] font-body text-text-2">Entre agora e veja quanto falta para ultrapassar {{ firstName() }}.</p>
                </div>

                <button type="button"
                        (click)="goToRegister()"
                        class="cta-neon inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-body font-bold text-bg transition-all hover:translate-y-[-1px] hover:shadow-[0_0_34px_rgba(0,255,136,0.45)]">
                  <span>⚡</span>
                  <span>Aceitar desafio</span>
                </button>
              </div>
            </div>
          </section>
        </section>

        <section class="space-y-5 lg:pt-2">
          <div class="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <article class="premium-card rounded-[30px] p-5 sm:p-6 xl:col-span-2">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-[11px] font-body uppercase tracking-[0.3em] text-primary/70">Status do treino</p>
                  <h2 class="mt-2 font-display text-[28px] font-black uppercase tracking-[-0.03em] text-white">Check-in brutalmente fechado</h2>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-body font-semibold text-primary shadow-glow-sm">
                  <span>✅</span>
                  <span>Check-in realizado</span>
                </div>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                @for (item of statusItems(); track item.label) {
                  <div class="metric-tile rounded-[24px] border border-primary/15 px-4 py-4 transition-all hover:border-primary/30 hover:bg-white/[0.045]">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-[20px]">{{ item.icon }}</span>
                      <span class="text-[10px] font-body uppercase tracking-[0.26em] text-text-2">{{ item.label }}</span>
                    </div>
                    <p class="mt-3 font-display text-[30px] font-black leading-none tracking-[-0.03em] text-white">{{ item.value }}</p>
                    <p class="mt-2 text-[12px] font-body text-white/62">{{ item.hint }}</p>
                  </div>
                }
              </div>
            </article>

            <article class="premium-card rounded-[30px] p-5 sm:p-6 xl:col-span-2">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-[11px] font-body uppercase tracking-[0.3em] text-primary/70">Progressão de nível</p>
                  <h3 class="mt-2 font-display text-[24px] font-black uppercase tracking-[-0.03em] text-white">{{ xpHeadline() }}</h3>
                </div>
                <div class="rounded-full border px-3 py-1.5 text-[11px] font-mono font-bold" [class]="levelClass()">
                  Lv. {{ tier().level }}
                </div>
              </div>

              <div class="mt-5 rounded-[24px] border border-primary/15 bg-white/[0.03] p-4 sm:p-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-[30px] font-display font-black leading-none tracking-[-0.04em] text-white">{{ xpProgressLabel() }}</p>
                    <p class="mt-2 text-[12px] font-body text-text-2">Faltam <span class="font-bold text-primary">{{ xpRemaining() }} XP</span> para o próximo nível.</p>
                  </div>
                  <div class="rounded-2xl border border-primary/15 bg-white/[0.03] px-4 py-3 text-right">
                    <p class="text-[10px] font-body uppercase tracking-[0.25em] text-text-2">Consistência</p>
                    <p class="mt-1 font-display text-[24px] font-black text-white">{{ consistency() }}%</p>
                  </div>
                </div>

                <div class="mt-5 xp-shell h-4 overflow-hidden rounded-full bg-white/[0.06]">
                  <div class="xp-bar h-full rounded-full" [style.width.%]="xpProgressPercent()"></div>
                </div>

                <div class="mt-3 flex items-center justify-between text-[11px] font-body text-text-2">
                  <span>{{ tier().min }} XP</span>
                  <span>{{ tier().max }} XP</span>
                </div>
              </div>
            </article>

            <article class="premium-card rounded-[30px] p-5 sm:p-6 xl:col-span-2">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-[11px] font-body uppercase tracking-[0.3em] text-primary/70">Treino completo</p>
                  <h3 class="mt-2 font-display text-[26px] font-black uppercase tracking-[-0.03em] text-white">{{ workoutTitle() }}</h3>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] font-body font-semibold text-primary">
                  <span>{{ exercises().length }} exercícios</span>
                </div>
              </div>

              <div class="mt-5 space-y-3">
                @for (exercise of exercises(); track exercise.name; let i = $index) {
                  <div class="exercise-row flex items-center gap-3 rounded-[22px] border border-primary/15 bg-white/[0.03] px-4 py-4 transition-all hover:border-primary/30 hover:bg-white/[0.045]">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 font-display text-[14px] font-bold text-primary">
                      {{ i + 1 }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-body text-[14px] font-semibold text-white">{{ exercise.name }}</p>
                      <p class="mt-1 text-[11px] font-body uppercase tracking-[0.18em] text-text-2">{{ exercise.muscle }}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-mono text-[13px] font-bold text-white">{{ exercise.prescription }}</p>
                      <p class="mt-1 text-[11px] font-body text-primary">Concluído</p>
                    </div>
                  </div>
                }
              </div>

              <div class="mt-4 flex items-center justify-between rounded-[24px] border border-primary/15 bg-primary/[0.06] px-4 py-3 text-[13px] font-body">
                <span class="font-semibold text-white">✔ Todos os exercícios concluídos</span>
                <span class="font-mono font-bold text-primary">100%</span>
              </div>
            </article>

            <article class="premium-card rounded-[30px] p-5 sm:p-6">
              <p class="text-[11px] font-body uppercase tracking-[0.3em] text-primary/70">Resumo da sessão</p>
              <div class="mt-5 grid gap-3">
                @for (item of summaryItems(); track item.label) {
                  <div class="rounded-[22px] border border-primary/15 bg-white/[0.03] px-4 py-4">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-[11px] font-body uppercase tracking-[0.18em] text-text-2">{{ item.label }}</p>
                        <p class="mt-2 font-display text-[28px] font-black leading-none tracking-[-0.03em] text-white">{{ item.value }}</p>
                      </div>
                      <span class="text-[24px]">{{ item.icon }}</span>
                    </div>
                    <p class="mt-2 text-[12px] font-body text-white/62">{{ item.hint }}</p>
                  </div>
                }
              </div>
            </article>

            <article class="premium-card rounded-[30px] p-5 sm:p-6">
              <p class="text-[11px] font-body uppercase tracking-[0.3em] text-primary/70">Prova social</p>
              <div class="mt-4 flex items-center gap-3">
                <div class="flex -space-x-3">
                  @for (avatar of socialProof(); track avatar.name) {
                    <div class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-bg text-[11px] font-body font-bold text-bg"
                         [style.background]="avatar.color">
                      {{ avatar.name }}
                    </div>
                  }
                </div>
                <div>
                  <p class="font-display text-[24px] font-black tracking-[-0.03em] text-white">12.458+</p>
                  <p class="text-[12px] font-body text-text-2">pessoas aceitaram o desafio hoje</p>
                </div>
              </div>

              <div class="mt-6 rounded-[24px] border border-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-5">
                <p class="text-[11px] font-body uppercase tracking-[0.2em] text-text-2">Mensagem final</p>
                <blockquote class="mt-3 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.04em] text-white">
                  Disciplina hoje. Resultado sempre.
                </blockquote>
              </div>

              <div class="mt-6 space-y-3">
                <button type="button"
                        (click)="goToRegister()"
                        class="cta-neon flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-[15px] font-body font-bold text-bg transition-all hover:translate-y-[-1px] hover:shadow-[0_0_34px_rgba(0,255,136,0.45)]">
                  <span>👉</span>
                  <span>Aceitar desafio</span>
                </button>
                <button type="button"
                        (click)="goToLogin()"
                        class="w-full rounded-full border border-primary/15 bg-white/[0.03] px-5 py-4 text-[14px] font-body font-semibold text-white transition-all hover:border-primary/30 hover:bg-white/[0.05]">
                  Já tenho conta
                </button>
              </div>
            </article>
          </div>
        </section>
      }

      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .public-post-shell {
      position: relative;
      background:
        radial-gradient(circle at top, rgba(0, 255, 136, 0.05), transparent 25%),
        linear-gradient(180deg, #080C10 0%, #0E151D 42%, #080C10 100%);
    }
    .premium-card {
      border: 1px solid rgba(0, 255, 136, 0.16);
      background:
        linear-gradient(180deg, rgba(16, 22, 30, 0.92), rgba(8, 12, 16, 0.96)),
        linear-gradient(130deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(18px);
    }
    .cinema-card::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      border: 1px solid rgba(0, 255, 136, 0.16);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .glass {
      background: rgba(12, 18, 24, 0.56);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
      backdrop-filter: blur(18px);
    }
    .text-gradient-neon {
      background: linear-gradient(90deg, #00FF88 0%, #28F49B 68%, #64E7FF 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-shadow: 0 0 24px rgba(0,255,136,0.16);
    }
    .metric-tile,
    .exercise-row {
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    }
    .xp-shell {
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
    }
    .xp-bar {
      background:
        linear-gradient(90deg, #00FF88 0%, #00FF88 72%, #54DDFF 100%);
      box-shadow: 0 0 18px rgba(0,255,136,0.35), 0 0 24px rgba(0,194,255,0.10);
      animation: xpPulse 2.8s ease-in-out infinite;
    }
    .cta-neon {
      background: linear-gradient(90deg, #00FF88 0%, #00FF88 74%, #38E5A0 100%);
      box-shadow: 0 0 22px rgba(0,255,136,0.28), 0 10px 30px rgba(0,255,136,0.18);
    }
    .challenge-banner {
      position: relative;
    }
    .challenge-banner::after {
      content: '';
      position: absolute;
      inset: -28% auto auto -8%;
      height: 160px;
      width: 160px;
      background: radial-gradient(circle, rgba(0,255,136,0.22), rgba(0,255,136,0));
      filter: blur(30px);
      pointer-events: none;
    }
    @keyframes xpPulse {
      0%, 100% { filter: saturate(100%); }
      50% { filter: saturate(122%); }
    }
  `],
})
export class PublicPostComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  post    = signal<PublicPost | null>(null);
  loading = signal(true);
  error   = signal(false);
  readonly socialProof = signal(SOCIAL_PROOF);

  readonly blueprint = computed<WorkoutBlueprint>(() => {
    const group = (this.post()?.workout?.muscleGroup ?? '').toLowerCase();
    return WORKOUT_BLUEPRINTS[group] ?? DEFAULT_BLUEPRINT;
  });

  readonly exercises = computed(() => this.blueprint().exercises);
  readonly tier = computed<XpTier>(() => resolveTier(this.post()?.user.total_xp ?? 0));
  readonly xpRemaining = computed(() => Math.max(0, this.tier().max - (this.post()?.user.total_xp ?? 0)));
  readonly xpProgressPercent = computed(() => {
    const totalXp = this.post()?.user.total_xp ?? 0;
    const currentTier = this.tier();
    const span = Math.max(currentTier.max - currentTier.min, 1);
    return Math.max(4, Math.min(100, Math.round(((totalXp - currentTier.min) / span) * 100)));
  });
  readonly xpProgressLabel = computed(() => `${this.post()?.user.total_xp ?? 0} / ${this.tier().max} XP`);
  readonly xpHeadline = computed(() => `Progresso do nível ${this.tier().level}`);
  readonly consistency = computed(() => {
    const user = this.post()?.user;
    if (!user) return 0;
    return Math.max(58, Math.min(96, 56 + user.streak_days * 4));
  });
  readonly gainedXp = computed(() => {
    const durationBonus = Math.round(this.blueprint().duration * 1.35);
    return Math.max(70, Math.min(160, durationBonus + (this.post()?.user.streak_days ?? 0) * 8));
  });
  readonly statusItems = computed(() => [
    { icon: '✅', label: 'Check-in', value: 'Realizado', hint: 'Status confirmado no feed público' },
    { icon: '⏱️', label: 'Duração', value: `${this.blueprint().duration} min`, hint: 'Sessão estimada com ritmo forte' },
    { icon: '⚡', label: 'XP ganho', value: `+${this.gainedXp()} XP`, hint: 'Pontuação empilhada hoje' },
    { icon: '🔥', label: 'Streak', value: `${this.post()?.user.streak_days ?? 0} dias`, hint: 'Sem quebrar a sequência' },
    { icon: '🎯', label: 'Nível', value: `${this.tier().level}`, hint: this.tier().label },
    { icon: '📊', label: 'Consistência', value: `${this.consistency()}%`, hint: 'Ritmo competitivo de treino' },
  ]);
  readonly summaryItems = computed(() => [
    { icon: '🔥', label: 'Calorias', value: `${this.blueprint().calories}`, hint: 'Energia convertida em progresso' },
    { icon: '❤️', label: 'Frequência', value: `${this.blueprint().heartRate} bpm`, hint: 'Zona intensa do treino' },
    { icon: '📈', label: 'Performance', value: performanceLabel(this.consistency()), hint: 'Leitura geral da sessão' },
  ]);
  readonly workoutTitle = computed(() => this.post()?.workout?.name || this.blueprint().title);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set(true); this.loading.set(false); return; }
    this.load(id);
  }

  private async load(id: string): Promise<void> {
    const fallbackPost = this.getFallbackPost(id);

    try {
      const res = await fetch(`${environment.apiBaseUrl}/api/posts/public/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (fallbackPost) {
          this.post.set(fallbackPost);
          return;
        }
        throw new Error(res.status === 404 ? 'not-found' : 'unavailable');
      }
      const { post } = await res.json();
      this.post.set(post ?? fallbackPost);
      if (!this.post()) throw new Error('empty');
    } catch {
      if (fallbackPost) {
        this.post.set(fallbackPost);
        return;
      }
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private getFallbackPost(id: string): PublicPost | null {
    const qp = this.route.snapshot.queryParamMap;
    const name = qp.get('n');
    if (!name) return null;

    return {
      id,
      caption: qp.get('c'),
      photo_url: qp.get('p'),
      photo_url_medium: null,
      photo_url_thumb: null,
      workout: qp.get('wn') ? { name: qp.get('wn')!, muscleGroup: qp.get('wm') ?? '' } : null,
      likes: Number(qp.get('lk') ?? 0),
      comments: Number(qp.get('cm') ?? 0),
      time_ago: qp.get('ta') ?? 'agora',
      user: {
        id: '',
        name,
        username: qp.get('u'),
        avatar: qp.get('a') ?? '',
        level: qp.get('l') ?? 'Iniciante',
        workouts_done: Number(qp.get('wd') ?? 0),
        streak_days: Number(qp.get('sd') ?? 0),
        total_xp: estimateTotalXp(qp.get('l'), Number(qp.get('wd') ?? 0), Number(qp.get('sd') ?? 0)),
      },
    };
  }

  levelClass(): string {
    return LEVEL_COLORS[this.post()?.user.level ?? ''] ?? LEVEL_COLORS['Iniciante'];
  }

  muscleEmoji(): string {
    const mg = (this.post()?.workout?.muscleGroup ?? '').toLowerCase();
    return MUSCLE_ICONS[mg] ?? '🏋️';
  }

  firstName(): string {
    return this.post()?.user.name.split(' ')[0] ?? 'esse atleta';
  }

  goToRegister(): void { this.router.navigate(['/register']); }
  goToLogin():    void { this.router.navigate(['/']); }
}

function resolveTier(totalXp: number): XpTier {
  return XP_TIERS.find(tier => totalXp >= tier.min && totalXp < tier.max) ?? XP_TIERS[XP_TIERS.length - 1];
}

function performanceLabel(consistency: number): string {
  if (consistency >= 90) return 'Elite';
  if (consistency >= 80) return 'Excelente';
  if (consistency >= 68) return 'Muito boa';
  return 'Boa';
}


function estimateTotalXp(level: string | null, workoutsDone: number, streakDays: number): number {
  const levelBase: Record<string, number> = {
    'Iniciante': 120,
    'Intermediário': 320,
    'Avançado': 680,
    'Pro': 1120,
    'Elite': 1680,
  };

  return levelBase[level ?? ''] ?? Math.max(120, workoutsDone * 55 + streakDays * 12);
}
