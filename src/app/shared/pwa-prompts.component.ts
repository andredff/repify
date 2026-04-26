import { Component, inject } from '@angular/core';
import { PwaService } from '../core/services/pwa.service';

@Component({
  selector: 'app-pwa-prompts',
  standalone: true,
  template: `
    <!-- Update disponível -->
    @if (pwa.updateReady()) {
      <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 animate-slide-up">
        <div class="relative bg-card border border-primary/40 rounded-2xl shadow-glow px-4 py-3 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-[18px] shrink-0">
            ✨
          </div>
          <div class="flex-1 min-w-0 pr-6">
            <p class="text-[13px] font-body font-semibold text-white leading-tight">Nova versão disponível</p>
            <p class="text-[11px] font-body text-text-2 leading-tight">Atualize para ver as novidades.</p>
          </div>
          <button (click)="pwa.applyUpdate()"
                  class="px-3 py-1.5 bg-primary text-bg rounded-lg text-[12px] font-body font-bold shrink-0 active:scale-95 transition-transform">
            Atualizar
          </button>
          <button (click)="pwa.updateReady.set(false)"
                  aria-label="Fechar"
                  class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    }

    <!-- Install disponível (Chrome/Edge Android/desktop) -->
    @if (pwa.installAvailable()) {
      <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 animate-slide-up">
        <div class="relative bg-card border border-border rounded-2xl shadow-card pl-4 pr-12 py-3.5">
          <button (click)="pwa.dismissInstall()"
                  aria-label="Fechar"
                  class="absolute top-1/2 right-2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white hover:border-border-2 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-[18px] shrink-0">
              📲
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-body font-semibold text-white leading-tight">Instalar Repify</p>
              <p class="text-[11px] font-body text-text-2 leading-tight">Acesso rápido pela tela inicial.</p>
            </div>
            <button (click)="pwa.install()"
                    class="px-3 py-1.5 bg-primary text-bg rounded-lg text-[12px] font-body font-bold shrink-0 active:scale-95 transition-transform">
              Instalar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- iOS: tutorial manual (Safari não tem beforeinstallprompt) -->
    @if (pwa.iosInstallTip()) {
      <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 animate-slide-up">
        <div class="relative bg-card border border-primary/30 rounded-2xl shadow-card px-4 py-3.5">
          <button (click)="pwa.dismissInstall()"
                  aria-label="Fechar"
                  class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="flex items-start gap-3 pr-6">
            <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-[18px] shrink-0">
              📲
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-body font-semibold text-white leading-tight mb-1">Instalar Repify</p>
              <p class="text-[11px] font-body text-text-2 leading-snug">
                Toque em
                <span class="inline-flex items-center justify-center mx-0.5 w-5 h-5 rounded bg-card-2 border border-border align-middle">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                </span>
                no Safari e depois em
                <span class="text-primary font-semibold">"Adicionar à Tela de Início"</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class PwaPromptsComponent {
  pwa = inject(PwaService);
}
