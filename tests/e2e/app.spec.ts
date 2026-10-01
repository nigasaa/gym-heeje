import { test, expect, type Page } from "@playwright/test";

const target = "#exercise-builtin-lat-pulldown";
const field = (page: Page, n: number, type = "중량") =>
  page.getByRole("textbox", { name: `${n}세트 ${type}`, exact: true });
async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".exercise-card")).toHaveCount(14);
}
async function firstRecord(page: Page) {
  await page.locator(target).click();
  await page.getByRole("button", { name: "+ 첫 세트 추가" }).click();
  await field(page, 1).fill("40");
  await page.getByRole("button", { name: "+ 세트 추가" }).click();
  await page.getByRole("button", { name: "+ 세트 추가" }).click();
  await field(page, 3).fill("50");
  await field(page, 3, "반복").fill("10");
  await page.getByRole("button", { name: "+ 세트 추가" }).click();
  await field(page, 4, "반복").fill("8");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(target)).toBeVisible();
}
async function dbCounts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("gym-heeje");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["exercises", "snapshots"], "readonly");
    const read = (name: string) =>
      new Promise<any[]>((resolve) => {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [exercises, snapshots] = await Promise.all([
      read("exercises"),
      read("snapshots"),
    ]);
    db.close();
    return { exercises, snapshots };
  });
}

