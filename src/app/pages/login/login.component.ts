import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');

  async login(): Promise<void> {
    if (!this.email() || !this.password()) {
      this.error.set('Preencha email e senha.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.signIn(this.email(), this.password());
      this.router.navigateByUrl('/feed');
    } catch (err: any) {
      this.error.set(err?.message ?? 'Erro ao entrar. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
