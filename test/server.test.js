import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { server } from "../server.js";

let origin;

before(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise(resolve => server.close(resolve)));

test("잘못된 견적 입력과 공개 폴더 밖의 파일을 거부한다", async () => {
  const [invalidQuote, traversal, hiddenFile] = await Promise.all([
    fetch(`${origin}/api/quotes/calculate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName: "한빛", items: [{ name: "의자", quantity: 1, unitPrice: "NaN" }] }) }),
    fetch(`${origin}/%2e%2e%2fpackage.json`),
    fetch(`${origin}/.env`)
  ]);

  assert.equal(invalidQuote.status, 400);
  assert.equal(traversal.status, 403);
  assert.equal(hiddenFile.status, 404);
});

test("소개 페이지와 견적 작성 페이지를 분리한다", async () => {
  const [home, create] = await Promise.all([fetch(`${origin}/`), fetch(`${origin}/create`)]);
  assert.match(await home.text(), /AI 견적서 작성/);
  assert.match(await create.text(), /견적 요청 내용/);
});

test("확정 견적서는 PNG로 내려준다", async () => {
  const response = await fetch(`${origin}/api/quotes/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientName: "테스트상사", taxRate: 10, items: [{ name: "의자", quantity: 1, unitPrice: 1000 }] })
  });
  const image = Buffer.from(await response.arrayBuffer());
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
