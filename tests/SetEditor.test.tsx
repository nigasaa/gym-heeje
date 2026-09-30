import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { SetEditor } from "../src/components/SetEditor";
import type { Draft } from "../src/domain/model";
const draft: Draft = {
  unit: "kg",
  sets: [
    { id: "a", weight: "40", reps: "12" },
    { id: "b", weight: "50", reps: "10" },
  ],
};
function Harness() {
  const [value, setValue] = useState(draft);
  return <SetEditor draft={value} onChange={setValue} originalUnit="kg" />;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("T05 T06 T07 복사본만 수정하고 삭제 후 원래 위치로 취소한다", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "+ 세트 추가" }));
  expect(screen.getByLabelText("3세트 중량")).toHaveValue("50");
  fireEvent.click(screen.getByRole("button", { name: "3세트 중량 5 증가" }));
  expect(screen.getByLabelText("2세트 중량")).toHaveValue("50");
  expect(screen.getByLabelText("3세트 중량")).toHaveValue("55");
  fireEvent.click(screen.getByRole("button", { name: "2세트 삭제" }));
  expect(screen.getByLabelText("2세트 중량")).toHaveValue("55");
  fireEvent.click(screen.getByRole("button", { name: "실행 취소" }));
  expect(screen.getByLabelText("2세트 중량")).toHaveValue("50");
  expect(screen.getByLabelText("3세트 중량")).toHaveValue("55");
});
it("T07 실행 취소는 5초 후 닫힌다", () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "2세트 삭제" }));
  expect(screen.getByRole("button", { name: "실행 취소" })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5001));
  expect(
    screen.queryByRole("button", { name: "실행 취소" }),
  ).not.toBeInTheDocument();
});
