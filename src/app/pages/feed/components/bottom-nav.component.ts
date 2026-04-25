import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 glass border-t border-border">
      <div class="flex items-end justify-around px-1 pt-2 pb-3">

        <!-- Feed -->
        <a routerLink="/feed"
           class="flex flex-col items-center gap-1 w-14 py-1 rounded-xl transition-all relative"
           [class]="active() === 'feed' ? 'text-primary' : 'text-text-2 hover:text-white'">
          @if (active() === 'feed') {
            <div class="absolute inset-0 bg-primary/8 rounded-xl"></div>
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full shadow-glow-sm"></div>
          }
          <svg class="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span class="relative text-[10px] font-body font-medium leading-none">Feed</span>
        </a>

        <!-- Meu Treino -->
        <a routerLink="/my-workout"
           class="flex flex-col items-center gap-1 w-14 py-1 rounded-xl transition-all relative"
           [class]="active() === 'my-workout' ? 'text-primary' : 'text-text-2 hover:text-white'">
          @if (active() === 'my-workout') {
            <div class="absolute inset-0 bg-primary/8 rounded-xl"></div>
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full shadow-glow-sm"></div>
          }
          <svg class="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
          <span class="relative text-[10px] font-body font-medium leading-none">Treino</span>
        </a>

        <!-- CTA central: Postar -->
        <div class="flex flex-col items-center gap-1 w-14 py-1">
          <button (click)="onNewPost.emit()"
                  class="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-glow hover:shadow-glow-lg active:scale-95 transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span class="text-[10px] font-body font-semibold text-primary leading-none">Postar</span>
        </div>

        <!-- Progresso -->
        <a routerLink="/dashboard"
           class="flex flex-col items-center gap-1 w-14 py-1 rounded-xl transition-all relative"
           [class]="active() === 'progress' ? 'text-primary' : 'text-text-2 hover:text-white'">
          @if (active() === 'progress') {
            <div class="absolute inset-0 bg-primary/8 rounded-xl"></div>
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full shadow-glow-sm"></div>
          }
          <svg class="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span class="relative text-[10px] font-body font-medium leading-none">Progresso</span>
        </a>

        <!-- Perfil -->
        <a routerLink="/profile"
           class="flex flex-col items-center gap-1 w-14 py-1 rounded-xl transition-all relative"
           [class]="active() === 'profile' ? 'text-primary' : 'text-text-2 hover:text-white'">
          @if (active() === 'profile') {
            <div class="absolute inset-0 bg-primary/8 rounded-xl"></div>
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full shadow-glow-sm"></div>
          }
          <svg class="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="relative text-[10px] font-body font-medium leading-none">Perfil</span>
        </a>

      </div>
    </nav>
  `,
})
export class BottomNavComponent {
  active    = input<string>('feed');
  onNewPost = output<void>();
}
