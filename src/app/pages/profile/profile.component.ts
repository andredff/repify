import { Component, inject, signal, computed, OnInit, ElementRef, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { CheckinService } from '../../core/services/checkin.service';
import { RankingService } from '../../core/services/ranking.service';
import { NewPostModalComponent } from '../feed/components/new-post-modal.component';
import { ImageCropperComponent } from '../../shared/image-cropper.component';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const a = control.get('newPassword')?.value;
  const b = control.get('confirmPassword')?.value;
  return a && b && a !== b ? { mismatch: true } : null;
}

type ActiveTab = 'info' | 'security';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB   = 5;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, BottomNavComponent, NewPostModalComponent, ImageCropperComponent, FeedHeaderComponent, NotificationsPanelComponent],
  template: `
    @if (showNewPost()) {
      <app-new-post-modal (onClose)="showNewPost.set(false)" />
    }
    @if (avatarCropSrc()) {
      <app-image-cropper
        [src]="avatarCropSrc()!"
        shape="circle"
        [aspectW]="1" [aspectH]="1"
        [outputSize]="512"
        (onCancel)="avatarCropSrc.set(null)"
        (onCropped)="onAvatarCropped($event)" />
    }
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto relative">

      <!-- Hidden file input -->
      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        (change)="onFileSelected($event)"
      />

      <app-feed-header
        [showBack]="true"
        (onBack)="location.back()"
        (onOpenNotifications)="showNotifications.set(true)" />

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto pb-28" style="padding-top: calc(76px + env(safe-area-inset-top))">

        <section class="px-4 pt-0 pb-5">
          <p class="text-[22px] font-display font-bold text-white">Meu Perfil</p>
          <p class="text-[12px] font-body text-text-2 mt-1">Edite sua conta e acompanhe seus dados</p>
        </section>

        <!-- Avatar hero -->
        <div class="relative flex flex-col items-center pt-8 pb-6 px-4">
          <div class="absolute top-4 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

          <div class="relative z-10">
            <!-- Avatar ring + image -->
            <div class="relative w-24 h-24 rounded-full">

              <!-- Upload progress ring (SVG) -->
              @if (avatarUploading()) {
                <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="47" fill="none" stroke="#1A2535" stroke-width="3"/>
                  <circle cx="50" cy="50" r="47" fill="none" stroke="#00FF88" stroke-width="3"
                          stroke-linecap="round" stroke-dasharray="295"
                          [attr.stroke-dashoffset]="295 - (295 * uploadProgress() / 100)"
                          style="transition: stroke-dashoffset 0.2s ease"/>
                </svg>
              }
              <!-- Avatar image or initials -->
              <div class="w-full h-full rounded-full border-2 overflow-hidden flex items-center justify-center text-3xl font-display font-bold bg-gradient-to-br from-primary/20 to-secondary/10 select-none"
                   [class]="avatarUploading() ? 'border-primary/30' : 'border-primary/50 shadow-glow'">
                @if (avatarPreview() || auth.avatarUrl()) {
                  <img [src]="avatarPreview() || auth.avatarUrl()"
                       alt="Avatar"
                       class="w-full h-full object-cover"
                       [class]="avatarUploading() ? 'opacity-50' : 'opacity-100'"
                  />
                } @else {
                  {{ avatarInitial() }}
                }
              </div>

                      @if (showNotifications()) {
                        <app-notifications-panel (onClose)="showNotifications.set(false)" />
                      }

              <!-- Loading overlay -->
              @if (avatarUploading()) {
                <div class="absolute inset-0 flex items-center justify-center rounded-full">
                  <span class="text-[11px] font-mono font-bold text-primary">{{ uploadProgress() }}%</span>
                </div>
              }
            </div>

            <!-- Edit badge button -->
            <button
              (click)="fileInput.click()"
              [disabled]="avatarUploading()"
              class="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-glow-sm hover:shadow-glow transition-all active:scale-90 disabled:opacity-50"
            >
              @if (avatarUploading()) {
                <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="2.5" stroke-linecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              } @else {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              }
            </button>
          </div>

          <!-- Avatar feedback -->
          @if (avatarError()) {
            <p class="mt-2 text-[11px] text-danger font-body z-10 animate-fade-in">{{ avatarError() }}</p>
          }
          @if (avatarSuccess()) {
            <p class="mt-2 text-[11px] text-primary font-body z-10 animate-fade-in">Foto atualizada!</p>
          }

                    <!-- Avatar hint -->
          <p class="mt-1 text-[8px] text-text-2 font-body z-10">
            JPG, PNG ou WEBP · máx {{ MAX_SIZE_MB }}MB
          </p>

          <!-- Name + email -->
          <div class="mt-5 text-center z-10">
            <p class="text-[17px] font-display font-bold text-white">
              {{ displayName() || 'Sem nome' }}
            </p>
            <p class="text-[12px] text-text-2 font-body mt-0.5">{{ auth.user()?.email }}</p>
          </div>

          <!-- Stats strip -->
          <div class="mt-4 flex gap-4 z-10">
            <div class="flex flex-col items-center">
              <span class="text-[18px] font-display font-bold text-primary">🔥 {{ backendStreak() }}</span>
              <span class="text-[10px] text-text-2 font-body">streak</span>
            </div>
            <div class="w-px bg-border"></div>
            <div class="flex flex-col items-center">
              <span class="text-[18px] font-display font-bold text-white">{{ checkin.dates().length }}</span>
              <span class="text-[10px] text-text-2 font-body">check-ins</span>
            </div>
            <div class="w-px bg-border"></div>
            <div class="flex flex-col items-center">
              <span class="text-[18px] font-display font-bold text-white">
                {{ auth.profile().weight ? auth.profile().weight + 'kg' : '--' }}
              </span>
              <span class="text-[10px] text-text-2 font-body">peso</span>
            </div>
          </div>

          <!-- Meta anual (hero) -->
          @if (auth.profile().yearly_goal) {
            <div class="mt-4 w-full z-10 px-2 space-y-1.5">
              <div class="flex justify-between items-center">
                <span class="text-[11px] font-body text-text-2">Meta anual</span>
                <span class="text-[11px] font-mono font-semibold text-primary">
                  {{ backendWorkoutsDone() }} / {{ auth.profile().yearly_goal }} treinos
                </span>
              </div>
              <div class="h-1.5 bg-border rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500"
                     [style.width]="heroProgressPct() + '%'"></div>
              </div>
              <p class="text-[10px] text-text-2 font-body text-right">{{ heroProgressPct() }}% concluído</p>
            </div>
          }

          <!-- Invite button -->
          <button (click)="shareInvite()"
                  class="mt-4 z-10 flex items-center gap-2 px-4 py-2 rounded-xl border transition-all active:scale-95"
                  [class]="copied() ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-card-2 border-border text-text-2 hover:border-primary/40 hover:text-white'">
            @if (copied()) {
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span class="text-[12px] font-body font-semibold">Link copiado!</span>
            } @else {
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              <span class="text-[12px] font-body">Convidar amigos</span>
            }
          </button>
        </div>

        <!-- Tabs -->
        <div class="mx-4 flex bg-card-2 border border-border rounded-xl p-1 gap-1 mb-5">
          <button
            (click)="activeTab.set('info')"
            class="flex-1 py-2 rounded-lg text-[13px] font-body font-medium transition-all"
            [class]="activeTab() === 'info' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
            Dados Pessoais
          </button>
          <button
            (click)="activeTab.set('security')"
            class="flex-1 py-2 rounded-lg text-[13px] font-body font-medium transition-all"
            [class]="activeTab() === 'security' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
            Segurança
          </button>
        </div>

        <!-- ── TAB: Dados Pessoais ── -->
        @if (activeTab() === 'info') {
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="px-4 space-y-4 animate-fade-in">

            <div class="space-y-1.5">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Nome completo</label>
              <input type="text" formControlName="full_name" placeholder="Seu nome"
                     class="w-full bg-card-2 border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted"
                     [class]="fieldClass(profileForm.get('full_name')!)" />
            </div>

            <div class="space-y-1.5">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Username</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-2 text-[14px] font-body select-none">@</span>
                <input type="text" formControlName="username" placeholder="seu_username"
                       class="w-full bg-card-2 border rounded-xl pl-8 pr-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted"
                       [class]="fieldClass(profileForm.get('username')!)" />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Bio</label>
              <textarea formControlName="bio" placeholder="Conte um pouco sobre você..." rows="3"
                        class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted resize-none focus:border-primary/60"></textarea>
              <p class="text-[10px] text-text-2 text-right px-1">{{ profileForm.get('bio')?.value?.length ?? 0 }}/120</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Objetivo</label>
              <div class="grid grid-cols-3 gap-2">
                @for (opt of goalOptions; track opt.value) {
                  <button type="button" (click)="profileForm.get('goal')!.setValue(opt.value)"
                          class="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center"
                          [class]="profileForm.get('goal')?.value === opt.value
                            ? 'border-primary/50 bg-primary/10 text-primary shadow-glow-sm'
                            : 'border-border bg-card-2 text-text-2 hover:border-border-2 hover:text-white'">
                    <span class="text-xl">{{ opt.emoji }}</span>
                    <span class="text-[10px] font-body font-medium leading-tight">{{ opt.label }}</span>
                  </button>
                }
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Peso</label>
                <div class="relative">
                  <input type="number" formControlName="weight" placeholder="75"
                         class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted focus:border-primary/60 pr-10" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">kg</span>
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Altura</label>
                <div class="relative">
                  <input type="number" formControlName="height" placeholder="175"
                         class="w-full bg-card-2 border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted focus:border-primary/60 pr-10" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">cm</span>
                </div>
              </div>
            </div>

            <!-- Meta anual -->
            <div class="bg-card-2 border border-border rounded-2xl p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <p class="text-[13px] font-body font-semibold text-white">Meta anual de treinos</p>
                  <p class="text-[11px] text-text-2 font-body">Progresso exibido nas suas postagens</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Meta do ano</label>
                  <div class="relative">
                    <input type="number" formControlName="yearly_goal" placeholder="100" min="1" max="999"
                           class="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted focus:border-primary/60 pr-16" />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">treinos</span>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Já realizados</label>
                  <div class="relative">
                    <div class="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] font-body text-white pr-16">
                      {{ backendWorkoutsDone() }}
                    </div>
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-2 font-body">backend</span>
                  </div>
                </div>
              </div>
              @if (profileForm.get('yearly_goal')?.value) {
                <div class="space-y-1">
                  <div class="flex justify-between text-[11px] font-body">
                    <span class="text-text-2">Progresso</span>
                    <span class="text-primary font-semibold">
                      {{ backendWorkoutsDone() }} / {{ profileForm.get('yearly_goal')?.value }}
                    </span>
                  </div>
                  <div class="h-1.5 bg-border rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full transition-all"
                         [style.width]="progressPct() + '%'"></div>
                  </div>
                </div>
              }
            </div>

            <div class="space-y-1.5">
              <label class="text-[11px] font-body font-medium text-text-2 uppercase tracking-wider px-1">Email</label>
              <div class="w-full bg-card border border-border/50 rounded-xl px-4 py-3 text-[14px] font-body text-text-2 flex items-center justify-between">
                <span>{{ auth.user()?.email }}</span>
                <span class="text-[10px] bg-border text-text-2 px-2 py-0.5 rounded-md font-body">verificado</span>
              </div>
              <p class="text-[10px] text-text-2 px-1">Para alterar o email, acesse a aba Segurança.</p>
            </div>

            @if (profileFeedback()) {
              <div class="flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-body border animate-fade-in"
                   [class]="profileSuccess() ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-danger/10 border-danger/30 text-danger'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  @if (profileSuccess()) { <polyline points="20 6 9 17 4 12"/> }
                  @else { <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/> }
                </svg>
                {{ profileFeedback() }}
              </div>
            }

            <button type="submit" [disabled]="profileLoading()"
                    class="w-full bg-primary text-bg py-3.5 rounded-xl text-[14px] font-body font-semibold hover:shadow-glow transition-all disabled:opacity-60 active:scale-[0.98]">
              {{ profileLoading() ? 'Salvando...' : 'Salvar alterações' }}
            </button>

          </form>
        }

        <!-- ── TAB: Segurança ── -->
        @if (activeTab() === 'security') {
          <div class="px-4 space-y-5 animate-fade-in">

            <div class="bg-card-2 border border-border rounded-2xl p-4 space-y-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p class="text-[13px] font-body font-semibold text-white">Alterar email</p>
                  <p class="text-[11px] text-text-2 font-body">Atual: {{ auth.user()?.email }}</p>
                </div>
              </div>
              <form [formGroup]="emailForm" (ngSubmit)="saveEmail()" class="space-y-3">
                <input type="email" formControlName="newEmail" placeholder="Novo email"
                       class="w-full bg-card border rounded-xl px-4 py-3 text-[14px] font-body outline-none transition-colors placeholder:text-muted"
                       [class]="fieldClass(emailForm.get('newEmail')!)" />
                @if (emailFeedback()) {
                  <p class="text-[12px] px-1 font-body" [class]="emailSuccess() ? 'text-primary' : 'text-danger'">{{ emailFeedback() }}</p>
                }
                <button type="submit" [disabled]="emailLoading() || emailForm.invalid"
                        class="w-full bg-secondary/15 border border-secondary/30 text-secondary py-2.5 rounded-xl text-[13px] font-body font-semibold hover:bg-secondary/25 transition-all disabled:opacity-50 active:scale-[0.98]">
                  {{ emailLoading() ? 'Enviando...' : 'Enviar link de confirmação' }}
                </button>
              </form>
            </div>

            <div class="bg-card-2 border border-border rounded-2xl p-4 space-y-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <p class="text-[13px] font-body font-semibold text-white">Alterar senha</p>
                  <p class="text-[11px] text-text-2 font-body">Mínimo 6 caracteres</p>
                </div>
              </div>
              <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" class="space-y-3">
                <div class="relative">
                  <input [type]="showNew() ? 'text' : 'password'" formControlName="newPassword" placeholder="Nova senha"
                         class="w-full bg-card border rounded-xl px-4 py-3 pr-11 text-[14px] font-body outline-none transition-colors placeholder:text-muted"
                         [class]="fieldClass(passwordForm.get('newPassword')!)" />
                  <button type="button" (click)="showNew.update(v => !v)" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      @if (showNew()) {
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      } @else {
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      }
                    </svg>
                  </button>
                </div>
                <div class="relative">
                  <input [type]="showConfirm() ? 'text' : 'password'" formControlName="confirmPassword" placeholder="Confirmar nova senha"
                         class="w-full bg-card border rounded-xl px-4 py-3 pr-11 text-[14px] font-body outline-none transition-colors placeholder:text-muted"
                         [class]="passwordForm.get('confirmPassword')?.touched && passwordForm.hasError('mismatch') ? 'border-danger/60' : fieldClass(passwordForm.get('confirmPassword')!)" />
                  <button type="button" (click)="showConfirm.update(v => !v)" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      @if (showConfirm()) {
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      } @else {
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      }
                    </svg>
                  </button>
                </div>
                @if (passwordForm.get('newPassword')?.value) {
                  <div class="space-y-1 animate-fade-in">
                    <div class="flex gap-1">
                      @for (bar of [1,2,3,4]; track bar) {
                        <div class="flex-1 h-1 rounded-full transition-all" [class]="bar <= passwordStrength() ? strengthColor() : 'bg-border'"></div>
                      }
                    </div>
                    <p class="text-[10px] font-body px-0.5" [class]="strengthTextColor()">{{ strengthLabel() }}</p>
                  </div>
                }
                @if (passwordForm.get('confirmPassword')?.touched && passwordForm.hasError('mismatch')) {
                  <p class="text-danger text-[12px] font-body px-1">Senhas não coincidem</p>
                }
                @if (passwordFeedback()) {
                  <p class="text-[12px] px-1 font-body" [class]="passwordSuccess() ? 'text-primary' : 'text-danger'">{{ passwordFeedback() }}</p>
                }
                <button type="submit" [disabled]="passwordLoading() || passwordForm.invalid"
                        class="w-full bg-primary text-bg py-3.5 rounded-xl text-[14px] font-body font-semibold hover:shadow-glow transition-all disabled:opacity-60 active:scale-[0.98]">
                  {{ passwordLoading() ? 'Alterando...' : 'Alterar senha' }}
                </button>
              </form>
            </div>

            <!-- Convidar amigos -->
            <div class="bg-card-2 border border-border rounded-2xl p-4">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </div>
                <div>
                  <p class="text-[13px] font-body font-semibold text-white">Convidar amigos</p>
                  <p class="text-[11px] text-text-2 font-body">Chame seus amigos para treinar juntos 💪</p>
                </div>
              </div>
              <div class="flex gap-2">
                <div class="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-[11px] font-mono text-text-2 truncate flex items-center">
                  {{ inviteUrl }}
                </div>
                <button (click)="shareInvite()"
                        class="px-4 py-2 rounded-xl text-[12px] font-body font-semibold transition-all active:scale-95"
                        [class]="copied() ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-primary text-bg shadow-glow-sm'">
                  {{ copied() ? 'Copiado!' : 'Convidar' }}
                </button>
              </div>
            </div>

            <div class="bg-danger/5 border border-danger/20 rounded-2xl p-4">
              <p class="text-[12px] font-body font-semibold text-danger mb-1">Zona de perigo</p>
              <p class="text-[11px] text-text-2 font-body mb-3">Esta ação é irreversível e apagará todos os seus dados.</p>
              <button class="text-[12px] font-body text-danger border border-danger/30 px-4 py-2 rounded-lg hover:bg-danger/10 transition-colors">
                Excluir minha conta
              </button>
            </div>

          </div>
        }

      </div>

      <app-bottom-nav [active]="''" (onNewPost)="showNewPost.set(true)" />
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  auth    = inject(AuthService);
  checkin = inject(CheckinService);
  ranking = inject(RankingService);
  router  = inject(Router);
  location = inject(Location);
  private fb = inject(FormBuilder);

  readonly MAX_SIZE_MB = MAX_SIZE_MB;
  readonly inviteUrl   = 'https://repify.com.br';
  copied = signal(false);

  activeTab = signal<ActiveTab>('info');

  // Avatar state
  avatarCropSrc   = signal<string | null>(null);
  avatarPreview   = signal<string>('');
  avatarUploading = signal(false);
  uploadProgress  = signal(0);
  showNewPost = signal(false);
  showNotifications = signal(false);
  avatarError     = signal('');
  avatarSuccess   = signal(false);

  // Profile form state
  profileLoading  = signal(false);
  profileFeedback = signal('');
  profileSuccess  = signal(false);

  // Email form state
  emailLoading  = signal(false);
  emailFeedback = signal('');
  emailSuccess  = signal(false);

  // Password form state
  passwordLoading  = signal(false);
  passwordFeedback = signal('');
  passwordSuccess  = signal(false);
  showNew     = signal(false);
  showConfirm = signal(false);

  profileForm!: FormGroup;
  emailForm!: FormGroup;
  passwordForm!: FormGroup;

  goalOptions = [
    { value: 'hipertrofia',   emoji: '💪', label: 'Hipertrofia' },
    { value: 'emagrecimento', emoji: '🔥', label: 'Emagrecer'   },
    { value: 'resistencia',   emoji: '⚡', label: 'Resistência' },
    { value: 'forca',         emoji: '🏋️', label: 'Força'       },
    { value: 'saude',         emoji: '❤️', label: 'Saúde'       },
    { value: 'performance',   emoji: '🏃', label: 'Performance' },
  ];

  avatarInitial = computed(() => {
    const name  = this.auth.profile().full_name;
    const email = this.auth.user()?.email ?? '';
    return (name || email).charAt(0).toUpperCase();
  });

  displayName = computed(() => this.auth.profile().full_name);

  passwordStrength = computed<number>(() => {
    const pw = this.passwordForm?.get('newPassword')?.value ?? '';
    let score = 0;
    if (pw.length >= 6)  score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  });

  strengthColor     = computed(() => ['bg-danger','bg-danger','bg-yellow-400','bg-secondary','bg-primary'][this.passwordStrength()]);
  strengthTextColor = computed(() => ['text-danger','text-danger','text-yellow-400','text-secondary','text-primary'][this.passwordStrength()]);
  strengthLabel     = computed(() => ['Muito fraca','Fraca','Média','Forte','Muito forte'][this.passwordStrength()] ?? '');
  backendWorkoutsDone = computed(() => this.ranking.myRank()?.workoutsDone ?? Number(this.auth.profile().workouts_done ?? 0));
  backendStreak = computed(() => this.ranking.myRank()?.streakDays ?? this.checkin.streak());

  heroProgressPct = computed(() => {
    const done = this.backendWorkoutsDone();
    const goal = Number(this.auth.profile().yearly_goal ?? 0);
    if (!goal) return 0;
    return Math.min(Math.round((done / goal) * 100), 100);
  });

  progressPct = computed(() => {
    const done = this.backendWorkoutsDone();
    const goal = Number(this.profileForm?.get('yearly_goal')?.value);
    if (!goal || !done) return 0;
    return Math.min(Math.round((done / goal) * 100), 100);
  });

  ngOnInit(): void {
    const p = this.auth.profile();
    this.profileForm = this.fb.group({
      full_name:    [p.full_name,    [Validators.maxLength(60)]],
      username:     [p.username,     [Validators.maxLength(30), Validators.pattern(/^[a-z0-9_.]*$/)]],
      bio:          [p.bio,          [Validators.maxLength(120)]],
      goal:         [p.goal],
      weight:       [p.weight,       [Validators.min(20), Validators.max(400)]],
      height:       [p.height,       [Validators.min(50), Validators.max(300)]],
      yearly_goal:  [p.yearly_goal,  [Validators.min(1), Validators.max(999)]],
    });
    this.emailForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
    });
    this.passwordForm = this.fb.group(
      { newPassword: ['', [Validators.required, Validators.minLength(6)]], confirmPassword: ['', Validators.required] },
      { validators: passwordsMatch },
    );
  }

  fieldClass(control: AbstractControl | null): string {
    if (!control) return 'border-border focus:border-primary/60';
    if (control.touched && control.invalid) return 'border-danger/60';
    if (control.touched && control.valid)   return 'border-primary/40';
    return 'border-border focus:border-primary/60';
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.avatarError.set('');
    this.avatarSuccess.set(false);
    input.value = '';

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.avatarError.set('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      this.avatarError.set(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Open cropper instead of uploading directly
    const reader = new FileReader();
    reader.onload = e => this.avatarCropSrc.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async onAvatarCropped(result: { dataUrl: string; blob: Blob }): Promise<void> {
    this.avatarCropSrc.set(null);
    this.avatarPreview.set(result.dataUrl);
    this.avatarUploading.set(true);
    this.uploadProgress.set(0);

    const progressInterval = setInterval(() => {
      this.uploadProgress.update(p => Math.min(p + 15, 85));
    }, 200);

    const file = new File([result.blob], 'avatar.png', { type: 'image/png' });
    try {
      await this.auth.uploadAvatar(file);
      clearInterval(progressInterval);
      this.uploadProgress.set(100);
      this.avatarSuccess.set(true);
      setTimeout(() => { this.avatarSuccess.set(false); this.uploadProgress.set(0); }, 3000);
    } catch (err: any) {
      clearInterval(progressInterval);
      this.avatarPreview.set('');
      this.avatarError.set(err?.message ?? 'Erro ao enviar foto.');
    } finally {
      this.avatarUploading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.profileLoading.set(true);
    this.profileFeedback.set('');
    try {
      await this.auth.updateProfile(this.profileForm.value);
      this.profileSuccess.set(true);
      this.profileFeedback.set('Perfil atualizado com sucesso!');
      setTimeout(() => this.profileFeedback.set(''), 4000);
    } catch (err: any) {
      this.profileSuccess.set(false);
      this.profileFeedback.set(err?.message ?? 'Erro ao salvar perfil.');
    } finally {
      this.profileLoading.set(false);
    }
  }

  async saveEmail(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.emailLoading.set(true);
    this.emailFeedback.set('');
    try {
      await this.auth.updateEmail(this.emailForm.value.newEmail);
      this.emailSuccess.set(true);
      this.emailFeedback.set('Link de confirmação enviado para o novo email.');
      this.emailForm.reset();
    } catch (err: any) {
      this.emailSuccess.set(false);
      this.emailFeedback.set(err?.message ?? 'Erro ao atualizar email.');
    } finally {
      this.emailLoading.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.passwordLoading.set(true);
    this.passwordFeedback.set('');
    try {
      await this.auth.updatePassword(this.passwordForm.value.newPassword);
      this.passwordSuccess.set(true);
      this.passwordFeedback.set('Senha alterada com sucesso!');
      this.passwordForm.reset();
      setTimeout(() => this.passwordFeedback.set(''), 4000);
    } catch (err: any) {
      this.passwordSuccess.set(false);
      this.passwordFeedback.set(err?.message ?? 'Erro ao alterar senha.');
    } finally {
      this.passwordLoading.set(false);
    }
  }

  async shareInvite(): Promise<void> {
    const text = 'Treine, evolua e compartilhe sua jornada fitness no Repify! 💪';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Repify', text, url: this.inviteUrl });
        return;
      } catch { /* usuário cancelou */ }
    }
    await navigator.clipboard.writeText(this.inviteUrl);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/');
  }
}
