export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

export interface WorkoutPostPhoto {
  full: string;
  medium?: string;
  thumb?: string;
}

export interface WorkoutPost {
  id: string;
  user: {
    id?: string;
    name: string;
    username?: string;
    avatar: string;
    level: string;
    workoutsDone?: number | null;
  };
  timeAgo: string;
  caption?: string;
  workout?: {
    name: string;
    muscleGroup: string;
  };
  photos?: WorkoutPostPhoto[];
  photo?: string;
  photoMedium?: string;
  photoThumb?: string;
  videoUrl?: string;
  likes: number;
  likedByPreviewName?: string;
  likedByPreviews?: Array<{ name: string; avatar: string }>;
  comments: number;
  liked: boolean;
  streak?: number;
}
