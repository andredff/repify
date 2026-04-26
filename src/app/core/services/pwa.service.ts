import { Injectable, signal, inject, NgZone } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  private swUpdate = inject(SwUpdate);
  private zone     = inject(NgZone);

  /** Nova versão do app está pronta — peça para o usuário recarregar. */
  readonly updateReady = signal(false);

  /** O navegador pediu para instalar o app (Android/desktop). */
  readonly installAvailable = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  init(): void {
    this.watchForUpdates();
    this.watchInstallPrompt();
  }

  applyUpdate(): void {
    document.location.reload();
  }

  async install(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.deferredPrompt = null;
      this.installAvailable.set(false);
    }
  }

  private watchForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.zone.run(() => this.updateReady.set(true));
      });

    // Verifica updates a cada 30 minutos
    setInterval(() => this.swUpdate.checkForUpdate().catch(() => {}), 30 * 60 * 1000);
  }

  private watchInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.zone.run(() => this.installAvailable.set(true));
    });

    window.addEventListener('appinstalled', () => {
      this.zone.run(() => {
        this.installAvailable.set(false);
        this.deferredPrompt = null;
      });
    });
  }
}
