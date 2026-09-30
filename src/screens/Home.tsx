import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { categories, defaultUnit } from "../data/defaults";
import type { ExerciseView } from "../domain/model";
import { errorMessage } from "../domain/rules";
import { repository } from "../storage/repository";
import { Arrow, ErrorPanel, SetSummary } from "../components/Shared";
import { homePosition } from "../app/context";
import { InstallHelp } from "../pwa/InstallHelp";
export function Home() {
  const [views, setViews] = useState<ExerciseView[]>([]),
    [error, setError] = useState(""),
    [help, setHelp] = useState(false),
    [loading, setLoading] = useState(true);
  const navigate = useNavigate(),
    location = useLocation();
  const load = useCallback(async () => {
    try {
      setViews(await repository.list());
      setHelp(!(await repository.getMeta("formatHelpDismissed")));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    const visibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load]);
  useEffect(() => {
    if (loading) return;
    const id = location.state?.focusId as string | undefined;
    requestAnimationFrame(() => {
      window.scrollTo(0, homePosition.scroll);
      const target = id ? document.getElementById(`exercise-${id}`) : null;
      if (target) {
        target.focus({ preventScroll: true });
        if (location.state?.newExercise)
          target.scrollIntoView({ block: "center" });
      }
    });
  }, [loading, location.key, location.state]);
  function go(path: string) {
    homePosition.scroll = window.scrollY;
    navigate(path);
  }
  return (
    <>
      <header className="brand-header">
        <h1 className="brand">
          <span>Gym</span>희제
        </h1>
        <button className="add-exercise" onClick={() => go("/add")}>
          + 운동 추가
        </button>
      </header>
      {help && (
        <div className="first-help">
          <div className="format-help">
            중량×반복 <span>· 한 묶음이 1세트</span>
            <button
              aria-label="사용 안내 닫기"
              className="close-help"
              onClick={async () => {
                try {
                  await repository.setMeta("formatHelpDismissed", true);
                  setHelp(false);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              ×
            </button>
          </div>
          <p className="local-note">
            기록은 이 기기에 저장됩니다. 사이트 데이터 삭제나 기기 변경 시
            자동으로 복구되지 않습니다.
          </p>
        </div>
      )}
      {error ? (
        <ErrorPanel message={error} retry={load} />
      ) : loading ? (
        <p className="loading" role="status">
          운동을 불러오는 중…
        </p>
      ) : (
        categories.map((category) => (
          <section className="category-section" key={category.id}>
            <h2>{category.name}</h2>
            {!views.some((v) => v.exercise.categoryId === category.id) && (
              <p className="empty-category">등록된 운동이 없어요</p>
            )}
            <div className="exercise-list">
              {views
                .filter((v) => v.exercise.categoryId === category.id)
                .map(({ exercise, current, error: recordError }) => (
                  <button
                    className="exercise-card"
                    key={exercise.id}
                    id={`exercise-${exercise.id}`}
                    onClick={() => go(`/exercise/${exercise.id}`)}
                  >
                    <div>
                      <h3>{exercise.name}</h3>
                      {recordError ? (
                        <p className="field-error">{recordError}</p>
                      ) : current ? (
                        <SetSummary sets={current.sets} />
                      ) : (
                        <p className="empty-record">
                          설정 없음 <span>· 눌러서 입력</span>
                        </p>
                      )}
                      <span className="unit-label">
                        {current?.unit ?? defaultUnit(exercise.id)}
                      </span>
                    </div>
                    <Arrow />
                  </button>
                ))}
            </div>
          </section>
        ))
      )}
      <footer className="page-footer">
        <InstallHelp />
      </footer>
    </>
  );
}
