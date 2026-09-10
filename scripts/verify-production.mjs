import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
const base = "https://informationorganize.vercel.app";
const page = await fetch(base + "/create");
assert.equal(page.status, 200);
assert.match(await page.text(), /style.css\?v=3/);
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
console.log("Production page and template-based HWPX: OK");
