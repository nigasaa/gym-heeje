import { createContext, useContext } from "react";
export const AppContext = createContext<{ say: (message: string) => void }>({
  say: () => {},
});
export const useApp = () => useContext(AppContext);
export const homePosition = { scroll: 0 };
