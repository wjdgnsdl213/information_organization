import test from "node:test";
import assert from "node:assert/strict";
import { createQuotePng } from "../src/png.js";

test("견적 데이터를 PNG 이미지로 렌더링한다", async () => {
  const image = await createQuotePng({
    quoteNumber: "Q-20260910-001",
    quoteDate: "2026-09-10",
    clientName: "한빛상사",
    taxRate: 10,
    notes: "납기 7일",
    supplier: { companyName: "견적상사", representative: "홍길동", registrationNumber: "123-45-67890", address: "서울" },
    items: [{ name: "사무용 의자", spec: "기본형", quantity: 2, unit: "개", unitPrice: 100000 }]
  });

  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(image.length > 1_000);
});
