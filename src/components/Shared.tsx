import { useEffect, useId, useRef, type ReactNode } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import type { SetEntry } from "../domain/model";

export function Arrow({
  direction = "right",
}: {
  direction?: "left" | "right";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d={direction === "right" ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} />
    </svg>
  );
}
export function ScreenHeader({
  title,
  back = "/",
  children,
}: {
  title: string;
  back?: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="screen-header">
      <button
        className="icon-button"
        aria-label="뒤로"
        onClick={() => navigate(back)}
      >
        <Arrow direction="left" />
      </button>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export function SetSummary({ sets }: { sets: SetEntry[] }) {
  return (
    <div className="set-summary">
      {sets.map((set, i) => (
        <span className="summary-item" key={set.id}>
          {i > 0 && (
            <span className="set-dot" aria-hidden="true">
              ·
            </span>
          )}
          <span
            className="set-value"
            aria-label={`${i + 1}세트 ${set.weight}, ${set.reps}회`}
          >
            {set.weight}
            <span className="times">×</span>
            {set.reps}
          </span>
        </span>
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
export function useExitGuard(dirty: boolean, busy: boolean) {
  const bypass = useRef(false);
  const blocker = useBlocker(() => !bypass.current && (dirty || busy));
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if ((dirty || busy) && !bypass.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, busy]);
  return { blocker, bypass };
}
export function LeaveDialog({
  blocker,
  bypass,
  save,
  valid,
  busy,
}: {
  blocker: ReturnType<typeof useBlocker>;
  bypass: React.RefObject<boolean>;
  save: () => Promise<boolean>;
  valid: boolean;
  busy: boolean;
}) {
  if (blocker.state !== "blocked") return null;
  return (
    <Modal
      title="변경사항을 저장할까요?"
      onCancel={() => {
        if (!busy) blocker.reset();
      }}
    >
      <p>저장하지 않은 수정이 있어요.</p>
      <div className="modal-actions">
        <button
          className="primary"
          disabled={!valid || busy}
          onClick={async () => {
            if (await save()) {
              bypass.current = true;
              blocker.proceed();
            } else blocker.reset();
          }}
        >
          저장 후 나가기
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            bypass.current = true;
            blocker.proceed();
          }}
        >
          버리고 나가기
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => blocker.reset()}
        >
          계속 편집
        </button>
      </div>
    </Modal>
  );
}
export function ErrorPanel({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
    ref.current?.focus({ preventScroll: true });
  }, [message]);
  return (
    <div ref={ref} tabIndex={-1} className="error-panel" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="secondary" onClick={retry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
