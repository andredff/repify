import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PermissionService } from '../core/services/permission.service';

@Component({
  selector: 'app-preview-mode-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (permission.promptOpen()) {
      <div class="fixed inset-0 z-[95] flex items-end justify-center px-4 pb-4 sm:items-center"
           style="background:rgba(8,12,16,0.78)"
           (click)="permission.closePrompt()">
        <div class="w-full max-w-[360px] overflow-hidden rounded-[28px] border border-primary/20 bg-card shadow-2xl animate-slide-up"
             (click)="$event.stopPropagation()">
          <div class="border-b border-border bg-[linear-gradient(135deg,rgba(0,255,136,0.14),rgba(0,194,255,0.04))] px-5 py-4">
            <p class="text-[11px] font-body uppercase tracking-[0.26em] text-primary/80">Modo preview</p>
            <p class="mt-2 text-[20px] font-display font-bold text-white">Crie uma conta para interagir com a comunidade</p>
            <p class="mt-2 text-[13px] font-body leading-relaxed text-text-2">
              No preview você pode explorar o feed e abrir posts. Para {{ permission.promptReason() }}, entre ou crie sua conta.
            </p>
          </div>

          <div class="px-5 py-4 space-y-3">
            <button type="button"
                    (click)="permission.goToRegister()"
                    class="w-full rounded-2xl bg-primary px-4 py-3 text-[14px] font-body font-semibold text-bg shadow-glow transition-all hover:bg-primary/90">
              Criar conta
            </button>
            <button type="button"
                    (click)="permission.goToLogin()"
                    class="w-full rounded-2xl border border-border bg-card-2 px-4 py-3 text-[14px] font-body font-semibold text-white transition-colors hover:border-primary/40 hover:text-primary">
              Entrar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PreviewModePromptComponent {
  protected readonly permission = inject(PermissionService);
}
