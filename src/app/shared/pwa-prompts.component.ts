import { Component, inject } from '@angular/core';
import { PwaService } from '../core/services/pwa.service';

@Component({
  selector: 'app-pwa-prompts',
  standalone: true,
  template: `
    @if (pwa.updateReady()) {
      <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 animate-slide-up">
        <div class="bg-card border border-primary/40 rounded-2xl shadow-glow px-4 py-3 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-[18px] shrink-0">
            ✨
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-body font-semibold text-white leading-tight">Nova versão disponível</p>
            <p class="text-[11px] font-body text-text-2 leading-tight">Atualize para ver as novidades.</p>
          </div>
          <button (click)="pwa.applyUpdate()"
                  class="px-3 py-1.5 bg-primary text-bg rounded-lg text-[12px] font-body font-bold shrink-0 active:scale-95 transition-transform">
            Atualizar
          </button>
        </div>
      </div>
    }

    @if (pwa.installAvailable()) {
      <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 animate-slide-up">
        <div class="bg-card border border-border rounded-2xl shadow-card px-4 py-3 flex items-center gap-3">
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
    }
  `,
})
export class PwaPromptsComponent {
  pwa = inject(PwaService);
}
