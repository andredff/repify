import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'feed',
    loadComponent: () =>
      import('./pages/feed/feed.component').then(m => m.FeedComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'u/:handle',
    loadComponent: () =>
      import('./pages/public-profile/public-profile.component').then(m => m.PublicProfileComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