test("첫 실행, 독립 세트, 저장, 새로고침, 무변경, 단위와 히스토리", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  await expect(page.locator(".category-section h2")).toHaveText([
    "등",
    "어깨",
    "가슴",
    "하체",
    "팔",
  ]);
  expect((await dbCounts(page)).snapshots).toHaveLength(0);
  await firstRecord(page);
  await expect(page.locator(target).locator(".set-value")).toHaveText([
    "40×12",
    "40×12",
    "50×10",
    "50×8",
  ]);
  await page.reload();
  await expect(page.locator(target).locator(".set-value")).toHaveCount(4);
  await page.locator(target).click();
  await expect(
    page.getByRole("button", { name: "저장", exact: true }),
  ).toBeDisabled();
  await field(page, 1).fill("40.0");
  await expect(
    page.getByRole("button", { name: "저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "3세트 중량 5 증가" }).click();
  await page.getByRole("button", { name: "3세트 중량 5 증가" }).click();
  expect((await dbCounts(page)).snapshots).toHaveLength(1);
  await page.getByRole("button", { name: "lb", exact: true }).click();
  await expect(field(page, 1)).toHaveValue("40.0");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  expect((await dbCounts(page)).snapshots).toHaveLength(2);
  await page.locator(target).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(page.locator(".history-meta")).toContainText("kg");
  await expect(field(page, 3)).toHaveValue("60");
  expect(errors).toEqual([]);
});

test("모바일 4세트는 한 줄: iPhone 16 Pro 폭, 세 자리 중량과 소수, 확대 시 잘림 없음", async ({
  page,
}) => {
  await boot(page);
  await firstRecord(page);
  const card = page.locator(target);
  const cases = [
    ["40", "40", "50", "50"],
    ["100", "100", "125", "125"],
    ["12.5", "12.5", "15", "15"],
    ["100.5", "100.5", "125.5", "125.5"],
  ];
  for (const weights of cases) {
    await card.click();
    for (let n = 1; n <= 4; n++) await field(page, n).fill(weights[n - 1]);
    const save = page.getByRole("button", { name: "저장", exact: true });
    if (await save.isEnabled()) await save.click();
    else await page.getByRole("button", { name: "뒤로", exact: true }).click();
    await expect(card.locator(".set-value")).toHaveCount(4);
    for (const width of [390, 402, 430]) {
      await page.setViewportSize({ width, height: 874 });
      const fits = await card.locator(".set-summary").evaluate((el) => {
        const container = el.getBoundingClientRect();
        const items = Array.from(el.querySelectorAll(".summary-item"), (item) =>
          item.getBoundingClientRect(),
        );
        return items.every(
          (item) =>
            Math.abs(item.top - items[0].top) < 1 &&
            item.left >= container.left - 1 &&
            item.right <= container.right + 1,
        );
      });
      expect(fits, `${width}px / ${weights.join(" · ")}`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 402, height: 874 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(card.locator(".set-value")).toHaveCount(4);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 800, height: 900 });
  expect(await card.locator(".set-summary").evaluate((el) => getComputedStyle(el).fontSize)).toBe("23px");
});

test("세트 복사, 중간 삭제, 취소, 마지막 삭제, 범위 입력", async ({ page }) => {
  await boot(page);
  await firstRecord(page);
  await page.locator(target).click();
  await page.getByRole("button", { name: "2세트 삭제" }).click();
  await expect(field(page, 2)).toHaveValue("50");
  await expect(page.getByText("총 3세트")).toBeVisible();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(field(page, 2)).toHaveValue("40");
  for (let n = 4; n >= 1; n--)
    await page
      .getByRole("button", { name: `${n}세트 삭제`, exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "+ 첫 세트 추가" }).click();
  for (const bad of ["-1", "2.555", "10000", ""]) {
    await field(page, 1).fill(bad);
    await expect(
      page.getByRole("button", { name: "저장", exact: true }),
    ).toBeDisabled();
  }
  await field(page, 1).fill("2.5");
  await page.getByRole("button", { name: "1세트 중량 5 감소" }).click();
  await expect(field(page, 1)).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "1세트 중량 5 감소" }),
  ).toBeDisabled();
  for (const bad of ["0", "1000", "12.5", ""]) {
    await field(page, 1, "반복").fill(bad);
    await expect(
      page.getByRole("button", { name: "저장", exact: true }),
    ).toBeDisabled();
  }
  await field(page, 1, "반복").fill("999");
  await expect(
    page.getByRole("button", { name: "1세트 반복 1 증가" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  expect((await dbCounts(page)).snapshots).toHaveLength(2);
});

test("뒤로 가기: 계속 편집, 버리기, 저장 후 나가기", async ({ page }) => {
  await boot(page);
  await firstRecord(page);
  await page.locator(target).click();
  await field(page, 1).fill("55");
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(field(page, 1)).toHaveValue("55");
  await page.goBack();
  await page.getByRole("button", { name: "버리고 나가기" }).click();
  await expect(page.locator(target)).toBeVisible();
  expect((await dbCounts(page)).snapshots).toHaveLength(1);
  await page.locator(target).click();
  await field(page, 1).fill("60");
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await page.getByRole("button", { name: "저장 후 나가기" }).click();
  await expect(page.locator(target)).toBeVisible();
  await expect(page.locator(target).locator(".set-value").first()).toHaveText(
    "60×12",
  );
  expect((await dbCounts(page)).snapshots).toHaveLength(2);
});

test("사용자 운동 추가, 정보 수정, 중복 오류, 삭제", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "+ 운동 추가" }).click();
  await page.getByLabel("대분류").selectOption("legs");
  await page.getByLabel("운동 이름").fill("핵스쿼트");
  await field(page, 1).fill("45");
  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  const card = page.getByRole("button", { name: /핵스쿼트/ });
  await expect(card).toBeVisible();
  await card.click();
  await page
    .getByRole("button", { name: "운동 정보 수정", exact: true })
    .click();
  await page.getByLabel("대분류").selectOption("shoulders");
  await page.getByLabel("운동 이름").fill("핵 스쿼트");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "핵 스쿼트", exact: true }),
  ).toBeVisible();
  expect((await dbCounts(page)).snapshots).toHaveLength(1);
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await page.getByRole("button", { name: "+ 운동 추가" }).click();
  await page.getByLabel("대분류").selectOption("shoulders");
  await page.getByLabel("운동 이름").fill("  핵   스쿼트 ");
  await field(page, 1).fill("20");
  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("같은 이름");
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await page.getByRole("button", { name: "버리고 나가기" }).click();
  await page.getByRole("button", { name: /핵 스쿼트/ }).click();
  await page.getByRole("button", { name: "운동 삭제", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "운동 삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "운동 삭제", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toHaveCount(14);
  expect((await dbCounts(page)).snapshots).toHaveLength(0);
});

test("기본 운동 삭제: 취소는 편집 유지, 확정은 해당 운동만 삭제, 재실행 보존", async ({
  page,
  browserName,
}) => {
  await boot(page);
  await firstRecord(page);
  const before = await dbCounts(page);
  await page.locator("#exercise-builtin-machine-lat-pulldown").click();
  await page.getByRole("button", { name: "+ 첫 세트 추가" }).click();
  await field(page, 1).fill("60");
  const remove = page.getByRole("button", { name: "운동 삭제", exact: true });
  await expect(remove).toBeInViewport();
  if (browserName === "chromium")
    await page.screenshot({ path: "docs/screenshots/delete-button.png" });
  await remove.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("다른 운동의 기록은 그대로 유지");
  await expect(dialog).toContainText("아직 저장하지 않은 변경사항");
  if (browserName === "chromium")
    await page.screenshot({ path: "docs/screenshots/delete-confirmation.png" });
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(field(page, 1)).toHaveValue("60");
  expect(await dbCounts(page)).toEqual(before);
  await remove.click();
  await dialog.getByRole("button", { name: "운동 삭제", exact: true }).click();
  await expect(page.locator(".exercise-card")).toHaveCount(13);
  await page.reload();
  await expect(page.locator(".exercise-card")).toHaveCount(13);
  const after = await dbCounts(page);
  expect(after.snapshots).toEqual(before.snapshots);
  expect(after.exercises).toEqual(
    before.exercises.filter((e) => e.id !== "builtin-machine-lat-pulldown"),
  );
  await expect(page.locator(target).locator(".set-value")).toHaveCount(4);
});

