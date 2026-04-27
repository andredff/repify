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
  {
    path: 'my-workout',
    loadComponent: () =>
      import('./pages/my-workout/my-workout.component').then(m => m.MyWorkoutComponent),
    canActivate: [authGuard],
  },
  {
    path: 'workout/:id',
    loadComponent: () =>
      import('./pages/workout/workout.component').then(m => m.WorkoutComponent),
    canActivate: [authGuard],
  },
  {
    path: 'ranking',
    loadComponent: () =>
      import('./pages/ranking/ranking.component').then(m => m.RankingComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
