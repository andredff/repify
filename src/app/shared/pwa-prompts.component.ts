import { Component, inject } from '@angular/core';
import { PwaService } from '../core/services/pwa.service';

@Component({
  selector: 'app-pwa-prompts',
  standalone: true,
  template: `
    <!-- Update disponível -->
    @if (pwa.updateReady()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center px-6 animate-fade-in">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="pwa.updateReady.set(false)"></div>
        <div class="relative w-full max-w-[340px] bg-card border border-primary/30 rounded-2xl shadow-glow p-6 animate-slide-up flex flex-col items-center text-center gap-4">

          <button (click)="pwa.updateReady.set(false)"
                  aria-label="Fechar"
                  class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-[28px]">✨</div>
          <div>
            <p class="text-[16px] font-display font-bold text-white">Nova versão disponível</p>
            <p class="text-[12px] font-body text-text-2 mt-1">Atualize para aproveitar as últimas novidades do Repify.</p>
          </div>
          <div class="flex gap-2 w-full">
            <button (click)="pwa.updateReady.set(false)"
                    class="flex-1 py-2.5 rounded-xl text-[13px] font-body font-semibold bg-card-2 border border-border text-text-2 active:scale-95 transition-transform">
              Agora não
            </button>
            <button (click)="pwa.applyUpdate()"
                    class="flex-1 py-2.5 rounded-xl text-[13px] font-body font-bold bg-primary text-bg shadow-glow active:scale-95 transition-transform">
              Atualizar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Install disponível (Chrome/Edge Android/desktop) -->
    @if (pwa.installAvailable()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center px-6 animate-fade-in">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="pwa.dismissInstall()"></div>
        <div class="relative w-full max-w-[340px] bg-card border border-border rounded-2xl shadow-card p-6 animate-slide-up flex flex-col items-center text-center gap-4">

          <button (click)="pwa.dismissInstall()"
                  aria-label="Fechar"
                  class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-[28px]">📲</div>
          <div>
            <p class="text-[16px] font-display font-bold text-white">Instalar Repify</p>
            <p class="text-[12px] font-body text-text-2 mt-1">Adicione à tela inicial para acesso rápido, sem abrir o navegador.</p>
          </div>
          <div class="flex gap-2 w-full">
            <button (click)="pwa.dismissInstall()"
                    class="flex-1 py-2.5 rounded-xl text-[13px] font-body font-semibold bg-card-2 border border-border text-text-2 active:scale-95 transition-transform">
              Agora não
            </button>
            <button (click)="pwa.install()"
                    class="flex-1 py-2.5 rounded-xl text-[13px] font-body font-bold bg-primary text-bg shadow-glow active:scale-95 transition-transform">
              Instalar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- iOS: tutorial manual (Safari não tem beforeinstallprompt) -->
    @if (pwa.iosInstallTip()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center px-6 animate-fade-in">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="pwa.dismissInstall()"></div>
        <div class="relative w-full max-w-[340px] bg-card border border-primary/20 rounded-2xl shadow-card p-6 animate-slide-up flex flex-col items-center text-center gap-4">

          <button (click)="pwa.dismissInstall()"
                  aria-label="Fechar"
                  class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-[28px]">📲</div>
          <div>
            <p class="text-[16px] font-display font-bold text-white">Instalar Repify</p>
            <p class="text-[12px] font-body text-text-2 mt-1 leading-relaxed">
              Toque em
              <span class="inline-flex items-center justify-center mx-0.5 w-5 h-5 rounded bg-card-2 border border-border align-middle">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span>
              no Safari e depois em <span class="text-primary font-semibold">"Adicionar à Tela de Início"</span>.
            </p>
          </div>
          <button (click)="pwa.dismissInstall()"
                  class="w-full py-2.5 rounded-xl text-[13px] font-body font-semibold bg-card-2 border border-border text-text-2 active:scale-95 transition-transform">
            Entendi
          </button>
        </div>
      </div>
    }
  `,
})
export class PwaPromptsComponent {
  pwa = inject(PwaService);
}
