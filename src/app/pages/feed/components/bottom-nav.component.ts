import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 glass border-t border-border">
      <div class="flex items-center justify-around px-2 py-2 pb-safe">

        @for (item of navItems; track item.key) {
          <a [routerLink]="item.route"
             class="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all relative"
             [class]="active() === item.key ? 'text-primary' : 'text-text-2 hover:text-white'">

            @if (active() === item.key) {
              <div class="absolute inset-0 bg-primary/8 rounded-xl"></div>
              <div class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full shadow-glow-sm"></div>
            }

            <span class="relative text-xl leading-none" [innerHTML]="item.icon"></span>
            <span class="relative text-[10px] font-body font-medium">{{ item.label }}</span>
          </a>
        }

        <!-- CTA central: Treinar -->
        <div class="relative -mt-5">
          <button class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-glow hover:shadow-glow-lg transition-all active:scale-95 rotate-0 hover:rotate-6">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </button>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-body font-semibold text-primary whitespace-nowrap">Treinar</div>
        </div>
      </div>
    </nav>
  `,
})
export class BottomNavComponent {
  active = input<string>('feed');

  navItems: NavItem[] = [
    { key: 'feed',     label: 'Feed',      route: '/feed',      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { key: 'progress', label: 'Progresso', route: '/dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
    { key: 'spacer',   label: '',          route: '/feed',      icon: '' },
    { key: 'coach',    label: 'IA Coach',  route: '/dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4.5-4.5"/><circle cx="18.5" cy="5.5" r="2.5"/></svg>' },
    { key: 'profile',  label: 'Perfil',    route: '/dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  ];
}
