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
  workout: {
    name: string;
    muscleGroup: string;
    duration: number;
    exercises: WorkoutExercise[];
    totalVolume: number;
    caloriesBurned: number;
  };
  photo?: string;
  likes: number;
  comments: number;
  liked: boolean;
  streak?: number;
}
