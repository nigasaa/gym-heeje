import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { categories } from "../data/defaults";
import { AppError, type Exercise } from "../domain/model";
import { cleanName, errorMessage, validName } from "../domain/rules";
import { repository } from "../storage/repository";
import {
  ErrorPanel,
  LeaveDialog,
  Modal,
  ScreenHeader,
  useExitGuard,
} from "../components/Shared";
import { useApp } from "../app/context";
export function ExerciseInfo() {
  const { id = "" } = useParams(),
    navigate = useNavigate(),
    { say } = useApp();
  const [exercise, setExercise] = useState<Exercise>(),
    [name, setName] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fatal, setFatal] = useState(false);
  const [conflict, setConflict] = useState(false),
    [reload, setReload] = useState(false);
  const mutex = useRef(false),
    dirty =
      !!exercise &&
      (cleanName(name) !== exercise.name || categoryId !== exercise.categoryId),
    valid = validName(name) && !!categoryId;
  const { blocker, bypass } = useExitGuard(dirty, busy);
  const back = `/exercise/${id}`;
  async function load() {
    try {
      const { exercise: e } = await repository.detail(id);
      if (e.source !== "custom")
        throw new AppError(
          "protected",
          "기본 운동의 이름과 분류는 변경할 수 없어요.",
        );
      setExercise(e);
      setName(e.name);
      setCategoryId(e.categoryId);
      setError("");
      setFatal(false);
      setConflict(false);
    } catch (e) {
      setError(errorMessage(e));
      setFatal(true);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function save(leaving = false) {
    if (!exercise || mutex.current || !valid || conflict) return false;
    mutex.current = true;
    setBusy(true);
    try {
      const e = await repository.updateInfo(
        id,
        exercise.editVersion,
        name,
        categoryId,
      );
      setExercise(e);
      bypass.current = true;
      say("운동 정보를 수정했어요");
      if (!leaving) navigate(back, { replace: true });
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
  return (
    <div className="editor-screen">
      <ScreenHeader title="운동 정보 수정" back={back} />
      {fatal ? (
        <ErrorPanel message={error} retry={load} />
      ) : exercise ? (
        <>
          <div className="info-fields">
            <label>
              대분류
              <select
                value={categoryId}
                disabled={busy}
                onChange={(e) => setCategoryId(e.target.value)}
              >
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
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {!validName(name) && (
              <p className="field-error">운동 이름은 1~50자로 입력해 주세요.</p>
            )}
          </div>
          <p className="muted-copy">
            분류를 바꾸면 해당 분류의 맨 아래로 이동해요. 이전 운동 설정은
            그대로 유지됩니다.
          </p>
          {error && <ErrorPanel message={error} />}{" "}
          {conflict && (
            <button className="secondary" onClick={() => setReload(true)}>
              최신 설정 다시 불러오기
            </button>
          )}
          <div className="save-bar">
            <span>
              {busy ? "저장 중…" : dirty ? "변경사항 있음" : "변경사항 없음"}
            </span>
            <button
              className="primary"
              disabled={!dirty || !valid || busy || conflict}
              onClick={() => void save()}
            >
              저장
            </button>
          </div>
        </>
      ) : (
        <p className="loading">불러오는 중…</p>
      )}
      <LeaveDialog
        blocker={blocker}
        bypass={bypass}
        save={() => save(true)}
        valid={valid && !conflict}
        busy={busy}
      />
      {reload && (
        <Modal
          title="최신 정보를 불러올까요?"
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
            <button className="secondary" onClick={() => setReload(false)}>
              계속 편집
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
