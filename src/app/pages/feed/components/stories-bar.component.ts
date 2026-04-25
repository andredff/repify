import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, PublicUser } from '../../../core/services/user.service';

const COLOR_PALETTE = [
  'linear-gradient(135deg,#FF3D5A40,#FF6B4A30)',
  'linear-gradient(135deg,#7C3AED40,#00C2FF30)',
  'linear-gradient(135deg,#F59E0B40,#EF444430)',
  'linear-gradient(135deg,#10B98140,#00FF8830)',
  'linear-gradient(135deg,#3B82F640,#7C3AED30)',
  'linear-gradient(135deg,#EC489940,#F43F5E30)',
];

@Component({
  selector: 'app-stories-bar',
  standalone: true,
  template: `
    <div class="mt-3 overflow-x-auto scrollbar-none">
      <div class="flex gap-3 px-4" style="width: max-content">

        <!-- Meu story (usuário logado) — sempre primeiro -->
        <div class="flex flex-col items-center gap-1.5 cursor-pointer" (click)="goToMyProfile()">
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

        <!-- Stories de outros usuários reais -->
        @if (loading()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="flex flex-col items-center gap-1.5 animate-pulse">
              <div class="rounded-full bg-card-2 border border-border" style="width:56px; height:56px"></div>
              <div class="h-2 w-10 rounded bg-card-2"></div>
            </div>
          }
        } @else {
          @for (user of users(); track user.id) {
            <div class="flex flex-col items-center gap-1.5 cursor-pointer" (click)="goToProfile(user)">
              <div class="p-[2px] rounded-full" style="background: linear-gradient(135deg, #00FF88, #00C2FF)">
                <div class="rounded-full flex items-center justify-center text-sm font-display font-bold border-2 border-bg overflow-hidden text-white"
                     [style]="'background:' + colorFor($index) + '; width:52px; height:52px'">
                  @if (user.avatar) {
                    <img [src]="user.avatar" alt="avatar" class="w-full h-full object-cover" />
                  } @else {
                    {{ initialOf(user) }}
                  }
                </div>
              </div>
              <span class="text-[10px] font-body text-white max-w-[60px] truncate">
                {{ displayName(user) }}
              </span>
            </div>
          }
        }

      </div>
    </div>
  `,
})
export class StoriesBarComponent implements OnInit {
  private auth        = inject(AuthService);
  private router      = inject(Router);
  private userService = inject(UserService);

  users   = signal<PublicUser[]>([]);
  loading = signal(false);

  myAvatarUrl = computed(() => this.auth.avatarUrl());

  myInitial = computed(() => {
    const name  = this.auth.profile().full_name;
    const email = this.auth.user()?.email ?? '';
    return (name || email).charAt(0).toUpperCase() || 'U';
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.userService.listUsers(20);
      this.users.set(data);
    } catch {
      this.users.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  colorFor(index: number): string {
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  }

  initialOf(user: PublicUser): string {
    return (user.name || user.email || 'U').charAt(0).toUpperCase();
  }

  displayName(user: PublicUser): string {
    return user.name?.split(' ')[0] || user.username || 'User';
  }

  goToMyProfile(): void {
    const handle = this.auth.profile().username || this.auth.user()?.id;
    if (handle) this.router.navigateByUrl(`/u/${handle}`);
  }

  goToProfile(user: PublicUser): void {
    const handle = user.username || user.id;
    this.router.navigateByUrl(`/u/${handle}`);
  }
}
