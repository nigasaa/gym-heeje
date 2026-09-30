import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { Modal } from "../components/Shared";
import { applyUpdate, getPwaState, subscribePwa } from "./lifecycle";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let deferred: InstallEvent | null = null;
if (typeof window !== "undefined")
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    window.dispatchEvent(new Event("gym-install-ready"));
  });
export function InstallHelp() {
  const [open, setOpen] = useState(false),
    [available, setAvailable] = useState(!!deferred);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  const pwa = useSyncExternalStore(subscribePwa, getPwaState);
  useEffect(() => {
    const update = () => setAvailable(!!deferred);
    window.addEventListener("gym-install-ready", update);
    return () => window.removeEventListener("gym-install-ready", update);
  }, []);
  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      setAvailable(false);
    } else setOpen(true);
  }
  return (
    <>
      <button
        className="text-button"
        onClick={() => {
          if (installed) setOpen(true);
          else void install();
        }}
      >
        {installed
          ? "앱 사용 안내"
          : available
            ? "홈 화면에 설치"
            : "설치 · 사용 안내"}
      </button>
      {pwa.ready && <p className="offline-ready">오프라인 사용 준비 완료</p>}
      {open && (
        <Modal title="Gym희제 사용 안내" onCancel={() => setOpen(false)}>
          <p>홈 화면에 추가하면 앱처럼 바로 열 수 있어요.</p>
          <ol>
            <li>
              iPhone Safari: 공유 메뉴에서 <strong>홈 화면에 추가</strong>를
              선택하세요.
            </li>
            <li>
              Android Chrome: 메뉴에서 <strong>앱 설치</strong> 또는{" "}
              <strong>홈 화면에 추가</strong>를 선택하세요.
            </li>
          </ol>
          <p>
            한 번 접속해 오프라인 준비가 끝나면 인터넷 없이도 기록할 수 있어요.
          </p>
          <p className="muted-copy">
            기록은 이 기기에 저장됩니다. 사이트 데이터 삭제나 기기 변경 시
            자동으로 복구되지 않습니다. 설치한 앱에서도 기존 기록이 보이는지
            확인해 주세요.
          </p>
          <button className="primary full-width" onClick={() => setOpen(false)}>
            확인
          </button>
        </Modal>
      )}
    </>
  );
}
export function UpdateBanner() {
  const pwa = useSyncExternalStore(subscribePwa, getPwaState),
    location = useLocation();
  if (!pwa.update) return null;
  return (
    <div className="update-banner" role="status">
      <p>
        {location.pathname === "/"
          ? "새 버전이 준비됐어요."
          : "새 버전이 있어요. 편집을 마친 뒤 적용할 수 있어요."}
      </p>
      {location.pathname === "/" && (
        <button onClick={applyUpdate}>업데이트</button>
      )}
    </div>
  );
}
