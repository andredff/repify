export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

export interface WorkoutPost {
  id: string;
  user: {
    id?: string;
    name: string;
    username?: string;
    avatar: string;
    level: string;
  };
  timeAgo: string;
  caption?: string;
  workout?: {
    name: string;
    muscleGroup: string;
  };
  photo?: string;
  likes: number;
  comments: number;
  liked: boolean;
  streak?: number;
}
