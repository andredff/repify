import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { previewModeGuard } from './core/guards/preview-mode.guard';
import { AppShellComponent } from './shared/app-shell.component';

export const routes: Routes = [
  { path: '', redirectTo: '/feed', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'p/:id',
    loadComponent: () =>
      import('./pages/public-post/public-post.component').then(m => m.PublicPostComponent),
  },
  // ─── Authenticated routes wrapped in desktop shell ──────────────────────
  {
    path: '',
    component: AppShellComponent,
    canActivate: [previewModeGuard],
    children: [
      {
        path: 'feed',
        loadComponent: () =>
          import('./pages/feed/feed.component').then(m => m.FeedComponent),
      },
    ],
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'dashboard',
        redirectTo: '/progress',
        pathMatch: 'full',
      },
      {
        path: 'u/:handle',
        loadComponent: () =>
          import('./pages/public-profile/public-profile.component').then(m => m.PublicProfileComponent),
      },
      {
        path: 'my-workout',
        loadComponent: () =>
          import('./pages/my-workout/my-workout.component').then(m => m.MyWorkoutComponent),
      },
      {
        path: 'workout/:id',
        loadComponent: () =>
          import('./pages/workout/workout.component').then(m => m.WorkoutComponent),
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('./pages/ranking/ranking.component').then(m => m.RankingComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/feed' },
];
