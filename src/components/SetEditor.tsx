import { useEffect, useRef, useState } from "react";
import type { Draft, DraftSet } from "../domain/model";
import {
  appendSet,
  errorMessage,
  parseReps,
  parseWeight,
  weightStep,
} from "../domain/rules";

function Stepper({
  kind,
  value,
  onChange,
  index,
  unit,
  disabled,
}: {
  kind: "weight" | "reps";
  value: string;
  onChange: (s: string) => void;
  index: number;
  unit: string;
  disabled: boolean;
}) {
  const weight = kind === "weight",
    number = weight ? parseWeight(value) : parseReps(value),
    label = weight ? "중량" : "반복",
    [touched, setTouched] = useState(false);
  const err = number === null && (touched || value !== "");
  const min = weight ? 0 : 1,
    max = weight ? 9999.99 : 999,
    step = weight ? 5 : 1;
  const id = `${kind}-${index}`;
  function adjust(direction: -1 | 1) {
    if (number === null) return;
    onChange(
      weight ? weightStep(value, direction) : String(number + direction),
    );
  }
  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label={`${index + 1}세트 ${label} ${step} 감소`}
          disabled={disabled || number === null || number <= min}
          onClick={() => adjust(-1)}
        >
          {weight ? "−5" : "−"}
        </button>
        <div className={`number-input${weight ? " number-input--weight" : ""}`}>
          <input
            id={id}
            aria-label={`${index + 1}세트 ${label}`}
            aria-invalid={err}
            aria-describedby={err ? `${id}-error` : undefined}
            value={value}
            placeholder="입력"
            inputMode={weight ? "decimal" : "numeric"}
            autoComplete="off"
            disabled={disabled}
            onBlur={() => setTouched(true)}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <span>{weight ? unit : "회"}</span>
        </div>
        <button
          type="button"
          aria-label={`${index + 1}세트 ${label} ${step} 증가`}
          disabled={disabled || number === null || number + step > max}
          onClick={() => adjust(1)}
        >
          {weight ? "+5" : "+"}
        </button>
      </div>
      {err && (
        <p id={`${id}-error`} className="field-error">
          {weight
            ? "0~9999.99, 소수점 2자리까지 입력해 주세요."
            : "1~999 사이의 정수를 입력해 주세요."}
        </p>
      )}
    </div>
  );
}
export function SetEditor({
  draft,
  onChange,
  disabled = false,
  originalUnit,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  disabled?: boolean;
  originalUnit: string;
}) {
  const [undo, setUndo] = useState<{ set: DraftSet; index: number } | null>(
      null,
    ),
    [message, setMessage] = useState("");
  const list = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function focusSet(id: string, field = false) {
    requestAnimationFrame(() => {
      const row = list.current?.querySelector<HTMLElement>(
        `[data-set-id="${id}"]`,
      );
      row?.scrollIntoView({ block: "nearest" });
      (field ? row?.querySelector<HTMLElement>("input") : row)?.focus();
    });
  }
  function add() {
    try {
      const sets = appendSet(draft.sets);
      onChange({ ...draft, sets });
      setMessage("");
      focusSet(sets.at(-1)!.id, draft.sets.length === 0);
    } catch (e) {
      setMessage(errorMessage(e));
      const last = draft.sets.at(-1);
      if (last) focusSet(last.id, true);
    }
  }
  function remove(index: number) {
    clearTimeout(timer.current);
    const set = draft.sets[index];
    setUndo({ set, index });
    timer.current = setTimeout(() => setUndo(null), 5000);
    const sets = draft.sets.filter((_, i) => i !== index);
    onChange({ ...draft, sets });
    setMessage("");
    if (sets.length) focusSet(sets[Math.min(index, sets.length - 1)].id);
    else
      requestAnimationFrame(() => document.getElementById("add-set")?.focus());
  }
  function restore() {
    if (!undo) return;
    const sets = [...draft.sets];
    sets.splice(undo.index, 0, undo.set);
    onChange({ ...draft, sets });
    focusSet(undo.set.id);
    setUndo(null);
    clearTimeout(timer.current);
  }
  return (
    <>
      <div className="unit-row">
        <span>중량 단위</span>
        <div className="unit-toggle" role="group" aria-label="중량 단위">
          {(["kg", "lb"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              disabled={disabled}
              aria-pressed={draft.unit === unit}
              onClick={() => onChange({ ...draft, unit })}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>
      {draft.unit !== originalUnit && (
        <p className="unit-note" role="status">
          숫자는 그대로 유지됩니다. 기구에 표시된 중량을 확인해 주세요.
        </p>
      )}
      <div className="section-title">
        <h2>현재 설정 편집</h2>
        <span>총 {draft.sets.length}세트</span>
      </div>
      <div className="sets-editor" ref={list}>
        {draft.sets.map((set, index) => (
          <section
            className="set-card"
            key={set.id}
            data-set-id={set.id}
            tabIndex={-1}
            aria-label={`${index + 1}세트`}
          >
            <div className="set-card-header">
              <h3>
                <span className="set-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {index + 1}세트
              </h3>
              <button
                type="button"
                className="delete-set"
                aria-label={`${index + 1}세트 삭제`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                삭제
              </button>
            </div>
            {(["weight", "reps"] as const).map((kind) => (
              <Stepper
                key={kind}
                kind={kind}
                value={set[kind]}
                index={index}
                unit={draft.unit}
                disabled={disabled}
                onChange={(value) => {
                  setMessage("");
                  onChange({
                    ...draft,
                    sets: draft.sets.map((s) =>
                      s.id === set.id ? { ...s, [kind]: value } : s,
                    ),
                  });
                }}
              />
            ))}
          </section>
        ))}
      </div>
      {!draft.sets.length && (
        <p className="empty-sets">저장하려면 최소 1세트를 입력해 주세요.</p>
      )}
      <button
        id="add-set"
        type="button"
        className="add-set"
        disabled={disabled}
        onClick={add}
      >
        + {draft.sets.length ? "세트 추가" : "첫 세트 추가"}
      </button>
      {message && (
        <p role="alert" className="field-error">
          {message}
        </p>
      )}
      {undo && (
        <div className="undo-toast" role="status">
          <span>세트를 삭제했어요</span>
          <button type="button" disabled={disabled} onClick={restore}>
            실행 취소
          </button>
        </div>
      )}
    </>
  );
}
