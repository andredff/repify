import { Injectable, signal, inject, NgZone, computed } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'repify_pwa_dismissed';
const DISMISS_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PwaService {
  private swUpdate = inject(SwUpdate);
  private zone     = inject(NgZone);

  /** Nova versão do app está pronta — peça para o usuário recarregar. */
  readonly updateReady = signal(false);

  /** O navegador pediu para instalar o app (Android/desktop Chrome/Edge). */
  readonly installAvailable = signal(false);

  /** Estamos no Safari iOS e o app não está instalado — exibir instruções manuais. */
  readonly iosInstallTip = signal(false);

  /** Combinação prática: deve mostrar algum tipo de prompt de instalação. */
  readonly canShowInstallPrompt = computed(
    () => this.installAvailable() || this.iosInstallTip(),
  );

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  init(): void {
    this.watchForUpdates();
    this.watchInstallPrompt();
    this.detectIosInstallability();
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

  /** Usuário fechou o prompt — não mostra novamente por DISMISS_DAYS dias. */
  dismissInstall(): void {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    this.installAvailable.set(false);
    this.iosInstallTip.set(false);
  }

  private isDismissed(): boolean {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return ageDays < DISMISS_DAYS;
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
      if (this.isDismissed()) return;
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.zone.run(() => this.installAvailable.set(true));
    });

    window.addEventListener('appinstalled', () => {
      this.zone.run(() => {
        this.installAvailable.set(false);
        this.iosInstallTip.set(false);
        this.deferredPrompt = null;
      });
    });
  }

  private detectIosInstallability(): void {
    if (this.isDismissed()) return;

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    if (!isIos) return;

    // Em iOS, o evento beforeinstallprompt não existe.
    // Detecta se já está instalado via display-mode standalone ou navigator.standalone.
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Mostra dica manual com pequeno atraso para não atrapalhar a interação inicial.
    setTimeout(() => this.zone.run(() => this.iosInstallTip.set(true)), 2000);
  }
}
