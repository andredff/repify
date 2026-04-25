import { Injectable, signal, computed } from '@angular/core';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabaseClient';

export interface AuthState {
  session: Session | null;
  loading: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);
  private readonly _initialized = signal(false);

  readonly session = this._session.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly initialized = this._initialized.asReadonly();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    this._session.set(data.session);
    this._initialized.set(true);

    supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw this.mapError(error);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw this.mapError(error);
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw this.mapError(error);
  }

  private mapError(error: AuthError): Error {
    const messages: Record<string, string> = {
      'Invalid login credentials': 'Email ou senha incorretos.',
      'Email not confirmed': 'Confirme seu email antes de entrar.',
      'User already registered': 'Este email já está cadastrado.',
      'Password should be at least 6 characters': 'A senha deve ter ao menos 6 caracteres.',
    };
    return new Error(messages[error.message] ?? error.message);
  }
}
