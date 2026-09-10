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
  const [homeHtml, createHtml] = await Promise.all([home.text(), create.text()]);
  assert.match(homeHtml, /메인페이지/);
  assert.match(homeHtml, /pretendard/i);
  assert.match(createHtml, /견적서 만들기/);
  assert.doesNotMatch(createHtml, /견적을 말하면/);
  assert.match(createHtml, /품목 내역/);
  assert.match(createHtml, /공급가액/);
  assert.doesNotMatch(createHtml, /견적서 초안을 준비합니다|확인이 필요합니다/);
  assert.equal(create.headers.get("cache-control"), "no-store");
});

test("확정 견적서는 HWPX로 내려준다", async () => {
  const response = await fetch(`${origin}/api/quotes/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientName: "테스트상사", taxRate: 10, items: [{ name: "의자", quantity: 1, unitPrice: 1000 }] })
  });
  const file = Buffer.from(await response.arrayBuffer());
  assert.equal(response.headers.get("content-type"), "application/hwp+zip");
  assert.equal(file.readUInt32LE(0), 0x04034b50);
  assert.match(response.headers.get("content-disposition"), /\.hwpx/);
});

test("확정 견적서는 PDF로도 내려준다", async () => {
  const response = await fetch(`${origin}/api/quotes/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientName: "테스트상사", taxRate: 10, items: [{ name: "의자", quantity: 1, unitPrice: 1000 }] })
  });
  const file = Buffer.from(await response.arrayBuffer());
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(file.subarray(0, 5).toString(), "%PDF-");
  assert.match(response.headers.get("content-disposition"), /\.pdf/);
});
