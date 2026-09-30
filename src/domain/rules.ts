import {
  AppError,
  newId,
  type Configuration,
  type Draft,
  type DraftSet,
  type Snapshot,
} from "./model";

export function parseWeight(value: string): number | null {
  const v = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 9999.99 ? n : null;
}
export function parseReps(value: string): number | null {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
}
export const blankSet = (): DraftSet => ({
  id: newId(),
  weight: "",
  reps: "12",
});
export const toDraft = (config: Configuration): Draft => ({
  unit: config.unit,
  sets: config.sets.map((s) => ({
    id: s.id,
    weight: String(s.weight),
    reps: String(s.reps),
  })),
});
export function parseDraft(draft: Draft): Configuration {
  if (!["kg", "lb"].includes(draft.unit) || draft.sets.length === 0)
    throw new AppError("validation", "저장하려면 최소 1세트를 입력해 주세요.");
  return {
    unit: draft.unit,
    sets: draft.sets.map((s, index) => {
      const weight = parseWeight(s.weight),
        reps = parseReps(s.reps);
      if (weight === null || reps === null)
        throw new AppError(
          "validation",
          `${index + 1}세트의 중량과 반복을 확인해 주세요.`,
        );
      return { id: s.id, weight, reps };
    }),
  };
}
export function sameConfiguration(a: Configuration, b: Configuration): boolean {
  return (
    a.unit === b.unit &&
    a.sets.length === b.sets.length &&
    a.sets.every(
      (s, i) => s.weight === b.sets[i].weight && s.reps === b.sets[i].reps,
    )
  );
}
export function draftEqual(a: Draft, b: Draft): boolean {
  const equalNumber = (
    x: string,
    y: string,
    parse: (v: string) => number | null,
  ) => {
    const n = parse(x),
      m = parse(y);
    return n !== null && m !== null ? n === m : x.trim() === y.trim();
  };
  return (
    a.unit === b.unit &&
    a.sets.length === b.sets.length &&
    a.sets.every(
      (s, i) =>
        equalNumber(s.weight, b.sets[i].weight, parseWeight) &&
        equalNumber(s.reps, b.sets[i].reps, parseReps),
    )
  );
}
export function appendSet(sets: DraftSet[]): DraftSet[] {
  if (!sets.length) return [blankSet()];
  const last = sets[sets.length - 1];
  if (parseWeight(last.weight) === null || parseReps(last.reps) === null)
    throw new AppError("validation", "마지막 세트를 먼저 입력해 주세요.");
  return [...sets, { ...last, id: newId() }];
}
export function weightStep(value: string, direction: -1 | 1) {
  const n = parseWeight(value);
  if (n === null) return value;
  const next = Math.max(0, Math.round(n * 100) + direction * 500) / 100;
  return next > 9999.99 ? value : String(next);
}
export const cleanName = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ");
export const nameKey = (name: string) => cleanName(name).toLowerCase();
export function validName(name: string) {
  const cleaned = cleanName(name);
  return [...cleaned].length >= 1 && [...cleaned].length <= 50;
}
export function assertConfiguration(config: Configuration) {
  if (
    !config ||
    !["kg", "lb"].includes(config.unit) ||
    !Array.isArray(config.sets) ||
    !config.sets.length
  )
    throw new AppError(
      "corrupt",
      "운동 설정을 읽을 수 없어요. 기존 데이터는 보존됩니다.",
    );
  const ids = new Set<string>();
  for (const s of config.sets) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id ||
      ids.has(s.id) ||
      typeof s.weight !== "number" ||
      typeof s.reps !== "number" ||
      parseWeight(String(s.weight)) === null ||
      parseReps(String(s.reps)) === null
    )
      throw new AppError(
        "corrupt",
        "세트 기록에 오류가 있어요. 기존 데이터는 보존됩니다.",
      );
    ids.add(s.id);
  }
}
export function assertSnapshot(s: Snapshot, exerciseId: string) {
  assertConfiguration(s);
  if (
    s.exerciseId !== exerciseId ||
    !s.id ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 1 ||
    typeof s.savedAt !== "string" ||
    !Number.isFinite(Date.parse(s.savedAt))
  )
    throw new AppError(
      "corrupt",
      "이전 설정을 읽을 수 없어요. 기존 데이터는 보존됩니다.",
    );
}
export function formatDate(value: string) {
  const d = new Date(value),
    now = new Date();
  return `${d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}/` : ""}${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function errorMessage(error: unknown) {
  return error instanceof AppError
    ? error.message
    : "저장소를 사용할 수 없어요. 기존 기록은 삭제하지 않았습니다. 잠시 후 다시 시도해 주세요.";
}
