import { describe, it, expect } from "vitest";
import {
  appendSet,
  assertConfiguration,
  draftEqual,
  parseDraft,
  parseReps,
  parseWeight,
  sameConfiguration,
  toDraft,
  weightStep,
} from "../src/domain/rules";
import type { Configuration } from "../src/domain/model";
const config: Configuration = {
  unit: "kg",
  sets: [
    { id: "a", weight: 40, reps: 12 },
    { id: "b", weight: 40, reps: 12 },
    { id: "c", weight: 50, reps: 10 },
    { id: "d", weight: 50, reps: 8 },
  ],
};
describe("세트 규칙", () => {
  it("동일 수치도 독립된 4세트이며 개수 필드를 저장하지 않는다", () => {
    expect(parseDraft(toDraft(config))).toEqual(config);
    expect(config.sets).toHaveLength(4);
    expect(config).not.toHaveProperty("setCount");
  });
  it("직전 값을 독립 ID로 복사한다", () => {
    const original = toDraft(config);
    const sets = appendSet(original.sets);
    expect(sets).toHaveLength(5);
    expect(sets[4]).toMatchObject({ weight: "50", reps: "8" });
    expect(sets[4].id).not.toBe(sets[3].id);
    sets[4].weight = "55";
    expect(sets[3].weight).toBe("50");
  });
  it("빈 배열의 최초 값은 빈 중량과 12회이다", () =>
    expect(appendSet([])[0]).toMatchObject({ weight: "", reps: "12" }));
  it("미완성 직전 세트는 복사하지 않는다", () =>
    expect(() => appendSet([{ id: "a", weight: "", reps: "12" }])).toThrow());
  it("빈 배열은 저장하지 않는다", () =>
    expect(() => parseDraft({ unit: "kg", sets: [] })).toThrow());
  it("서식과 ID 차이는 변경으로 간주하지 않는다", () => {
    const draft = toDraft(config);
    draft.sets[0] = { id: "new", weight: "40.00", reps: "012" };
    expect(draftEqual(draft, toDraft(config))).toBe(true);
    expect(sameConfiguration(parseDraft(draft), config)).toBe(true);
  });
  it("단위, 개수, 순서, 중량, 반복 차이를 감지한다", () => {
    const variations = [
      { ...config, unit: "lb" as const },
      { ...config, sets: config.sets.slice(1) },
      { ...config, sets: [...config.sets].reverse() },
      {
        ...config,
        sets: config.sets.map((s, i) => (i ? s : { ...s, weight: 45 })),
      },
      {
        ...config,
        sets: config.sets.map((s, i) => (i ? s : { ...s, reps: 13 })),
      },
    ];
    variations.forEach((v) => expect(sameConfiguration(config, v)).toBe(false));
  });
  it("추가 후 삭제하면 원래와 같다", () => {
    const draft = toDraft(config);
    draft.sets = appendSet(draft.sets).slice(0, -1);
    expect(draftEqual(draft, toDraft(config))).toBe(true);
  });
  it("소수점 증감과 하한 처리가 정확하다", () => {
    expect(weightStep("2.5", 1)).toBe("7.5");
    expect(weightStep("2.5", -1)).toBe("0");
    expect(weightStep("0", -1)).toBe("0");
    expect(weightStep("9999.99", 1)).toBe("9999.99");
  });
  it.each(["", "-1", "1e2", "NaN", "Infinity", "1,000", "2.555", "10000"])(
    "잘못된 중량 %s를 거부한다",
    (v) => expect(parseWeight(v)).toBeNull(),
  );
  it.each(["0", "2.5", "7.25", "9999.99"])("중량 %s를 허용한다", (v) =>
    expect(parseWeight(v)).toBe(Number(v)),
  );
  it.each(["", "0", "-1", "12.5", "1000", "1e2"])(
    "잘못된 반복 %s를 거부한다",
    (v) => expect(parseReps(v)).toBeNull(),
  );
  it.each(["1", "12", "999"])("반복 %s를 허용한다", (v) =>
    expect(parseReps(v)).toBe(Number(v)),
  );
  it("중복 ID를 가진 세트를 거부한다", () =>
    expect(() =>
      assertConfiguration({
        ...config,
        sets: [config.sets[0], config.sets[0]],
      }),
    ).toThrow());
});