test("최근 5개 표시, 같은 날 전체 보관, 저장 버튼 연속 조작", async ({
  page,
}) => {
  await boot(page);
  await firstRecord(page);
  for (let n = 1; n <= 6; n++) {
    await page.locator(target).click();
    await field(page, 1).fill(String(40 + n * 5));
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.locator(target)).toBeVisible();
  }
  await page.locator(target).click();
  await expect(page.locator(".history-card")).toHaveCount(5);
  expect((await dbCounts(page)).snapshots).toHaveLength(7);
  await field(page, 1).fill("80");
  await page.getByRole("button", { name: "저장", exact: true }).dblclick();
  await expect(page.locator(target)).toBeVisible();
  expect((await dbCounts(page)).snapshots).toHaveLength(8);
});

test("두 창에서 같은 운동을 수정해도 먼저 저장한 값을 보존", async ({
  page,
  context,
}) => {
  await boot(page);
  await firstRecord(page);
  await page.locator(target).click();
  await field(page, 1).fill("55");
  const second = await context.newPage();
  await second.goto("/");
  await second.locator(target).click();
  await field(second, 1).fill("65");
  await second.getByRole("button", { name: "저장", exact: true }).click();
  await expect(second.locator(target)).toBeVisible();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("최신 설정 다시 불러오기")).toBeVisible();
  await expect(field(page, 1)).toHaveValue("55");
  expect((await dbCounts(page)).snapshots.at(-1)?.sets[0].weight).toBeDefined();
  await page.getByRole("button", { name: "최신 설정 다시 불러오기" }).click();
  await page.getByRole("button", { name: "불러오기", exact: true }).click();
  await expect(field(page, 1)).toHaveValue("65");
});

test("PWA 파일, 외부 요청 없음, 오프라인 저장과 재실행", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright 1.63 WebKit offline emulation bug: https://github.com/microsoft/playwright/issues/42775; physical iOS check remains.",
  );
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173/")) external.push(r.url());
  });
  await boot(page);
  await firstRecord(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator(target)).toBeVisible();
  await expect(page.getByText("오프라인 사용 준비 완료")).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("Gym희제");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  await context.setOffline(true);
  await page.reload();
  await page.locator(target).click();
  await field(page, 1).fill("75");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  // Wait for the committed value and completed navigation before restarting.
  await expect(page.locator(target).locator(".set-value").first()).toHaveText(
    "75×12",
  );
  await page.reload();
  await expect(page.locator(target).locator(".set-value").first()).toHaveText(
    "75×12",
  );
  expect(external).toEqual([]);
  await context.setOffline(false);
});

test("320~430px, 긴 이름, 50세트, 작은 화면의 터치 영역", async ({ page }) => {
  test.setTimeout(90000);
  await boot(page);
  await page.getByRole("button", { name: "+ 운동 추가" }).click();
  await page.getByLabel("대분류").selectOption("legs");
  await page
    .getByLabel("운동 이름")
    .fill("이름이길어도세트별기록과조작을빠짐없이확인하는운동");
  await field(page, 1).fill("9999.99");
  await field(page, 1, "반복").fill("999");
  for (let n = 1; n < 50; n++)
    await page.getByRole("button", { name: "+ 세트 추가" }).click();
  await expect(page.locator(".set-card")).toHaveCount(50);
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const controls = await page.locator(".stepper>button").evaluateAll((els) =>
      els.every((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 48 && r.height >= 48;
      }),
    );
    expect(controls).toBe(true);
  }
  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  await expect(page.locator(".exercise-card")).toHaveCount(15);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .locator(".exercise-card")
      .filter({ hasText: "이름이길어도" })
      .locator(".set-value"),
  ).toHaveCount(50);
});
