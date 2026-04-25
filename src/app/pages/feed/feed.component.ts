import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PostService } from '../../core/services/post.service';
import { FeedHeaderComponent } from './components/feed-header.component';
import { CheckInCardComponent } from './components/check-in-card.component';
import { WorkoutPostComponent } from './components/workout-post.component';
import { BottomNavComponent } from './components/bottom-nav.component';
import { StoriesBarComponent } from './components/stories-bar.component';
import { NewPostModalComponent } from './components/new-post-modal.component';
import { DailyWorkoutCardComponent } from './components/daily-workout-card.component';
import { WorkoutService } from '../../core/services/workout.service';
import { WorkoutPost } from '../../core/models/workout-post.model';

export type { WorkoutPost };

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    FeedHeaderComponent,
    CheckInCardComponent,
    WorkoutPostComponent,
    BottomNavComponent,
    StoriesBarComponent,
    NewPostModalComponent,
    DailyWorkoutCardComponent,
  ],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto relative overflow-x-hidden">

      <!-- Fixed header -->
      <app-feed-header [userEmail]="userEmail()" (onLogout)="logout()" />

      <!-- Scrollable content -->
      <main class="flex-1 overflow-y-auto pb-24 pt-[64px]">

        <!-- Stories -->
        <app-stories-bar />

        <!-- Check-in diário -->
        <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.05s">
          <app-check-in-card [checkedIn]="checkedIn()" (onCheckIn)="doCheckIn()" />
        </div>

        <!-- Treino do dia -->
        @if (todayWorkout()) {
          <div class="px-4 mt-4 animate-slide-up" style="animation-delay:0.1s">
            <app-daily-workout-card
              [workout]="todayWorkout()!"
              [finished]="workoutService.todayFinished()"
              (onStart)="startWorkout($event)" />
          </div>
        }

        <!-- Feed posts -->
        <div class="px-4 mt-5 space-y-4">
          @for (post of posts(); track post.id; let i = $index) {
            <div class="animate-slide-up" [style.animation-delay]="(0.1 + i * 0.07) + 's'">
              <app-workout-post [post]="post" (onLike)="toggleLike(post.id)" (onDelete)="deletePost(post)" />
            </div>
          }
        </div>

        <!-- Bottom padding -->
        <div class="h-8"></div>
      </main>

      <!-- Bottom Nav -->
      <app-bottom-nav [active]="'feed'" (onNewPost)="showNewPost.set(true)" />

      <!-- New Post Modal -->
      @if (showNewPost()) {
        <app-new-post-modal (onClose)="showNewPost.set(false)" (onPublish)="addPost($event)" />
      }

    </div>
  `,
})
export class FeedComponent {
  private auth           = inject(AuthService);
  private router         = inject(Router);
  private postService    = inject(PostService);
  workoutService = inject(WorkoutService);

  userEmail    = computed(() => this.auth.user()?.email ?? '');
  checkedIn    = signal(false);
  showNewPost  = signal(false);
  todayWorkout = computed(() => this.workoutService.todayWorkout());

  posts = signal<WorkoutPost[]>([
    {
      id: '1',
      user: { name: 'André F.', username: 'andre', avatar: '', level: 'Elite' },
      timeAgo: 'agora',
      streak: 7,
      workout: {
        name: 'Peito + Tríceps',
        muscleGroup: 'peito',
        duration: 68,
        exercises: [
          { name: 'Supino Reto', sets: 4, reps: 10, weight: 80 },
          { name: 'Crucifixo Inclinado', sets: 3, reps: 12, weight: 22 },
          { name: 'Tríceps Corda', sets: 4, reps: 15, weight: 35 },
          { name: 'Mergulho', sets: 3, reps: 12 },
        ],
        totalVolume: 4280,
        caloriesBurned: 412,
      },
      likes: 14,
      comments: 3,
      liked: false,
    },
    {
      id: '2',
      user: { name: 'Mariana S.', username: 'mariana', avatar: '', level: 'Pro' },
      timeAgo: '2h',
      streak: 21,
      workout: {
        name: 'Costas + Bíceps',
        muscleGroup: 'costas',
        duration: 55,
        exercises: [
          { name: 'Puxada Frente', sets: 4, reps: 10, weight: 65 },
          { name: 'Remada Curvada', sets: 3, reps: 10, weight: 60 },
          { name: 'Rosca Direta', sets: 3, reps: 12, weight: 20 },
          { name: 'Rosca Martelo', sets: 3, reps: 12, weight: 18 },
        ],
        totalVolume: 3640,
        caloriesBurned: 338,
      },
      likes: 31,
      comments: 7,
      liked: true,
    },
    {
      id: '3',
      user: { name: 'Gabriel R.', username: 'gabriel', avatar: '', level: 'Iniciante' },
      timeAgo: '5h',
      workout: {
        name: 'Pernas',
        muscleGroup: 'pernas',
        duration: 72,
        exercises: [
          { name: 'Agachamento', sets: 5, reps: 8, weight: 100 },
          { name: 'Leg Press', sets: 4, reps: 12, weight: 180 },
          { name: 'Cadeira Extensora', sets: 3, reps: 15, weight: 60 },
          { name: 'Panturrilha em Pé', sets: 4, reps: 20, weight: 80 },
        ],
        totalVolume: 6120,
        caloriesBurned: 520,
      },
      likes: 8,
      comments: 1,
      liked: false,
    },
  ]);

  async deletePost(post: WorkoutPost): Promise<void> {
    this.posts.update(all => all.filter(p => p.id !== post.id));
    if (post.photo) await this.postService.deletePhoto(post.photo);
  }

  startWorkout(id: string): void {
    this.router.navigateByUrl(`/workout/${id}`);
  }

  addPost(post: WorkoutPost): void {
    this.posts.update(current => [post, ...current]);
    this.showNewPost.set(false);
  }

  doCheckIn(): void {
    this.checkedIn.set(true);
  }

  toggleLike(postId: string): void {
    this.posts.update(posts =>
      posts.map(p =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/');
  }
}
