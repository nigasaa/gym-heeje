import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

test("하위 경로, 실제 새 버전 적용, 다른 창의 편집 보존, 캐시 분리", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90000);
  // Actual platform installation is a separate physical-device check.
  test.skip(
    browserName === "webkit",
    "Service-worker lifecycle test runs in Chromium; physical iOS remains a manual check.",
  );
  const current = resolve("tests/fixtures/v1.0-app"),
    next = resolve("dist"),
    future = resolve("../../work/update-next");
  await stat(resolve(next, "sw.js"));
  let useNext = false;
  let useFuture = false;
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
      if (!pathname.startsWith("/gym-heeje/")) {
        res.writeHead(404).end();
        return;
      }
      const relative = pathname.slice("/gym-heeje/".length) || "index.html",
        root = useFuture ? future : useNext ? next : current,
        path = resolve(root, relative);
      if (!path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const mime: Record<string, string> = {
        ".js": "text/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number },
    url = `http://127.0.0.1:${address.port}/gym-heeje/`;
  try {
    await page.goto(url);
    await expect(page.locator(".exercise-card")).toHaveCount(14);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.getByRole("button", { name: "+ 운동 추가" }).click();
    await page.getByLabel("대분류").selectOption("legs");
    await page.getByLabel("운동 이름").fill("업데이트 보존 테스트");
    await page
      .getByRole("textbox", { name: "1세트 중량", exact: true })
      .fill("12.5");
    await page.getByRole("button", { name: "lb", exact: true }).click();
    await page.getByRole("button", { name: "운동 추가", exact: true }).click();
    await page.locator("#exercise-builtin-lat-pulldown").click();
    await page.getByRole("button", { name: "+ 첫 세트 추가" }).click();
    await page
      .getByRole("textbox", { name: "1세트 중량", exact: true })
      .fill("35");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.locator("#exercise-builtin-lat-pulldown").click();
    await page
      .getByRole("textbox", { name: "1세트 중량", exact: true })
      .fill("40");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.locator("#exercise-builtin-lat-pulldown").click();
    await page
      .getByRole("textbox", { name: "1세트 중량", exact: true })
      .fill("55");
    await page.evaluate(async () => {
      const c = await caches.open("other-app-test-cache");
      await c.put("/keep", new Response("preserve"));
    });
    const home = await context.newPage();
    await home.goto(url);
    await expect(home.locator(".exercise-card")).toHaveCount(15);
    const readRecords = () =>
      home.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("gym-heeje");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const names = ["categories", "exercises", "snapshots"];
        const tx = database.transaction(names);
        const records = await Promise.all(
          names.map(
            (name) =>
              new Promise<unknown[]>((resolve, reject) => {
                const request = tx.objectStore(name).getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              }),
          ),
        );
        database.close();
        return records;
      });
    const before = await readRecords();
    useNext = true;
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r?.update();
    });
    await expect(
      page.getByText("새 버전이 있어요. 편집을 마친 뒤 적용할 수 있어요."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "업데이트", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "1세트 중량", exact: true }),
    ).toHaveValue("55");
    // Existing home tab is told about the waiting worker on its explicit update check.
    await home.reload();
    await expect(
      home.getByRole("button", { name: "업데이트", exact: true }),
    ).toBeVisible();
    await home.getByRole("button", { name: "업데이트", exact: true }).click();
    await expect(home.locator("html")).toHaveAttribute("data-release", "1.1.3");
    await expect(
      page.getByRole("textbox", { name: "1세트 중량", exact: true }),
    ).toHaveValue("55");
    await expect(page.locator("html")).toHaveAttribute("data-release", "1.0.0");
    await expect(
      home.locator("#exercise-builtin-lat-pulldown").locator(".set-value"),
    ).toHaveText("40×12");
    expect(await readRecords()).toEqual(before);
    // Delete in v1.1, then apply another release: initialization must not reseed it.
    await home.locator("#exercise-builtin-machine-lat-pulldown").click();
    await home.getByRole("button", { name: "운동 삭제", exact: true }).click();
    await home
      .getByRole("dialog")
      .getByRole("button", { name: "운동 삭제", exact: true })
      .click();
    await expect(home.locator(".exercise-card")).toHaveCount(14);
    const afterDeletion = await readRecords();
    useFuture = true;
    await home.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    await home.getByRole("button", { name: "업데이트", exact: true }).click();
    await expect(home.locator("html")).toHaveAttribute(
      "data-release",
      "qa-next",
    );
    await expect(home.locator(".exercise-card")).toHaveCount(14);
    expect(await readRecords()).toEqual(afterDeletion);
    await expect(
      home.locator("#exercise-builtin-machine-lat-pulldown"),
    ).toHaveCount(0);
    expect(await home.evaluate(() => caches.has("other-app-test-cache"))).toBe(
      true,
    );
    await context.setOffline(true);
    await home.reload();
    await expect(
      home.locator("#exercise-builtin-lat-pulldown").locator(".set-value"),
    ).toHaveText("40×12");
    await context.setOffline(false);
  } finally {
    await new Promise<void>((r) => {
      server.close(() => r());
      // The isolated test browser can still hold keep-alive connections.
      server.closeAllConnections();
    });
  }
});

test("검증용 예시 화면 캡처와 글자 확대", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "One reference screenshot set is sufficient.",
  );
  await page.goto("/");
  await expect(page.locator(".exercise-card")).toHaveCount(14);
  await page.getByRole("button", { name: "사용 안내 닫기" }).click();
  await page.locator("#exercise-builtin-lat-pulldown").click();
  await page.getByRole("button", { name: "+ 첫 세트 추가" }).click();
  await page
    .getByRole("textbox", { name: "1세트 중량", exact: true })
    .fill("40");
  for (let n = 2; n <= 4; n++) {
    await page.getByRole("button", { name: "+ 세트 추가" }).click();
    if (n >= 3) {
      await page
        .getByRole("textbox", { name: `${n}세트 중량`, exact: true })
        .fill("50");
      await page
        .getByRole("textbox", { name: `${n}세트 반복`, exact: true })
        .fill(n === 3 ? "10" : "8");
    }
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator("#exercise-builtin-lat-pulldown")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/mobile-main.png" });
  await page.locator("#exercise-builtin-lat-pulldown").click();
  await page
    .getByRole("textbox", { name: "3세트 중량", exact: true })
    .fill("55");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.locator("#exercise-builtin-lat-pulldown").click();
  await expect(page.getByText("저장했어요", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/mobile-editor.png" });
  await page.locator(".history-section").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/screenshots/mobile-history.png" });
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
