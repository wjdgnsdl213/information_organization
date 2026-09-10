import test from "node:test";
import assert from "node:assert/strict";
import { createHwpx } from "../src/hwpx.js";

function storedEntries(data) {
  const entries = new Map();
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const method = data.readUInt16LE(offset + 8);
    const size = data.readUInt32LE(offset + 22);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    entries.set(name, { offset, method, crc: data.readUInt32LE(offset + 14), value: data.subarray(start, start + size).toString("utf8") });
    offset = start + size;
  }
  return entries;
}

function assertCentralDirectory(data, entries) {
  const endOffset = data.length - 22;
  assert.equal(data.readUInt32LE(endOffset), 0x06054b50);
  assert.equal(data.readUInt16LE(endOffset + 10), entries.size);
  const directoryOffset = data.readUInt32LE(endOffset + 16);
  let offset = directoryOffset;
  for (const [name, local] of entries) {
    assert.equal(data.readUInt32LE(offset), 0x02014b50);
    const nameLength = data.readUInt16LE(offset + 28);
    assert.equal(data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"), name);
    assert.equal(data.readUInt32LE(offset + 16), local.crc);
    assert.equal(data.readUInt32LE(offset + 42), local.offset);
    offset += 46 + nameLength;
  }
  assert.equal(offset, directoryOffset + data.readUInt32LE(endOffset + 12));
}

const quote = {
  quoteNumber: "Q-20260910-001",
  quoteDate: "2026-09-10",
  clientName: "\ud14c\uc2a4\ud2b8\uc0c1\uc0ac",
  supplier: { companyName: "\uacac\uc801\uc0c1\uc0ac", registrationNumber: "123-45-67890", representative: "\ud64d\uae38\ub3d9", address: "\uc11c\uc6b8" },
  taxRate: 10,
  notes: "\ub0a9\uae30 7\uc77c",
  items: [{ name: "\uc758\uc790 & \ucc45\uc0c1", spec: "\uae30\ubcf8\ud615", quantity: 2, unit: "\uac1c", unitPrice: 100000 }]
};

test("HWPX stores the required package entries with an uncompressed mimetype first", () => {
  const data = createHwpx(quote);
  assert.equal(data.readUInt32LE(0), 0x04034b50);
  assert.equal(data.subarray(30, 38).toString("utf8"), "mimetype");
  assert.equal(data.readUInt16LE(8), 0);
  assert.equal(data.subarray(38, 57).toString("utf8"), "application/hwp+zip");

  const entries = storedEntries(data);
  assertCentralDirectory(data, entries);
  assert.deepEqual([...entries.keys()], ["mimetype", "version.xml", "META-INF/manifest.xml", "META-INF/container.xml", "Contents/content.hpf", "Contents/header.xml", "settings.xml", "Contents/section0.xml"]);
  for (const entry of entries.values()) {
    assert.equal(entry.method, 0);
    assert.notEqual(entry.crc, 0);
  }
  assert.match(entries.get("Contents/content.hpf").value, /href="section0\.xml"/);
  assert.match(entries.get("Contents/section0.xml").value, /<hp:secPr/);
});

test("HWPX escapes XML text and rejects XML 1.0 control characters", () => {
  const entries = storedEntries(createHwpx({ ...quote, clientName: "A&B <C>" }));
  assert.match(entries.get("Contents/section0.xml").value, /A&amp;B &lt;C&gt;/);
  assert.throws(() => createHwpx({ ...quote, clientName: "bad\u0001text" }), /invalid XML 1\.0/);
});
