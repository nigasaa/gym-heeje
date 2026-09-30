import { useEffect, useRef, useState } from "react";
import {
  createHashRouter,
  Outlet,
  RouterProvider,
  useParams,
  useLocation,
} from "react-router-dom";
import { repository } from "../storage/repository";
import { errorMessage } from "../domain/rules";
import { ErrorPanel } from "../components/Shared";
import { Home } from "../screens/Home";
import { ExerciseEditor } from "../screens/ExerciseEditor";
import { ExerciseInfo } from "../screens/ExerciseInfo";
import { AppContext } from "./context";
import { UpdateBanner } from "../pwa/InstallHelp";
function Layout() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== "/") window.scrollTo(0, 0);
  }, [location.pathname]);
  const [toast, setToast] = useState(""),
    [storageIssue, setStorageIssue] = useState(""),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const issue = (e: Event) =>
      setStorageIssue((e as CustomEvent<string>).detail);
    window.addEventListener("gym-storage-issue", issue);
    return () => {
      window.removeEventListener("gym-storage-issue", issue);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.classList.toggle(
        "keyboard-open",
        !!viewport && window.innerHeight - viewport.height > 140,
      );
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);
  const context = {
    say(message: string) {
      setToast(message);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(""), 4000);
    },
  };
  return (
    <AppContext.Provider value={context}>
      <main className="shell">
        <UpdateBanner />
        {storageIssue && <ErrorPanel message={storageIssue} />}
        <Outlet />
      </main>
      {toast && (
        <div className="success-toast" role="status">
          {toast}
        </div>
      )}
    </AppContext.Provider>
  );
}
function DetailRoute() {
  const { id } = useParams();
  return <ExerciseEditor key={id} />;
}
function InfoRoute() {
  const { id } = useParams();
  return <ExerciseInfo key={id} />;
}
const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: (
      <main className="shell">
        <ErrorPanel
          message="화면을 불러오지 못했어요. 기록은 삭제하지 않았습니다."
          retry={() => window.location.reload()}
        />
      </main>
    ),
    children: [
      { path: "/", element: <Home /> },
      { path: "/add", element: <ExerciseEditor key="add" create /> },
      { path: "/exercise/:id", element: <DetailRoute /> },
      { path: "/exercise/:id/info", element: <InfoRoute /> },
      {
        path: "*",
        element: (
          <div className="error-panel">
            <p>찾을 수 없는 화면이에요.</p>
            <a href="#/">운동 목록으로</a>
          </div>
        ),
      },
    ],
  },
]);
export function App() {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setError("");
    try {
      await repository.initialize();
      setReady(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void start();
  }, []);
  if (!ready)
    return (
      <main className="shell">
        <header className="brand-header">
          <h1 className="brand">
            <span>Gym</span>희제
          </h1>
        </header>
        {error ? (
          <ErrorPanel message={error} retry={start} />
        ) : (
          <p className="loading" role="status">
            운동을 불러오는 중…
          </p>
        )}
      </main>
    );
  return <RouterProvider router={router} />;
}
