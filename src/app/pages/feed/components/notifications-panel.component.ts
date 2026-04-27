import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, AppNotification } from '../../../core/services/notification.service';

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  like:    { icon: '❤️',  label: 'curtiu seu post',      color: 'text-red-400' },
  comment: { icon: '💬',  label: 'comentou no seu post', color: 'text-blue-400' },
  workout: { icon: '💪',  label: 'terminou um treino',   color: 'text-primary' },
  walk:    { icon: '🚶',  label: 'completou uma caminhada', color: 'text-primary' },
};

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-[80] flex flex-col max-w-[430px] mx-auto"
         style="padding-top:env(safe-area-inset-top);animation:shareSlideUp .28s cubic-bezier(.32,.72,0,1) both">

      <!-- Backdrop -->
      <div class="absolute inset-0 bg-bg/95 backdrop-blur-md" (click)="onClose.emit()"></div>

      <!-- Panel -->
      <div class="relative flex flex-col h-full">

        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-bg/80">
          <button (click)="onClose.emit()"
                  class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="flex items-center gap-2">
            <p class="text-[15px] font-display font-bold text-white">Notificações</p>
            @if (notifSvc.unreadCount() > 0) {
              <span class="text-[11px] font-body font-bold text-bg bg-primary rounded-full px-2 py-0.5 leading-none">
                {{ notifSvc.unreadCount() }}
              </span>
            }
          </div>
          @if (notifSvc.hasUnread()) {
            <button (click)="markAll()"
                    class="text-[12px] font-body text-primary underline underline-offset-2 active:opacity-70">
              Ler todas
            </button>
          } @else {
            <div class="w-16"></div>
          }
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto">

          @if (notifSvc.loading()) {
            <div class="flex flex-col gap-3 px-4 pt-5">
              @for (_ of [0,1,2]; track $index) {
                <div class="flex items-center gap-3 animate-pulse">
                  <div class="w-10 h-10 rounded-full bg-card-2 shrink-0"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3 w-3/4 bg-card-2 rounded-lg"></div>
                    <div class="h-2.5 w-1/2 bg-card-2 rounded-lg"></div>
                  </div>
                </div>
              }
            </div>
          }

          @if (!notifSvc.loading() && notifSvc.items().length === 0) {
            <div class="flex flex-col items-center justify-center h-64 gap-3">
              <span class="text-5xl">🔔</span>
              <p class="text-[14px] font-body font-semibold text-white">Sem notificações</p>
              <p class="text-[12px] font-body text-text-2 text-center px-8">Quando alguém curtir ou comentar no seu post, você verá aqui.</p>
            </div>
          }

          @if (!notifSvc.loading() && notifSvc.items().length > 0) {
            <div class="divide-y divide-border">
              @for (n of notifSvc.items(); track n.id) {
                <button (click)="openNotif(n)"
                        class="w-full flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-card-2/50 active:bg-card-2 text-left relative"
                        [class.bg-card-2/30]="!n.read">

                  @if (!n.read) {
                    <div class="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"></div>
                  }

                  <!-- Actor avatar -->
                  <div class="w-10 h-10 rounded-full border border-border bg-card overflow-hidden shrink-0 flex items-center justify-center text-lg">
                    @if (n.actor?.avatar) {
                      <img [src]="n.actor!.avatar" alt="" class="w-full h-full object-cover" />
                    } @else {
                      <span class="text-sm font-bold text-text-2">{{ (n.actor?.name ?? 'U').charAt(0).toUpperCase() }}</span>
                    }
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-body leading-snug" [class.text-white]="!n.read" [class.text-text-2]="n.read">
                      <span class="font-semibold text-white">{{ n.actor?.name ?? 'Alguém' }}</span>
                      {{ typeMeta(n.type).label }}
                    </p>
                    @if (n.type === 'comment' && n.body) {
                      <p class="text-[11px] font-body text-text-2 mt-0.5 truncate">"{{ n.body }}"</p>
                    }
                    <p class="text-[10px] font-body text-muted mt-1">{{ n.time_ago }}</p>
                  </div>

                  <!-- Type icon -->
                  <span class="text-lg shrink-0 mt-0.5">{{ typeMeta(n.type).icon }}</span>

                </button>
              }
            </div>
          }

          <div class="h-8"></div>
        </div>
      </div>
    </div>
  `,
})
export class NotificationsPanelComponent {
  onClose = output<void>();

  notifSvc = inject(NotificationService);
  private router = inject(Router);

  typeMeta(type: string) {
    return TYPE_META[type] ?? { icon: '🔔', label: 'atividade', color: 'text-text-2' };
  }

  async markAll(): Promise<void> {
    await this.notifSvc.markAllRead();
  }

  async openNotif(n: AppNotification): Promise<void> {
    if (!n.read) await this.notifSvc.markRead(n.id);
    if (n.post_id) {
      // Navigate to post — for now just close and let user scroll
    }
    this.onClose.emit();
  }
}
