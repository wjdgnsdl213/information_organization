import test from "node:test";
import assert from "node:assert/strict";
import { createHwpx } from "../src/hwpx.js";

function entries(data) {
  const files = new Map();
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 22);
    const nameLength = data.readUInt16LE(offset + 26);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + data.readUInt16LE(offset + 28);
    files.set(name, data.subarray(start, start + size).toString("utf8"));
    offset = start + size;
  }
  return files;
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

const quote = { quoteNumber: "Q-20260910-001", quoteDate: "2026-09-10", clientName: "테스트상사", taxRate: 10, notes: "납기 7일", supplier: { companyName: "견적상사", representative: "홍길동", registrationNumber: "123-45-67890", address: "서울" }, items: [{ name: "의자", spec: "기본형", quantity: 2, unit: "개", unitPrice: 100000 }] };

test("HWPX has the quote template sections and table layout", () => {
  const data = createHwpx(quote);
  const files = entries(data);
  assert.equal(data.subarray(30, 38).toString("utf8"), "mimetype");
  assert.equal(files.get("mimetype"), "application/hwp+zip");
  const section = files.get("Contents/section0.xml");
  assert.match(section, /견적서 번호/);
  assert.match(section, /공급자 정보/);
  assert.match(section, /고객 정보/);
  assert.match(section, /품목 내역/);
  assert.match(section, /공급가액 합계/);
  assert.match(section, /<hp:tbl/);
});

test("every HWPX entry has a valid ZIP checksum", () => {
  const data = createHwpx(quote);
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 22), nameLength = data.readUInt16LE(offset + 26), extraLength = data.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    assert.equal(data.readUInt32LE(offset + 14), crc32(data.subarray(start, start + size)));
    offset = start + size;
  }
});

test("HWPX escapes quote text", () => {
  const section = entries(createHwpx({ ...quote, clientName: "A&B <C>" })).get("Contents/section0.xml");
  assert.match(section, /A&amp;B &lt;C&gt;/);
});
