export type Unit = "kg" | "lb";
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}
export interface Exercise {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
  source: "builtin" | "custom";
  editVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
}
export interface Snapshot {
  id: string;
  exerciseId: string;
  revision: number;
  savedAt: string;
  unit: Unit;
  sets: SetEntry[];
}
export interface Configuration {
  unit: Unit;
  sets: SetEntry[];
}
export interface DraftSet {
  id: string;
  weight: string;
  reps: string;
}
export interface Draft {
  unit: Unit;
  sets: DraftSet[];
}
export interface ExerciseView {
  exercise: Exercise;
  current?: Snapshot;
  error?: string;
}
export type ErrorCode =
  | "validation"
  | "conflict"
  | "missing"
  | "duplicate"
  | "storage"
  | "corrupt"
  | "protected";
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export const newId = () => crypto.randomUUID();
