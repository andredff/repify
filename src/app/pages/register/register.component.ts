import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  loading = signal(false);
  loadingGoogle = signal(false);
  serverError = signal('');

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch },
    ),
    acceptedTerms: [false, Validators.requiredTrue],
  });

  get email() { return this.form.get('email')!; }
  get passwords() { return this.form.get('passwords')!; }
  get password() { return this.passwords.get('password')!; }
  get confirmPassword() { return this.passwords.get('confirmPassword')!; }
  get acceptedTerms() { return this.form.get('acceptedTerms')!; }

  async registerWithGoogle(): Promise<void> {
    this.loadingGoogle.set(true);
    this.serverError.set('');
    try {
      await this.auth.signInWithGoogle();
      // redirects the browser — execution stops here
    } catch (err: any) {
      this.serverError.set(err?.message ?? 'Erro ao entrar com Google.');
      this.loadingGoogle.set(false);
    }
  }

  async register(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set('');

    try {
      await this.auth.signUp(this.email.value, this.password.value);
      this.router.navigateByUrl('/feed');
    } catch (err: any) {
      this.serverError.set(err?.message ?? 'Erro ao criar conta. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
