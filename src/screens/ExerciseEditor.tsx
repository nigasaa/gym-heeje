import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { categories, defaultUnit } from "../data/defaults";
import {
  AppError,
  type Draft,
  type Exercise,
  type Snapshot,
} from "../domain/model";
import {
  blankSet,
  draftEqual,
  errorMessage,
  formatDate,
  parseDraft,
  validName,
} from "../domain/rules";
import { toDraft } from "../domain/rules";
import { repository } from "../storage/repository";
import {
  createExercise,
  requestStoragePersistence,
  saveSettings,
} from "../services/settings";
import {
  ErrorPanel,
  LeaveDialog,
  Modal,
  ScreenHeader,
  SetSummary,
  useExitGuard,
} from "../components/Shared";
import { SetEditor } from "../components/SetEditor";
import { useApp } from "../app/context";

export function ExerciseEditor({ create = false }: { create?: boolean }) {
  const { id = "" } = useParams(),
    navigate = useNavigate(),
    { say } = useApp();
  const initial = useRef<Draft>({
    unit: "kg",
    sets: create ? [blankSet()] : [],
  });
  const [draft, setDraft] = useState<Draft>(initial.current),
    [baseline, setBaseline] = useState<Draft>(initial.current),
    [exercise, setExercise] = useState<Exercise>(),
    [history, setHistory] = useState<Snapshot[]>([]);
  const [name, setName] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [loading, setLoading] = useState(!create),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [reload, setReload] = useState(false),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  const mutex = useRef(false),
    ready = useRef(false);
  const dirty =
    !draftEqual(draft, baseline) ||
    (create && (name !== "" || categoryId !== ""));
  let valid = false;
  try {
    parseDraft(draft);
    valid = !create || (validName(name) && !!categoryId);
  } catch {
    /* incomplete draft */
  }
  const { blocker, bypass } = useExitGuard(dirty, busy);
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await repository.detail(id),
        value = data.current
          ? toDraft(data.current)
          : { unit: defaultUnit(id), sets: [] };
      setExercise(data.exercise);
      setDraft(value);
      setBaseline(value);
      setHistory(data.history);
      setConflict(false);
      setError("");
      ready.current = true;
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!create) void load();
    else ready.current = true; /* screen remounts when its route changes */
  }, [id, create]);
  useEffect(() => {
    if (create || !exercise) return;
    const check = async () => {
      try {
        const version = await repository.version(id);
        if (version !== exercise.editVersion) setConflict(true);
      } catch {
        /* saving still checks atomically */
      }
    };
    window.addEventListener("focus", check);
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [create, exercise, id]);
  async function save(leaving = false) {
    if (mutex.current || !valid || conflict) return false;
    mutex.current = true;
    setBusy(true);
    setError("");
    try {
      let saved: Exercise;
      if (create) {
        saved = await createExercise(name, categoryId, draft);
      } else {
        saved = (await saveSettings(id, exercise!.editVersion, draft)).exercise;
      }
      setExercise(saved);
      setBaseline(draft);
      bypass.current = true;
      void requestStoragePersistence();
      say(create ? "운동을 추가했어요" : "저장했어요");
      if (!leaving)
        navigate("/", {
          replace: true,
          state: { focusId: saved.id, newExercise: create },
        });
      return true;
    } catch (e) {
      setError(errorMessage(e));
      if (
        e instanceof AppError &&
        (e.code === "conflict" || e.code === "missing")
      )
        setConflict(true);
      return false;
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!exercise || mutex.current) return;
    mutex.current = true;
    setBusy(true);
    try {
      await repository.remove(id, exercise.editVersion);
      bypass.current = true;
      say("운동을 삭제했어요");
      navigate("/", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
      if (
        e instanceof AppError &&
        (e.code === "conflict" || e.code === "missing")
      )
        setConflict(true);
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  }
  if (loading || loadError)
    return (
      <>
        <ScreenHeader title={create ? "운동 추가" : "운동 설정"} />
        {loadError ? (
          <ErrorPanel message={loadError} retry={load} />
        ) : (
          <p className="loading" role="status">
            설정을 불러오는 중…
          </p>
        )}
      </>
    );
  return (
    <div className="editor-screen">
      <ScreenHeader
        title={create ? "운동 추가" : (exercise?.name ?? "운동 설정")}
      />
      {!create && exercise && (
        <div className="exercise-actions" aria-label="운동 관리">
          {exercise.source === "custom" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => navigate(`/exercise/${id}/info`)}
            >
              운동 정보 수정
            </button>
          )}
          <button
            className="secondary delete-exercise"
            disabled={busy || conflict}
            onClick={() => setDeleting(true)}
          >
            운동 삭제
          </button>
        </div>
      )}
      {create && (
        <div className="info-fields">
          <label>
            대분류
            <select
              value={categoryId}
              disabled={busy}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">분류 선택</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            운동 이름
            <input
              value={name}
              disabled={busy}
              placeholder="예: 핵스쿼트"
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          {name && !validName(name) && (
            <p className="field-error">운동 이름은 1~50자로 입력해 주세요.</p>
          )}
        </div>
      )}
      {conflict && (
        <div className="conflict-banner" role="alert">
          <p>다른 창에서 운동이 변경되었어요. 현재 입력은 보존되어 있어요.</p>
          <button className="secondary" onClick={() => setReload(true)}>
            최신 설정 다시 불러오기
          </button>
        </div>
      )}
      <SetEditor
        key={exercise?.editVersion ?? "new"}
        draft={draft}
        onChange={setDraft}
        originalUnit={baseline.unit}
        disabled={busy || conflict}
      />
      {!create && (
        <section className="history-section">
          <div className="section-title">
            <h2>이전 설정</h2>
            <span>최대 5개</span>
          </div>
          {history.length ? (
            history.map((s) => (
              <article className="history-card" key={s.id}>
                <div className="history-meta">
                  <time dateTime={s.savedAt}>{formatDate(s.savedAt)}</time>
                  <span>{s.unit}</span>
                </div>
                <SetSummary sets={s.sets} />
              </article>
            ))
          ) : (
            <p className="empty-history">이전 설정이 아직 없어요</p>
          )}
        </section>
      )}
      {error && <ErrorPanel message={error} />}
      <div className="save-bar">
        <span>
          {busy
            ? "저장 중…"
            : !dirty
              ? "변경사항 없음"
              : !valid
                ? "입력을 확인해 주세요"
                : "변경사항 있음"}
        </span>
        <button
          className="primary"
          disabled={busy || !dirty || !valid || conflict}
          onClick={() => void save()}
        >
          {busy ? "저장 중…" : create ? "운동 추가" : "저장"}
        </button>
      </div>
      <LeaveDialog
        blocker={blocker}
        bypass={bypass}
        save={() => save(true)}
        valid={valid && !conflict}
        busy={busy}
      />
      {deleting && (
        <Modal
          title={`‘${exercise?.name}’를 삭제할까요?`}
          onCancel={() => {
            if (!busy) setDeleting(false);
          }}
        >
          <p>
            현재 설정과 이 운동의 모든 과거 기록이 함께 삭제되며 되돌릴 수
            없습니다. 다른 운동의 기록은 그대로 유지됩니다.
          </p>
          {dirty && <p>아직 저장하지 않은 변경사항도 함께 버려집니다.</p>}
          <div className="modal-actions">
            <button
              className="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              운동 삭제
            </button>
            <button
              className="secondary"
              autoFocus
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              취소
            </button>
          </div>
        </Modal>
      )}
      {reload && (
        <Modal
          title="최신 설정을 불러올까요?"
          onCancel={() => setReload(false)}
        >
          <p>지금 편집 중인 내용은 버려집니다.</p>
          <div className="modal-actions">
            <button
              className="primary"
              onClick={() => {
                setReload(false);
                void load();
              }}
            >
              불러오기
            </button>
            <button
              className="secondary"
              autoFocus
              onClick={() => setReload(false)}
            >
              계속 편집
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
