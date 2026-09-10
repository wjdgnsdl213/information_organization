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
