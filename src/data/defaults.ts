import type { Category } from "../domain/model";
export const categories: Category[] = [
  { id: "back", name: "등", sortOrder: 10 },
  { id: "shoulders", name: "어깨", sortOrder: 20 },
  { id: "chest", name: "가슴", sortOrder: 30 },
  { id: "legs", name: "하체", sortOrder: 40 },
  { id: "arms", name: "팔", sortOrder: 50 },
];
export const defaults = [
  ["back", "lat-pulldown", "랫풀다운"],
  ["back", "machine-lat-pulldown", "머신 랫풀다운"],
  ["back", "cable-seated-row", "케이블 시티드로우"],
  ["shoulders", "machine-shoulder-press", "머신 숄더프레스"],
  ["shoulders", "side-lateral-raise", "사이드레터럴레이즈"],
  ["chest", "machine-chest-press", "머신 체스트프레스"],
  ["chest", "smith-bench-press", "스미스 벤치프레스"],
  ["legs", "machine-seated-leg-press", "머신 시티드 레그프레스"],
  ["legs", "hip-abduction", "힙어브덕션"],
  ["legs", "hip-adduction", "힙어덕션"],
  ["legs", "seated-leg-curl", "시티드 레그컬"],
  ["legs", "leg-extension", "레그 익스텐션"],
  ["arms", "machine-triceps-extension", "머신 트라이셉 익스텐션"],
  ["arms", "machine-preacher-curl", "머신 프리쳐 컬"],
];
export const defaultUnit = (id: string): "kg" | "lb" =>
  id === "builtin-machine-shoulder-press" ? "lb" : "kg";
