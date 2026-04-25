import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface Story {
  name: string;
  initial: string;
  avatar: string;
  color: string;
  active: boolean;
  handle: string;
}

const MOCK_STORIES: Story[] = [
  { name: 'Mariana', initial: 'M', avatar: '', handle: 'mariana', color: 'linear-gradient(135deg,#FF3D5A40,#FF6B4A30)', active: true  },
  { name: 'Gabriel', initial: 'G', avatar: '', handle: 'gabriel', color: 'linear-gradient(135deg,#7C3AED40,#00C2FF30)', active: false },
  { name: 'Lucas',   initial: 'L', avatar: '', handle: 'lucas',   color: 'linear-gradient(135deg,#F59E0B40,#EF444430)', active: true  },
  { name: 'Julia',   initial: 'J', avatar: '', handle: 'julia',   color: 'linear-gradient(135deg,#10B98140,#00FF8830)', active: false },
  { name: 'Pedro',   initial: 'P', avatar: '', handle: 'pedro',   color: 'linear-gradient(135deg,#3B82F640,#7C3AED30)', active: false },
];

@Component({
  selector: 'app-stories-bar',
  standalone: true,
  template: `
    <div class="mt-3 overflow-x-auto scrollbar-none">
      <div class="flex gap-3 px-4" style="width: max-content">

        <!-- Meu story (usuário logado) — sempre primeiro -->
        <div class="flex flex-col items-center gap-1.5 cursor-pointer" (click)="goToMyProfile()">

          <!-- Ring gradiente verde sempre ativo -->
          <div class="p-[2px] rounded-full" style="background: linear-gradient(135deg, #00FF88, #00C2FF)">
            <div class="rounded-full border-2 border-bg overflow-hidden flex items-center justify-center font-display font-bold bg-gradient-to-br from-primary/20 to-secondary/10"
                 style="width:52px; height:52px; font-size:18px">
              @if (myAvatarUrl()) {
                <img [src]="myAvatarUrl()" alt="meu avatar" class="w-full h-full object-cover" />
              } @else {
                <span class="text-primary">{{ myInitial() }}</span>
              }
            </div>
          </div>

          <span class="text-[10px] font-body font-semibold text-primary">Você</span>
        </div>

        <!-- Stories dos outros usuários (mock) -->
        @for (story of stories; track story.handle) {
          <div class="flex flex-col items-center gap-1.5 cursor-pointer" (click)="goToProfile(story.handle)">
            <div class="p-[2px] rounded-full"
                 [style]="story.active ? 'background: linear-gradient(135deg, #00FF88, #00C2FF)' : 'background: #1A2535'">
              <div class="rounded-full flex items-center justify-center text-sm font-display font-bold border-2 border-bg overflow-hidden"
                   [style]="'background:' + story.color + '; width:52px; height:52px'">
                @if (story.avatar) {
                  <img [src]="story.avatar" alt="avatar" class="w-full h-full object-cover" />
                } @else {
                  {{ story.initial }}
                }
              </div>
            </div>
            <span class="text-[10px] font-body" [class]="story.active ? 'text-white' : 'text-text-2'">
              {{ story.name }}
            </span>
          </div>
        }

      </div>
    </div>
  `,
})
export class StoriesBarComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  stories = MOCK_STORIES;

  myAvatarUrl = computed(() => this.auth.avatarUrl());

  myInitial = computed(() => {
    const name  = this.auth.profile().full_name;
    const email = this.auth.user()?.email ?? '';
    return (name || email).charAt(0).toUpperCase() || 'U';
  });

  goToMyProfile(): void {
    const handle = this.auth.profile().username || this.auth.user()?.id;
    if (handle) this.router.navigateByUrl(`/u/${handle}`);
  }

  goToProfile(handle: string): void {
    this.router.navigateByUrl(`/u/${handle}`);
  }
}
