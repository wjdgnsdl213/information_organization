import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
const base = "https://informationorganize.vercel.app";
const page = await fetch(base + "/create");
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /app.js\?v=4/);
assert.doesNotMatch(html, /견적서 초안을 준비합니다|확인이 필요합니다/);
const response = await fetch(base + "/api/quotes/export", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clientName: "배포 검증 상사", taxRate: 10, notes: "프로덕션에서 내려받은 검증 문서",
    items: [{ name: "사무용 의자", quantity: 2, unitPrice: 100000 }]
  })
});
assert.equal(response.status, 200);
assert.equal(response.headers.get("content-type"), "application/hwp+zip");
const buffer = Buffer.from(await response.arrayBuffer());
const files = unzipSync(buffer);
assert.match(strFromU8(files["Contents/section0.xml"]), /배포 검증 상사/);
assert.match(strFromU8(files["Contents/header.xml"]), /fontfaces itemCnt="7"/);
mkdirSync("tmp/verification", { recursive: true });
writeFileSync("tmp/verification/production.hwpx", buffer);
const pdfResponse = await fetch(base + "/api/quotes/export-pdf", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clientName: "배포 검증 상사", taxRate: 10, items: [{ name: "사무용 의자", quantity: 2, unitPrice: 100000 }] })
});
assert.equal(pdfResponse.status, 200);
assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
const pdf = Buffer.from(await pdfResponse.arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
writeFileSync("tmp/verification/production.pdf", pdf);
console.log("Production page, HWPX and PDF: OK");
