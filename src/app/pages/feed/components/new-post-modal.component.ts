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

const AUTO_CAPTION_PHRASES = [
  'Treino feito. Sem desculpa.',
  'Hoje teve disciplina.',
  'Mais um dia cumprido.',
  'Não falhei comigo hoje.',
  'Consistência > motivação.',
  'Fiz o que precisava ser feito.',
  'Sem atalho. Só execução.',
  'Um dia mais forte.',
  'Processo acima de tudo.',
  'Check do dia ✅',
  'Treino pago.',
  'Mais um passo.',
  'Sem emoção, só ação.',
  'Fiz mesmo sem vontade.',
  'Resultado é consequência.',
  'Hoje eu apareci.',
  'Disciplina mantida.',
  'Evolução silenciosa.',
  'Constância ativa.',
  'Mais perto do objetivo.',
  'Você ou desiste, ou evolui.',
  'Ninguém faz por você.',
  'Feito > perfeito.',
  'Dor passa. Resultado fica.',
  'Sem esforço, sem progresso.',
  'Mais ação, menos desculpa.',
  'O básico bem feito funciona.',
  'Repetição cria resultado.',
  'Você colhe o que repete.',
  'Hoje eu venci a preguiça.',
  '+1 dia na sequência 🔥',
  'XP garantido hoje',
  'Missão concluída',
  'Streak mantida',
  'Level up em andamento',
  'Meta da semana mais perto',
  'Desafio avançado',
  'Progresso atualizado',
  'Check-in validado',
  'Consistência registrada',
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

const MAX_PHOTOS = 6;

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

    <!-- Media picker sheet -->
    @if (showMediaPicker()) {
      <div class="fixed inset-0 z-[55] flex items-end max-w-[460px] mx-auto"
           style="background:rgba(8,12,16,0.7)" (click)="showMediaPicker.set(false)">
        <div class="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3 animate-slide-up"
             (click)="$event.stopPropagation()">
          <p class="text-[13px] font-body font-semibold text-white mb-1">Adicionar mídia</p>

          <button (click)="showMediaPicker.set(false); photoInput.click()"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card-2 hover:border-border-2 transition-all text-left">
            <div class="w-9 h-9 rounded-lg bg-border flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div>
              <p class="text-[13px] font-body font-semibold text-white">Foto</p>
              <p class="text-[11px] font-body text-text-2">Até {{ MAX_PHOTOS }} fotos · JPG, PNG ou WEBP · máx 10MB</p>
            </div>
          </button>

          <button (click)="showMediaPicker.set(false); videoInput.click()"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card-2 hover:border-border-2 transition-all text-left">
            <div class="w-9 h-9 rounded-lg bg-border flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </div>
            <div>
              <p class="text-[13px] font-body font-semibold text-white">Vídeo</p>
              <p class="text-[11px] font-body text-text-2">MP4, WebM ou MOV · máx 100MB</p>
            </div>
          </button>

          <button (click)="showMediaPicker.set(false)"
                  class="w-full py-3 text-[13px] font-body text-text-2 hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    }

    @if (showArtworkPrompt()) {
      <div class="fixed inset-0 z-[56] flex items-end max-w-[460px] mx-auto"
           style="background:rgba(8,12,16,0.74)" (click)="declineArtworkCarousel()">
        <div class="w-full rounded-t-[28px] border-t border-primary/20 bg-card p-5 animate-slide-up"
             (click)="$event.stopPropagation()">
          <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/10"></div>
          <p class="text-[11px] font-body font-medium uppercase tracking-[0.22em] text-primary/80">Carrossel do treino</p>
          <h3 class="mt-2 text-[19px] font-display font-bold text-white">Adicionar a arte do treino como foto extra?</h3>
          <p class="mt-2 text-[13px] font-body leading-relaxed text-text-2">
            Sua foto entra primeiro no post. A arte gerada do treino entra como última imagem do carrossel.
          </p>

          @if (galleryArtworkPreview()) {
            <div class="mt-4 rounded-2xl border border-primary/15 bg-primary/8 p-3">
              <div class="grid grid-cols-2 gap-3">
                <div class="overflow-hidden rounded-xl border border-white/8 bg-card-2">
                  <img [src]="photoPreview()" alt="Prévia da foto principal" class="aspect-square w-full object-cover" />
                  <p class="border-t border-white/8 px-2 py-1.5 text-center text-[10px] font-body uppercase tracking-[0.16em] text-text-2">Foto 1</p>
                </div>
                <div class="overflow-hidden rounded-xl border border-primary/20 bg-card-2">
                  <img [src]="galleryArtworkPreview()" alt="Prévia da arte do treino" class="aspect-square w-full object-cover" />
                  <p class="border-t border-primary/15 px-2 py-1.5 text-center text-[10px] font-body uppercase tracking-[0.16em] text-primary">Arte</p>
                </div>
              </div>
            </div>
          }

          <div class="mt-5 flex gap-3">
            <button type="button" (click)="declineArtworkCarousel()"
                    class="flex-1 rounded-xl border border-border px-4 py-3 text-[13px] font-body font-medium text-text-2 transition-colors hover:text-white">
              Agora não
            </button>
            <button type="button" (click)="acceptArtworkCarousel()"
                    class="flex-1 rounded-xl border border-primary/30 bg-primary/12 px-4 py-3 text-[13px] font-body font-semibold text-primary transition-all hover:bg-primary/18">
              Adicionar
            </button>
          </div>
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

        <!-- Hidden file inputs -->
        <input #photoInput type="file" accept="image/*" class="hidden" (change)="onPhotoSelected($event)" />
        <input #extraPhotoInput type="file" accept="image/*" class="hidden" (change)="onExtraPhotoSelected($event)" />
        <input #videoInput type="file" accept="video/mp4,video/webm,video/quicktime" class="hidden" (change)="onVideoSelected($event)" />

        <!-- ── Photo area ── -->
        @if (hasAnyPhoto()) {

          <!-- Multi-photo strip -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Fotos do post</span>
              <span class="text-[10px] font-mono text-text-2 bg-card-2 border border-border rounded-full px-2 py-0.5">
                {{ totalPhotoCount() }}/{{ MAX_PHOTOS }}
              </span>
            </div>

            <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">

              <!-- Main photo thumbnail -->
              @if (photoPreview()) {
                <div class="relative shrink-0 w-[116px] h-[116px] rounded-xl overflow-hidden border-2 border-border snap-start group">
                  <img [src]="photoPreview()" class="w-full h-full object-cover" />

                  <!-- Overlay controls -->
                  <div class="absolute inset-0 bg-bg/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                    <div class="flex items-start justify-between">
                      <span class="bg-bg/75 text-white text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
                      <button (click)="removePhoto(0)"
                              class="w-5 h-5 bg-bg/80 rounded-full flex items-center justify-center text-white hover:bg-danger/80 transition-colors">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <button (click)="cropSrc.set(photoPreview()); showFormatPicker.set(true)"
                            class="w-full bg-bg/75 rounded-lg text-[9px] text-white py-1 text-center font-body font-medium hover:bg-bg/90 transition-colors">
                      Ajustar
                    </button>
                  </div>

                  <!-- Always-visible number badge -->
                  <div class="absolute top-1 left-1 group-hover:opacity-0 transition-opacity">
                    <span class="bg-bg/75 text-white text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
                  </div>
                </div>
              }

              <!-- Extra photos thumbnails -->
              @for (preview of extraPhotoPreviews(); track $index) {
                <div class="relative shrink-0 w-[116px] h-[116px] rounded-xl overflow-hidden border-2 border-border snap-start group">
                  <img [src]="preview" class="w-full h-full object-cover" />

                  <div class="absolute inset-0 bg-bg/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                    <div class="flex items-start justify-between">
                      <span class="bg-bg/75 text-white text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ $index + 2 }}</span>
                      <button (click)="removePhoto($index + 1)"
                              class="w-5 h-5 bg-bg/80 rounded-full flex items-center justify-center text-white hover:bg-danger/80 transition-colors">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="absolute top-1 left-1 group-hover:opacity-0 transition-opacity">
                    <span class="bg-bg/75 text-white text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ $index + 2 }}</span>
                  </div>
                </div>
              }

              <!-- Artwork thumbnail -->
              @if (galleryArtworkPreview()) {
                <div class="relative shrink-0 w-[116px] h-[116px] rounded-xl overflow-hidden border-2 border-primary/40 snap-start group">
                  <img [src]="galleryArtworkPreview()" class="w-full h-full object-cover" />

                  <div class="absolute inset-0 bg-bg/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                    <div class="flex items-start justify-between">
                      <span class="bg-primary/80 text-bg text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ totalPhotoCount() }}</span>
                      <button (click)="clearGalleryArtwork()"
                              class="w-5 h-5 bg-bg/80 rounded-full flex items-center justify-center text-white hover:bg-danger/80 transition-colors">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <p class="w-full bg-primary/20 rounded-lg text-[9px] text-primary py-1 text-center font-body font-semibold">Arte</p>
                  </div>

                  <div class="absolute top-1 left-1 group-hover:opacity-0 transition-opacity">
                    <span class="bg-primary/80 text-bg text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ totalPhotoCount() }}</span>
                  </div>
                  <div class="absolute bottom-1 left-0 right-0 flex justify-center group-hover:opacity-0 transition-opacity">
                    <span class="bg-primary/70 text-bg text-[8px] font-body font-bold rounded px-1.5 py-0.5">ARTE</span>
                  </div>
                </div>
              }

              <!-- Add more button -->
              @if (canAddMorePhotos()) {
                <button (click)="addMorePhoto(extraPhotoInput)"
                        class="shrink-0 w-[116px] h-[116px] rounded-xl bg-card-2 border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all snap-start">
                  <div class="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <p class="text-[10px] font-body text-text-2">Adicionar foto</p>
                </button>
              }
            </div>

            <!-- Artwork action button (only when prefillSummary and main photo exists) -->
            @if (prefillSummary() && photoPreview()) {
              <button type="button" (click)="regenerateChallengeArtwork()"
                      [disabled]="generatingArtwork()"
                      class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card-2 text-[12px] font-body text-text-2 hover:text-white hover:border-border-2 transition-all disabled:opacity-50 active:scale-[0.98]">
                @if (generatingArtwork()) {
                  <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                } @else {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
                  </svg>
                }
                {{ galleryArtworkPreview() ? 'Regenerar arte do treino' : 'Adicionar arte do treino' }}
              </button>
            }
          </div>

        } @else if (!videoFile()) {
          <!-- Empty state: single media box -->
          <button (click)="showMediaPicker.set(true)"
                  class="w-full aspect-[4/3] bg-card-2 border-2 border-dashed border-border-2 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all group">
            <div class="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
                <line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            </div>
            <div class="text-center">
              <p class="text-[14px] font-body font-semibold text-white group-hover:text-primary transition-colors">Adicionar mídia</p>
              <p class="text-[11px] text-text-2 font-body mt-0.5">Foto ou vídeo · opcional</p>
            </div>
          </button>
        }

        <!-- Video section (shown when video selected, regardless of photos) -->
        @if (videoPreview()) {
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Vídeo</span>
              <button (click)="removeVideo()"
                      class="text-[11px] font-body text-danger/70 hover:text-danger transition-colors">
                Remover
              </button>
            </div>
            <div class="rounded-2xl overflow-hidden bg-card border border-border relative">
              <video [src]="videoPreview()" [poster]="videoPoster()" controls playsinline preload="metadata"
                     class="w-full max-h-[320px] object-contain bg-black">
              </video>
            </div>
            <p class="text-[10px] font-body text-text-2">Máx 100MB · MP4, WebM ou MOV</p>
          </div>

          @if (!hasAnyPhoto()) {
            <button (click)="photoInput.click()"
                    class="w-full py-3 bg-card-2 border border-dashed border-border rounded-xl flex items-center justify-center gap-2 hover:border-primary/50 transition-all text-text-2 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span class="text-[12px] font-body">Adicionar foto também</span>
            </button>
          }
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
            <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider">Legendas automáticas</label>
            <div class="rounded-xl border border-border bg-card-2 p-3.5 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-[13px] font-body font-semibold text-white">{{ generatedCaptionLabel() || 'Gerar legenda de desafio' }}</p>
                  <p class="text-[11px] font-body text-text-2">40 variações para provocar e desafiar a turma.</p>
                </div>
                <button type="button" (click)="generateCaption()"
                        class="shrink-0 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-[12px] font-body font-semibold text-primary transition-all hover:bg-primary/18 active:scale-[0.98]">
                  Gerar legenda
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" (click)="setManualCaptionMode()"
                        class="rounded-full border px-3 py-1.5 text-[11px] font-body transition-colors"
                        [class]="selectedCaptionOption() === 'manual' ? 'border-primary/40 bg-primary/12 text-primary' : 'border-border text-text-2 hover:text-white'">
                  Escrever manualmente
                </button>
              </div>
            </div>
            <p class="text-[11px] font-body text-text-2">Gere quantas vezes quiser e, se preferir, edite manualmente no campo abaixo.</p>
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
          <p class="text-[13px] font-body text-primary">
            {{ videoFile() ? 'enviando vídeo...' : totalPhotoCount() > 0 ? 'Enviando ' + totalPhotoCount() + (totalPhotoCount() === 1 ? ' foto...' : ' fotos...') : 'Publicando...' }}
          </p>
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

  readonly MAX_PHOTOS = MAX_PHOTOS;

  title          = input('Novo post');
  prefillCaption = input('');
  prefillWorkout = input<WorkoutOption | null>(null);
  prefillSummary = input<WorkoutPostPrefillSummary | null>(null);

  onClose   = output<void>();
  onPublish = output<WorkoutPost>();

  // ── Primary photo (index 0) ──────────────────────────────────────────────
  photoFile    = signal<File | null>(null);
  photoPreview = signal('');

  // ── Extra photos (indices 1-N, before artwork) ───────────────────────────
  extraPhotoFiles    = signal<File[]>([]);
  extraPhotoPreviews = signal<string[]>([]);

  // ── Artwork (always last in the gallery) ────────────────────────────────
  galleryArtworkFile    = signal<File | null>(null);
  galleryArtworkPreview = signal('');

  // ── Video ────────────────────────────────────────────────────────────────
  videoFile            = signal<File | null>(null);
  videoPreview         = signal('');
  videoPoster          = signal(''); // first frame captured client-side

  // ── Crop & format picker ─────────────────────────────────────────────────
  cropSrc          = signal<string | null>(null);
  cropMode         = signal<'square' | 'story' | null>(null);
  showFormatPicker = signal(false);
  showArtworkPrompt = signal(false);
  showMediaPicker  = signal(false);

  // ── State flags ──────────────────────────────────────────────────────────
  autoGeneratedVisual    = signal(false);
  publishing             = signal(false);
  generatingArtwork      = signal(false);
  error                  = signal('');
  caption                = '';
  selectedWorkout        = signal<WorkoutOption | null>(null);
  selectedCaptionOption  = signal('manual');
  generatedCaptionLabel  = signal('');

  private captionTouched         = false;
  private workoutTouched         = false;
  private photoManuallyManaged   = false;
  private autoArtworkAttemptedKey = '';
  private addingExtraPhoto       = false;

  // ── Computed ─────────────────────────────────────────────────────────────
  workoutsDone = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));

  totalPhotoCount = computed(() =>
    (this.photoFile() ? 1 : 0) + this.extraPhotoFiles().length + (this.galleryArtworkFile() ? 1 : 0)
  );

  canAddMorePhotos = computed(() => this.totalPhotoCount() < MAX_PHOTOS);

  hasAnyPhoto = computed(() =>
    !!this.photoPreview() || this.extraPhotoPreviews().length > 0 || !!this.galleryArtworkPreview()
  );

  publishProfileError = computed(() => this.postService.canCreatePost() ? '' : this.postService.createPostRequirementMessage());

  constructor() {
    effect(() => {
      const initialCaption = this.prefillCaption();
      const initialWorkout = this.prefillWorkout();

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

      if (!summary || currentPhoto || this.photoManuallyManaged) return;

      const artworkKey = this.buildArtworkKey(summary);
      if (this.autoArtworkAttemptedKey === artworkKey) return;

      this.autoArtworkAttemptedKey = artworkKey;
      void this.generateChallengeArtwork(summary);
    });
  }

  workoutOptions = computed<WorkoutOption[]>(() => {
    const today   = this.workoutService.todayWorkout();
    const program = this.workoutService.program();
    const opts: WorkoutOption[] = [];
    const seen = new Set<string>();

    if (today) { opts.push({ name: today.name, muscleGroup: today.muscleGroup }); seen.add(today.name); }
    if (program) {
      for (const p of program.plans) {
        if (!seen.has(p.name)) { opts.push({ name: p.name, muscleGroup: p.muscleGroup }); seen.add(p.name); }
      }
    }
    return opts;
  });

  captionOptions = computed<CaptionOption[]>(() => {
    const summary = this.prefillSummary();
    const workout = this.prefillWorkout();
    if (!summary || !workout) return [];
    return AUTO_CAPTION_PHRASES.map((phrase, index) => ({
      id: `provocation-${index + 1}`,
      label: `Legenda ${String(index + 1).padStart(2, '0')}`,
      value: phrase,
    }));
  });

  canPublish(): boolean {
    return this.postService.canCreatePost() &&
      (!!this.photoFile() || !!this.caption.trim() || !!this.selectedWorkout() || !!this.videoFile());
  }

  muscleEmoji(mg: string): string { return MUSCLE_EMOJI[mg] ?? '💪'; }
  isSelected(opt: WorkoutOption): boolean { return this.selectedWorkout()?.name === opt.name; }

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
      while (next.id === current) next = options[Math.floor(Math.random() * options.length)];
    }
    this.captionTouched = true;
    this.selectedCaptionOption.set(next.id);
    this.generatedCaptionLabel.set(next.label);
    this.caption = next.value;
  }

  // ── Photo selection ───────────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.error.set('Foto muito grande. Máximo 10MB.'); return; }
    this.addingExtraPhoto = false;
    this.photoManuallyManaged = true;
    this.autoGeneratedVisual.set(false);
    this.clearGalleryArtwork();
    const reader = new FileReader();
    reader.onload = e => { this.cropSrc.set(e.target?.result as string); this.showFormatPicker.set(true); };
    reader.readAsDataURL(file);
  }

  onExtraPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.error.set('Foto muito grande. Máximo 10MB.'); return; }
    this.addingExtraPhoto = true;
    const reader = new FileReader();
    reader.onload = e => { this.cropSrc.set(e.target?.result as string); this.showFormatPicker.set(true); };
    reader.readAsDataURL(file);
  }

  addMorePhoto(input: HTMLInputElement): void {
    input.click();
  }

  onVideoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { this.error.set('Vídeo muito grande. Máximo 100MB.'); return; }
    this.videoFile.set(file);
    this.videoPreview.set(URL.createObjectURL(file));
    void this._captureVideoPoster(file);
  }

  removeVideo(): void {
    const prev = this.videoPreview();
    if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.videoFile.set(null);
    this.videoPreview.set('');
    this.videoPoster.set('');
  }

  private _captureVideoPoster(file: File): Promise<void> {
    return new Promise(resolve => {
      const video = document.createElement('video');
      const url   = URL.createObjectURL(file);
      video.src        = url;
      video.muted      = true;
      video.playsInline = true;
      video.currentTime = 0.5;

      const cleanup = () => URL.revokeObjectURL(url);

      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = video.videoWidth  || 640;
          canvas.height = video.videoHeight || 360;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          this.videoPoster.set(canvas.toDataURL('image/jpeg', 0.8));
        } catch { /* ignore */ } finally {
          cleanup();
          resolve();
        }
      }, { once: true });

      video.addEventListener('error', () => { cleanup(); resolve(); }, { once: true });
    });
  }

  useOriginal(): void {
    const dataUrl = this.cropSrc()!;
    this.showFormatPicker.set(false);

    fetch(dataUrl).then(r => r.blob()).then(blob => {
      const file = new File([blob], 'photo.png', { type: blob.type });
      if (this.addingExtraPhoto) {
        this.extraPhotoFiles.update(arr => [...arr, file]);
        this.extraPhotoPreviews.update(arr => [...arr, dataUrl]);
        this.addingExtraPhoto = false;
      } else {
        this.photoFile.set(file);
        this.photoPreview.set(dataUrl);
        this.maybePromptForArtworkCarousel();
      }
    });
  }

  onPhotoCropped(result: { dataUrl: string; blob: Blob }): void {
    this.cropMode.set(null);
    const file = new File([result.blob], 'photo.png', { type: 'image/png' });

    if (this.addingExtraPhoto) {
      this.extraPhotoFiles.update(arr => [...arr, file]);
      this.extraPhotoPreviews.update(arr => [...arr, result.dataUrl]);
      this.addingExtraPhoto = false;
    } else {
      this.photoFile.set(file);
      this.photoPreview.set(result.dataUrl);
      this.maybePromptForArtworkCarousel();
    }
  }

  removePhoto(index: number): void {
    if (index === 0) {
      // Promote first extra to main, or clear entirely
      const extras = this.extraPhotoFiles();
      if (extras.length > 0) {
        const [first, ...rest] = extras;
        const [firstPrev, ...restPrev] = this.extraPhotoPreviews();
        this.photoFile.set(first);
        this.photoPreview.set(firstPrev);
        this.extraPhotoFiles.set(rest);
        this.extraPhotoPreviews.set(restPrev);
      } else {
        this.photoManuallyManaged = true;
        this.autoGeneratedVisual.set(false);
        this.clearGalleryArtwork();
        this.showArtworkPrompt.set(false);
        this.photoFile.set(null);
        this.photoPreview.set('');
        this.cropSrc.set(null);
        this.cropMode.set(null);
      }
    } else {
      const i = index - 1;
      this.extraPhotoFiles.update(arr => arr.filter((_, idx) => idx !== i));
      this.extraPhotoPreviews.update(arr => arr.filter((_, idx) => idx !== i));
    }
  }

  clearGalleryArtwork(): void {
    this.galleryArtworkFile.set(null);
    this.galleryArtworkPreview.set('');
  }

  declineArtworkCarousel(): void { this.showArtworkPrompt.set(false); }

  async acceptArtworkCarousel(): Promise<void> {
    const summary = this.prefillSummary();
    if (!summary) { this.showArtworkPrompt.set(false); return; }
    await this.createArtworkSecondPhoto(summary, false);
  }

  async regenerateChallengeArtwork(): Promise<void> {
    const summary = this.prefillSummary();
    if (!summary) return;

    if (this.photoManuallyManaged && this.photoFile()) {
      await this.createArtworkSecondPhoto(summary, true);
      return;
    }

    this.photoManuallyManaged = false;
    this.autoArtworkAttemptedKey = this.buildArtworkKey(summary);
    await this.generateChallengeArtwork(summary);
  }

  async publish(): Promise<void> {
    if (!this.canPublish() || this.publishing()) return;
    this.publishing.set(true);
    this.error.set('');

    try {
      const post = await this.postService.createPost({
        photo:   this.photoFile(),
        photos:  this.buildPostPhotos(),
        video:   this.videoFile(),
        caption: this.caption,
        workout: this.selectedWorkout(),
      });

      post.streak = this.ranking.myRank()?.streakDays ?? this.workoutService.streak();
      this.onPublish.emit(post);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Erro ao publicar. Tente novamente.');
    } finally {
      this.publishing.set(false);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildPostPhotos(): File[] {
    return [
      this.photoFile(),
      ...this.extraPhotoFiles(),
      this.galleryArtworkFile(),
    ].filter((f): f is File => !!f);
  }

  private buildArtworkKey(summary: WorkoutPostPrefillSummary): string {
    return [
      summary.title, summary.muscleGroup, summary.durationMinutes,
      summary.exercisesDone, summary.totalExercises,
      summary.calories ?? 'na', summary.xpEarned,
      summary.completedAtLabel, summary.sessionLabel,
    ].join('|');
  }

  private maybePromptForArtworkCarousel(): void {
    if (!this.prefillSummary() || !this.photoPreview()) return;
    this.showArtworkPrompt.set(true);
  }

  private async generateChallengeArtwork(summary: WorkoutPostPrefillSummary): Promise<void> {
    try {
      this.generatingArtwork.set(true);
      const result = await this.buildChallengeArtwork(summary);
      if (this.photoManuallyManaged) return;
      this.photoPreview.set(result.dataUrl);
      this.photoFile.set(result.file);
      this.autoGeneratedVisual.set(true);
    } catch {
      // artwork generation is non-critical
    } finally {
      this.generatingArtwork.set(false);
    }
  }

  private async createArtworkSecondPhoto(summary: WorkoutPostPrefillSummary, replaceExisting: boolean): Promise<void> {
    try {
      this.generatingArtwork.set(true);
      const result = await this.buildChallengeArtwork(summary);
      if (!replaceExisting && !this.photoFile()) return;
      this.galleryArtworkPreview.set(result.dataUrl);
      this.galleryArtworkFile.set(result.file);
      this.showArtworkPrompt.set(false);
    } catch {
      this.error.set('Não foi possível gerar a arte do treino agora.');
    } finally {
      this.generatingArtwork.set(false);
    }
  }

  private async buildChallengeArtwork(summary: WorkoutPostPrefillSummary): Promise<{ dataUrl: string; file: File }> {
    const width = 1080;
    const height = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponivel.');

    const profile = this.auth.profile();
    const exerciseProgress = summary.totalExercises > 0
      ? Math.min(1, summary.exercisesDone / summary.totalExercises) : 0;
    const todayDateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const dateLabel = summary.sessionLabel === 'Treino de hoje' ? todayDateLabel : summary.sessionLabel;
    const challengeSubheadline = summary.xpEarned >= 100
      ? `+${summary.xpEarned} XP EM ${summary.durationMinutes} MIN. VAMOS VER QUEM SUSTENTA O RITMO.`
      : `${summary.exercisesDone}/${summary.totalExercises} EXERCICIOS FECHADOS. QUERO VER QUEM ACOMPANHA.`;
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
        if (context.measureText(candidate).width <= maxWidth) { current = candidate; continue; }
        if (current) lines.push(current);
        current = word;
      }
      if (current) lines.push(current);
      return lines;
    };

    const fitText = (text: string, fontFamily: string, fontWeight: string | number, maxFontSize: number, minFontSize: number, maxWidth: number) => {
      let fontSize = maxFontSize;
      while (fontSize > minFontSize) {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        if (context.measureText(text).width <= maxWidth) return fontSize;
        fontSize -= 2;
      }
      return minFontSize;
    };

    const drawFittedText = (text: string, x: number, y: number, maxWidth: number, options: { fontFamily: string; fontWeight: string | number; maxFontSize: number; minFontSize: number; color: string }) => {
      const fontSize = fitText(text, options.fontFamily, options.fontWeight, options.maxFontSize, options.minFontSize, maxWidth);
      context.font = `${options.fontWeight} ${fontSize}px ${options.fontFamily}`;
      context.fillStyle = options.color;
      context.fillText(text, x, y);
      return fontSize;
    };

    const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, options: { fontFamily: string; fontWeight: string | number; maxFontSize: number; minFontSize: number; color: string; maxLines: number; lineHeight: number }) => {
      let fontSize = options.maxFontSize;
      let lines: string[] = [];
      while (fontSize >= options.minFontSize) {
        context.font = `${options.fontWeight} ${fontSize}px ${options.fontFamily}`;
        lines = wrapText(text, maxWidth);
        if (lines.length <= options.maxLines) break;
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
      visibleLines.forEach((line, index) => { context.fillText(line, x, y + (index * options.lineHeight)); });
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
    for (let gridX = 60; gridX < width; gridX += 80) { context.beginPath(); context.moveTo(gridX, 0); context.lineTo(gridX, height); context.stroke(); }
    for (let gridY = 90; gridY < height; gridY += 80) { context.beginPath(); context.moveTo(0, gridY); context.lineTo(width, gridY); context.stroke(); }
    context.restore();

    fillRoundedRect(748, 56, 268, 52, 26, 'rgba(0,255,136,0.12)');
    strokeRoundedRect(748, 56, 268, 52, 26, 'rgba(0,255,136,0.22)', 2);
    drawFittedText(dateLabel.toUpperCase(), 778, 90, 208, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 24, minFontSize: 14, color: '#00FF88' });

    context.font = '900 114px "Arial Black", sans-serif';
    context.fillStyle = '#F6FAFF';
    context.fillText('TREINO', 72, 238);
    context.fillStyle = '#00FF88';
    context.fillText('CONCLUIDO', 72, 338);

    drawWrappedText(challengeSubheadline, 74, 394, 932, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 34, minFontSize: 20, color: 'rgba(234,242,255,0.82)', maxLines: 2, lineHeight: 38 });

    fillRoundedRect(64, 444, 952, 250, 38, 'rgba(8,12,16,0.56)');
    strokeRoundedRect(64, 444, 952, 250, 38, 'rgba(255,255,255,0.08)', 2);

    drawFittedText(summary.workoutType.toUpperCase(), 102, 496, 500, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 22, minFontSize: 14, color: 'rgba(0,194,255,0.95)' });
    drawFittedText(`+${summary.xpEarned}`, 96, 622, 360, { fontFamily: '"Arial Black", sans-serif', fontWeight: 900, maxFontSize: 52, minFontSize: 44, color: '#FFFFFF' });
    context.font = '700 36px "Arial", sans-serif';
    context.fillStyle = '#00FF88';
    context.fillText('XP GANHO', 102, 664);

    const athleteName = profile.full_name.trim() || profile.username.trim() || 'Seu treino';
    drawFittedText(athleteName.toUpperCase(), 102, 560, 500, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 22, minFontSize: 14, color: 'rgba(234,242,255,0.78)' });

    fillRoundedRect(654, 486, 320, 170, 30, 'rgba(255,255,255,0.04)');
    strokeRoundedRect(654, 486, 320, 170, 30, 'rgba(255,255,255,0.12)', 2);
    drawFittedText('EXECUCAO DO TREINO', 686, 526, 236, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 18, minFontSize: 12, color: 'rgba(234,242,255,0.75)' });
    context.font = '900 74px "Arial Black", sans-serif';
    context.fillStyle = '#FFFFFF';
    context.fillText(`${Math.round(exerciseProgress * 100)}%`, 682, 610);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(686, 626, 256, 12);
    context.fillStyle = '#00FF88';
    context.fillRect(686, 626, 256 * exerciseProgress, 12);
    drawFittedText(`${summary.exercisesDone}/${summary.totalExercises} exercicios fechados`, 686, 662, 236, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 18, minFontSize: 12, color: 'rgba(234,242,255,0.82)' });

    drawWrappedText(summary.title.toUpperCase(), 74, 790, 932, { fontFamily: '"Arial Black", sans-serif', fontWeight: 800, maxFontSize: 52, minFontSize: 28, color: '#FFFFFF', maxLines: 2, lineHeight: 62 });
    drawFittedText(`${summary.muscleGroup.toUpperCase()}  •  ${summary.difficulty.toUpperCase()}  •  ${summary.completedAtLabel}`, 76, 918, 928, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 26, minFontSize: 16, color: 'rgba(234,242,255,0.68)' });

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
      drawFittedText(metric.label.toUpperCase(), x + 24, y + 34, cardWidth - 48, { fontFamily: '"Arial", sans-serif', fontWeight: 700, maxFontSize: 18, minFontSize: 12, color: 'rgba(0,255,136,0.82)' });
      drawWrappedText(metric.value.toUpperCase(), x + 24, y + 68, cardWidth - 48, { fontFamily: '"Arial Black", sans-serif', fontWeight: 800, maxFontSize: 32, minFontSize: 18, color: '#F5FAFF', maxLines: 2, lineHeight: 28 });
    });

    context.font = '700 20px "Arial", sans-serif';
    context.fillStyle = 'rgba(234,242,255,0.62)';
    context.fillText('Post gerado automaticamente pelo Repify para desafiar o feed.', 74, 1288);

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(createdBlob => {
        if (createdBlob) { resolve(createdBlob); return; }
        reject(new Error('Falha ao gerar imagem.'));
      }, 'image/png');
    });

    return { dataUrl, file: new File([blob], 'repify-challenge.png', { type: 'image/png' }) };
  }
}
