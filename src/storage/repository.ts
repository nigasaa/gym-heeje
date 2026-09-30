import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
} from "idb";
import { categories, defaults } from "../data/defaults";
import {
  AppError,
  newId,
  type Category,
  type Configuration,
  type Exercise,
  type ExerciseView,
  type Snapshot,
} from "../domain/model";
import {
  assertConfiguration,
  assertSnapshot,
  cleanName,
  nameKey,
  sameConfiguration,
  validName,
} from "../domain/rules";

interface GymDB extends DBSchema {
  categories: { key: string; value: Category };
  exercises: {
    key: string;
    value: Exercise;
    indexes: { "category-order": [string, number] };
  };
  snapshots: {
    key: string;
    value: Snapshot;
    indexes: { "exercise-revision": [string, number]; exercise: string };
  };
  meta: { key: string; value: number | boolean };
}
type WriteTx = IDBPTransaction<
  GymDB,
  ["categories", "exercises", "snapshots", "meta"],
  "readwrite"
>;
type AnyRead = IDBPTransaction<
  GymDB,
  Array<"categories" | "exercises" | "snapshots" | "meta">,
  "readonly" | "readwrite"
>;
const issue = (message: string) => {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("gym-storage-issue", { detail: message }),
    );
};
export function createRepository(
  dbName = "gym-heeje",
  hooks?: { beforeCommit?: (operation: string) => void },
) {
  let connection: Promise<IDBPDatabase<GymDB>> | undefined;
  let closedForUpgrade = false;
  function db() {
    if (closedForUpgrade)
      return Promise.reject(
        new AppError(
          "storage",
          "앱이 업데이트되었어요. 페이지를 새로고침해 주세요.",
        ),
      );
    if (!connection)
      connection = openDB<GymDB>(dbName, 1, {
        upgrade(database, oldVersion) {
          if (oldVersion === 0) {
            database.createObjectStore("categories", { keyPath: "id" });
            database
              .createObjectStore("exercises", { keyPath: "id" })
              .createIndex("category-order", ["categoryId", "sortOrder"]);
            const snapshots = database.createObjectStore("snapshots", {
              keyPath: "id",
            });
            snapshots.createIndex(
              "exercise-revision",
              ["exerciseId", "revision"],
              { unique: true },
            );
            snapshots.createIndex("exercise", "exerciseId");
            database.createObjectStore("meta");
          }
        },
        blocked() {
          issue(
            "다른 창이 업데이트를 기다리고 있어요. 다른 Gym희제 창을 닫고 다시 시도해 주세요.",
          );
        },
        blocking() {
          connection?.then((c) => c.close());
          closedForUpgrade = true;
          issue(
            "다른 창에서 앱을 업데이트했어요. 미저장 내용을 확인한 후 새로고침해 주세요.",
          );
        },
        terminated() {
          connection = undefined;
          issue("기록 저장소 연결이 끊어졌어요. 다시 시도해 주세요.");
        },
      }).catch((e) => {
        connection = undefined;
        if (e?.name === "VersionError")
          throw new AppError(
            "storage",
            "새 버전의 기록이 있어요. 앱을 새로고침해 주세요.",
          );
        throw e;
      });
    return connection;
  }
  async function write<T>(
    operation: string,
    action: (tx: WriteTx) => Promise<T>,
  ): Promise<T> {
    const tx = (await db()).transaction(
      ["categories", "exercises", "snapshots", "meta"],
      "readwrite",
    );
    const settled = tx.done.catch(() => undefined);
    try {
      const result = await action(tx);
      hooks?.beforeCommit?.(operation);
      await tx.done;
      return result;
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* already settled */
      }
      await settled;
      throw e;
    }
  }
  async function recent(tx: AnyRead, id: string, limit: number) {
    const result: Snapshot[] = [];
    let cursor = await tx
      .objectStore("snapshots")
      .index("exercise-revision")
      .openCursor(
        IDBKeyRange.bound([id, 1], [id, Number.MAX_SAFE_INTEGER]),
        "prev",
      );
    while (cursor && result.length < limit) {
      assertSnapshot(cursor.value, id);
      result.push(cursor.value);
      if (result.length < limit) cursor = await cursor.continue();
    }
    return result;
  }
  async function requireExercise(tx: AnyRead, id: string, version?: number) {
    const e = await tx.objectStore("exercises").get(id);
    if (!e)
      throw new AppError("missing", "삭제되었거나 찾을 수 없는 운동이에요.");
    if (
      !e.name ||
      !categories.some((c) => c.id === e.categoryId) ||
      !Number.isSafeInteger(e.editVersion) ||
      e.editVersion < 1 ||
      !["builtin", "custom"].includes(e.source)
    )
      throw new AppError(
        "corrupt",
        "운동 정보에 오류가 있어요. 기존 데이터는 보존됩니다.",
      );
    if (version !== undefined && version !== e.editVersion)
      throw new AppError(
        "conflict",
        "다른 창에서 설정이 바뀌었어요. 최신 설정을 불러온 후 다시 수정해 주세요.",
      );
    return e;
  }
  async function checkName(
    tx: WriteTx,
    name: string,
    categoryId: string,
    exceptId?: string,
  ) {
    if (!validName(name) || !categories.some((c) => c.id === categoryId))
      throw new AppError(
        "validation",
        "분류와 1~50자의 운동 이름을 확인해 주세요.",
      );
    const list = await tx.objectStore("exercises").getAll();
    if (
      list.some(
        (e) =>
          e.id !== exceptId &&
          e.categoryId === categoryId &&
          nameKey(e.name) === nameKey(name),
      )
    )
      throw new AppError(
        "duplicate",
        "이 분류에 같은 이름의 운동이 있어요. 다른 이름을 입력해 주세요.",
      );
    return (
      Math.max(
        0,
        ...list
          .filter((e) => e.categoryId === categoryId)
          .map((e) => e.sortOrder),
      ) + 10
    );
  }
  return {
    async initialize() {
      await write("initialize", async (tx) => {
        const seeded = await tx.objectStore("meta").get("seedVersion");
        if (seeded === 1) {
          for (const category of categories) {
            const c = await tx.objectStore("categories").get(category.id);
            if (!c || c.sortOrder !== category.sortOrder)
              throw new AppError(
                "corrupt",
                "기본 분류를 읽을 수 없어요. 기존 기록은 보존됩니다.",
              );
          }
          // A confirmed deletion is permanent across startup and app updates.
          // Its marker is committed atomically with the exercise deletion.
          for (const [, suffix] of defaults)
            if (
              !(await tx.objectStore("exercises").get(`builtin-${suffix}`)) &&
              (await tx
                .objectStore("meta")
                .get(`deletedBuiltin:builtin-${suffix}`)) !== true
            )
              throw new AppError(
                "corrupt",
                "기본 운동이 누락되었어요. 기존 기록은 보존됩니다.",
              );
          return;
        }
        if (
          seeded !== undefined ||
          (await tx.objectStore("exercises").count()) ||
          (await tx.objectStore("categories").count()) ||
          (await tx.objectStore("snapshots").count())
        )
          throw new AppError(
            "corrupt",
            "초기 데이터를 확인할 수 없어요. 자동으로 초기화하지 않습니다.",
          );
        const now = new Date().toISOString(),
          orders: Record<string, number> = {};
        for (const category of categories)
          await tx.objectStore("categories").add(category);
        for (const [categoryId, suffix, name] of defaults) {
          orders[categoryId] = (orders[categoryId] ?? 0) + 10;
          await tx.objectStore("exercises").add({
            id: `builtin-${suffix}`,
            name,
            categoryId,
            sortOrder: orders[categoryId],
            source: "builtin",
            editVersion: 1,
            createdAt: now,
            updatedAt: now,
          });
        }
        await tx.objectStore("meta").put(1, "seedVersion");
      });
    },
    async list(): Promise<ExerciseView[]> {
      const tx = (await db()).transaction(
        ["exercises", "snapshots"],
        "readonly",
      );
      const exercises = await tx.objectStore("exercises").getAll();
      const views = await Promise.all(
        exercises.map(async (exercise) => {
          try {
            await requireExercise(tx, exercise.id);
            const [current] = await recent(tx, exercise.id, 1);
            if (!current && exercise.source === "custom")
              throw new AppError("corrupt", "최초 설정이 없어요.");
            return { exercise, current };
          } catch (e) {
            if (e instanceof AppError && e.code === "corrupt")
              return { exercise, error: "기록을 읽을 수 없어요" };
            throw e;
          }
        }),
      );
      await tx.done;
      return views.sort(
        (a, b) =>
          a.exercise.sortOrder - b.exercise.sortOrder ||
          a.exercise.createdAt.localeCompare(b.exercise.createdAt) ||
          a.exercise.id.localeCompare(b.exercise.id),
      );
    },
    async detail(id: string) {
      const tx = (await db()).transaction(
        ["exercises", "snapshots"],
        "readonly",
      );
      const exercise = await requireExercise(tx, id),
        snapshots = await recent(tx, id, 6);
      await tx.done;
      if (!snapshots.length && exercise.source === "custom")
        throw new AppError(
          "corrupt",
          "최초 설정을 찾을 수 없어요. 기존 데이터는 보존됩니다.",
        );
      return {
        exercise,
        current: snapshots[0] as Snapshot | undefined,
        history: snapshots.slice(1),
      };
    },
    async version(id: string) {
      return (await (await db()).get("exercises", id))?.editVersion;
    },
    async save(id: string, version: number, config: Configuration) {
      assertConfiguration(config);
      return write("save", async (tx) => {
        const e = await requireExercise(tx, id, version),
          [current] = await recent(tx, id, 1);
        if (current && sameConfiguration(current, config))
          return { changed: false, exercise: e };
        const savedAt = new Date().toISOString();
        await tx.objectStore("snapshots").add({
          id: newId(),
          exerciseId: id,
          revision: (current?.revision ?? 0) + 1,
          savedAt,
          unit: config.unit,
          sets: config.sets.map((s) => ({ ...s })),
        });
        const next = {
          ...e,
          editVersion: e.editVersion + 1,
          updatedAt: savedAt,
        };
        await tx.objectStore("exercises").put(next);
        return { changed: true, exercise: next };
      });
    },
    async create(name: string, categoryId: string, config: Configuration) {
      assertConfiguration(config);
      return write("create", async (tx) => {
        const sortOrder = await checkName(tx, name, categoryId),
          now = new Date().toISOString();
        const e: Exercise = {
          id: newId(),
          name: cleanName(name),
          categoryId,
          sortOrder,
          source: "custom",
          editVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        await tx.objectStore("exercises").add(e);
        await tx.objectStore("snapshots").add({
          id: newId(),
          exerciseId: e.id,
          revision: 1,
          savedAt: now,
          unit: config.unit,
          sets: config.sets.map((s) => ({ ...s })),
        });
        return e;
      });
    },
    async updateInfo(
      id: string,
      version: number,
      name: string,
      categoryId: string,
    ) {
      return write("info", async (tx) => {
        const e = await requireExercise(tx, id, version);
        if (e.source !== "custom")
          throw new AppError(
            "protected",
            "기본 운동의 이름과 분류는 변경할 수 없어요.",
          );
        const newOrder = await checkName(tx, name, categoryId, id);
        if (e.name === cleanName(name) && e.categoryId === categoryId) return e;
        const next = {
          ...e,
          name: cleanName(name),
          categoryId,
          sortOrder: e.categoryId === categoryId ? e.sortOrder : newOrder,
          editVersion: e.editVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        await tx.objectStore("exercises").put(next);
        return next;
      });
    },
    async remove(id: string, version: number) {
      await write("delete", async (tx) => {
        const e = await requireExercise(tx, id, version);
        if (e.source === "builtin")
          await tx.objectStore("meta").put(true, `deletedBuiltin:${id}`);
        let cursor = await tx
          .objectStore("snapshots")
          .index("exercise")
          .openCursor(id);
        while (cursor) {
          await cursor.delete();
          cursor = await cursor.continue();
        }
        await tx.objectStore("exercises").delete(id);
      });
    },
    async getMeta(key: string) {
      return (await db()).get("meta", key);
    },
    async setMeta(key: string, value: boolean | number) {
      await (await db()).put("meta", value, key);
    },
    async close() {
      (await connection)?.close();
      connection = undefined;
    },
  };
}
export const repository = createRepository();
export type Repository = ReturnType<typeof createRepository>;
