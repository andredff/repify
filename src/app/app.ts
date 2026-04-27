import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaService } from './core/services/pwa.service';
import { PwaPromptsComponent } from './shared/pwa-prompts.component';

const LEGACY_LOCAL_STORAGE_PREFIXES = ['repify_home_rank_snapshot:'];

function clearLegacyLocalStorage(): void {
  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (LEGACY_LOCAL_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage access failures in restricted browser contexts.
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaPromptsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('repify');
  private pwa = inject(PwaService);

  ngOnInit(): void {
    clearLegacyLocalStorage();
    this.pwa.init();
  }
}
