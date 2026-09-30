import { parseDraft } from "../domain/rules";
import type { Draft } from "../domain/model";
import { repository } from "../storage/repository";
export const saveSettings = (id: string, version: number, draft: Draft) =>
  repository.save(id, version, parseDraft(draft));
export const createExercise = (
  name: string,
  categoryId: string,
  draft: Draft,
) => repository.create(name, categoryId, parseDraft(draft));
export async function requestStoragePersistence() {
  try {
    if (
      !navigator.storage?.persist ||
      (await repository.getMeta("persistenceRequested"))
    )
      return;
    await repository.setMeta("persistenceRequested", true);
    if (!(await navigator.storage.persisted()))
      await navigator.storage.persist();
  } catch {
    /* Optional persistence never changes the result of a completed save. */
  }
}
