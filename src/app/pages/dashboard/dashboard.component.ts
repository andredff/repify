import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center gap-6 p-4">

      <div class="text-center space-y-1">
        <h1 class="text-2xl font-bold text-primary">Dashboard</h1>
        <p class="text-sm text-gray-400">Logado como <span class="text-white">{{ auth.user()?.email }}</span></p>
      </div>

      <button
        (click)="logout()"
        class="bg-card border border-border px-6 py-2 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors"
      >
        Sair
      </button>

    </div>
  `,
})
export class DashboardComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/');
  }
}
