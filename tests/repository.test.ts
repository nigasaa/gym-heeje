import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDB, openDB } from "idb";
import { createRepository, type Repository } from "../src/storage/repository";
import type { Configuration } from "../src/domain/model";
const id = "builtin-lat-pulldown";
const config = (weight = 40): Configuration => ({
  unit: "kg",
  sets: [
    { id: "a", weight, reps: 12 },
    { id: "b", weight, reps: 12 },
    { id: "c", weight: 50, reps: 10 },
    { id: "d", weight: 50, reps: 8 },
  ],
});
let repo: Repository, name: string, fault: string | undefined;
beforeEach(async () => {
  name = `gym-test-${crypto.randomUUID()}`;
  fault = undefined;
  repo = createRepository(name, {
    beforeCommit: (op) => {
      if (op === fault) throw new Error("Injected transaction failure");
    },
  });
  await repo.initialize();
});
afterEach(async () => {
  vi.useRealTimers();
  await repo.close();
  await deleteDB(name);
});
async function count() {
  const db = await openDB(name);
  const n = await db.count("snapshots");
  db.close();
  return n;
}
describe("실제 IndexedDB 계약 (분리된 테스트 DB)", () => {
  it("T01 초기화 반복에도 기본 운동 14종과 기록 0개", async () => {
    await repo.initialize();
    expect(await repo.list()).toHaveLength(14);
    expect(await count()).toBe(0);
    const db = await openDB(name);
    expect(await db.count("categories")).toBe(5);
    db.close();
  });
  it("T02 T25 저장 후 연결을 닫아도 전체 세트를 유지한다", async () => {
    await repo.save(id, 1, config());
    await repo.close();
    const d = await repo.detail(id);
    expect(d.current?.sets).toEqual(config().sets);
    expect(d.history).toEqual([]);
    expect(d.exercise.editVersion).toBe(2);
  });
  it("T03 T13 여러 변화의 최종 결과를 한 번만 저장한다", async () => {
    await repo.save(id, 1, config());
    const c = config(60);
    c.sets[3].reps = 7;
    c.unit = "lb";
    c.sets.push({ id: "e", weight: 65, reps: 8 });
    await repo.save(id, 2, c);
    const d = await repo.detail(id);
    expect(d.current?.sets).toEqual(c.sets);
    expect(d.history[0].unit).toBe("kg");
    expect(d.history[0].sets).toEqual(config().sets);
    expect(await count()).toBe(2);
  });
  it("T09 T10 최종 값이 같으면 추가하지 않는다", async () => {
    await repo.save(id, 1, config());
    expect((await repo.save(id, 2, config())).changed).toBe(false);
    expect(await count()).toBe(1);
    expect((await repo.detail(id)).exercise.editVersion).toBe(2);
  });
  it("T11 단위만 바꾸면 새 저장본이며 과거 단위는 보존", async () => {
    await repo.save(id, 1, config());
    await repo.save(id, 2, { ...config(), unit: "lb" });
    const d = await repo.detail(id);
    expect(d.current?.unit).toBe("lb");
    expect(d.history[0].unit).toBe("kg");
    expect(d.current?.sets).toEqual(d.history[0].sets);
  });
  it("T14 T15 7번 저장 시 과거 5개만 조회하되 전부 보관", async () => {
    for (let n = 1; n <= 7; n++) await repo.save(id, n, config(40 + n));
    const d = await repo.detail(id);
    expect(d.current?.revision).toBe(7);
    expect(d.history.map((s) => s.revision)).toEqual([6, 5, 4, 3, 2]);
    expect(await count()).toBe(7);
  });
  it("T16 A→B→A는 3개 저장본", async () => {
    await repo.save(id, 1, config());
    await repo.save(id, 2, config(45));
    await repo.save(id, 3, config());
    expect(await count()).toBe(3);
  });
  it("T18 T29 동시 요청은 하나만 확정되고 오래된 버전은 거부한다", async () => {
    const results = await Promise.allSettled([
      repo.save(id, 1, config()),
      repo.save(id, 1, config(45)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await count()).toBe(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "conflict" },
    });
  });
  it("T19 실패 시 저장본과 editVersion 모두 롤백한다", async () => {
    await repo.save(id, 1, config());
    fault = "save";
    await expect(repo.save(id, 2, config(45))).rejects.toThrow();
    expect(await count()).toBe(1);
    expect((await repo.detail(id)).exercise.editVersion).toBe(2);
    expect((await repo.detail(id)).current?.sets[0].weight).toBe(40);
  });
  it("생성 실패도 반쪽 운동을 남기지 않는다", async () => {
    fault = "create";
    await expect(repo.create("핵스쿼트", "legs", config())).rejects.toThrow();
    expect(await repo.list()).toHaveLength(14);
    expect(await count()).toBe(0);
  });
  it("T20 정보 변경은 기록 추가 없이 새 분류 끝으로 이동", async () => {
    const e = await repo.create("핵스쿼트", "legs", config());
    expect(e.sortOrder).toBe(60);
    const updated = await repo.updateInfo(e.id, 1, "핵 스쿼트", "shoulders");
    expect(updated.sortOrder).toBe(30);
    expect((await repo.detail(e.id)).current?.exerciseId).toBe(e.id);
    expect(await count()).toBe(1);
  });
  it("T21 정규화 이름 중복 검사 및 동시 추가를 보호한다", async () => {
    await repo.create("Hack  Squat", "legs", config());
    await expect(
      repo.create(" hack squat ", "legs", config()),
    ).rejects.toMatchObject({ code: "duplicate" });
    await repo.create("Hack Squat", "shoulders", config());
    const result = await Promise.allSettled([
      repo.create("컬", "arms", config()),
      repo.create("컬", "arms", config()),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("T22 T30 운동 삭제는 해당 기록만 제거하고 부활시키지 않는다", async () => {
    await repo.save(id, 1, config());
    const e = await repo.create("핵스쿼트", "legs", config());
    await repo.save(e.id, 1, config(45));
    await repo.remove(e.id, 2);
    expect(await count()).toBe(1);
    await expect(repo.save(e.id, 2, config())).rejects.toMatchObject({
      code: "missing",
    });
    expect((await repo.detail(id)).current).toBeDefined();
  });
  it("삭제 실패 시 운동과 모든 기록을 보존한다", async () => {
    const e = await repo.create("핵스쿼트", "legs", config());
    fault = "delete";
    await expect(repo.remove(e.id, 1)).rejects.toThrow();
    expect((await repo.detail(e.id)).current).toBeDefined();
  });
  it("기본 운동의 이름 변경은 보호한다", async () => {
    await expect(repo.updateInfo(id, 1, "변경", "legs")).rejects.toMatchObject({
      code: "protected",
    });
  });
  it("기본 운동 삭제 후 재시작해도 다시 생기지 않고 다른 기록은 동일하다", async () => {
    await repo.save(id, 1, config());
    await repo.save(id, 2, config(45));
    const other = await repo.create("핵스쿼트", "legs", config(70));
    const before = await repo.detail(other.id);
    await repo.remove(id, 3);
    await repo.close();
    await repo.initialize();
    expect(await repo.list()).toHaveLength(14);
    await expect(repo.detail(id)).rejects.toMatchObject({ code: "missing" });
    expect(await repo.detail(other.id)).toEqual(before);
    expect(await count()).toBe(1);
    expect(await repo.getMeta(`deletedBuiltin:${id}`)).toBe(true);
  });
  it("기본 운동 삭제 실패는 삭제 표시까지 전부 되돌린다", async () => {
    await repo.save(id, 1, config());
    const before = await repo.detail(id);
    fault = "delete";
    await expect(repo.remove(id, 2)).rejects.toThrow();
    expect(await repo.detail(id)).toEqual(before);
    expect(await repo.getMeta(`deletedBuiltin:${id}`)).toBeUndefined();
    await repo.initialize();
  });
  it("모든 기본 운동을 삭제해도 초기 목록을 다시 넣지 않는다", async () => {
    for (const { exercise } of await repo.list())
      await repo.remove(exercise.id, exercise.editVersion);
    await repo.close();
    await repo.initialize();
    expect(await repo.list()).toEqual([]);
    await repo.create("새 운동", "back", config());
    expect(await repo.list()).toHaveLength(1);
  });
  it("오래된 창의 삭제 요청은 새 기록을 지우지 않는다", async () => {
    await repo.save(id, 1, config());
    await expect(repo.remove(id, 1)).rejects.toMatchObject({
      code: "conflict",
    });
    expect((await repo.detail(id)).current?.sets).toEqual(config().sets);
    expect(await repo.getMeta(`deletedBuiltin:${id}`)).toBeUndefined();
  });
  it("업데이트의 초기화 실패 시에도 사용자 운동과 모든 저장값이 남는다", async () => {
    await repo.save(id, 1, config());
    const custom = await repo.create("핵스쿼트", "legs", config(70));
    await repo.save(custom.id, 1, { ...config(75), unit: "lb" });
    const before = await repo.list();
    const history = await repo.detail(custom.id);
    await repo.close();
    fault = "initialize";
    await expect(repo.initialize()).rejects.toThrow();
    fault = undefined;
    await repo.initialize();
    expect(await repo.list()).toEqual(before);
    expect(await repo.detail(custom.id)).toEqual(history);
  });
  it("구버전 코드가 더 높은 DB 버전을 만나도 기록을 삭제하지 않는다", async () => {
    await repo.save(id, 1, config());
    await repo.close();
    const future = await openDB(name, 2);
    const before = await future.getAll("snapshots");
    future.close();
    await expect(repo.initialize()).rejects.toMatchObject({ code: "storage" });
    const read = await openDB(name);
    expect(read.version).toBe(2);
    expect(await read.getAll("snapshots")).toEqual(before);
    read.close();
  });
  it("T31 날짜 역전에도 revision으로 최신을 판단한다", async () => {
    await repo.save(id, 1, config());
    const db = await openDB(name);
    const old = (await db.getAll("snapshots"))[0];
    old.savedAt = "2099-01-01T00:00:00.000Z";
    await db.put("snapshots", old);
    db.close();
    await repo.save(id, 2, config(45));
    expect((await repo.detail(id)).current?.revision).toBe(2);
  });
  it("T32 손상된 저장본을 편집하지 않고 다른 운동은 조회한다", async () => {
    await repo.save(id, 1, config());
    const db = await openDB(name);
    const bad = (await db.getAll("snapshots"))[0];
    bad.sets[0].weight = -4;
    await db.put("snapshots", bad);
    db.close();
    await expect(repo.detail(id)).rejects.toMatchObject({ code: "corrupt" });
    expect(
      (await repo.list()).find((v) => v.exercise.id === id)?.error,
    ).toBeTruthy();
    expect((await repo.list()).filter((v) => !v.error)).toHaveLength(13);
  });
  it("누락된 기본 데이터는 재초기화하지 않는다", async () => {
    const db = await openDB(name);
    await db.delete("exercises", id);
    db.close();
    await expect(repo.initialize()).rejects.toMatchObject({ code: "corrupt" });
    expect(await repo.list()).toHaveLength(13);
  });
  it("T34 기록 1000개에서 최신 6개만 조회한다", async () => {
    const db = await openDB(name);
    const tx = db.transaction("snapshots", "readwrite");
    for (let n = 1; n <= 1000; n++)
      tx.store.add({
        id: `snapshot-${n}`,
        exerciseId: id,
        revision: n,
        savedAt: "2026-09-28T01:00:00.000Z",
        ...config(n),
      });
    await tx.done;
    db.close();
    const d = await repo.detail(id);
    expect(d.current?.revision).toBe(1000);
    expect(d.history.map((s) => s.revision)).toEqual([999, 998, 997, 996, 995]);
    expect(await count()).toBe(1000);
  });
  it("T36 핵심 데이터에 세트 수와 현재 복사본을 추가하지 않는다", async () => {
    await repo.save(id, 1, config());
    const d = await repo.detail(id);
    expect(Object.keys(d.current!).sort()).toEqual([
      "exerciseId",
      "id",
      "revision",
      "savedAt",
      "sets",
      "unit",
    ]);
    expect(d.exercise).not.toHaveProperty("sets");
    expect(d.exercise).not.toHaveProperty("unit");
    expect(Object.keys(d.current!.sets[0]).sort()).toEqual([
      "id",
      "reps",
      "weight",
    ]);
  });
});
