import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuote, quoteTotals } from "../src/quote.js";

test("견적 금액은 서버 규칙으로 다시 계산한다", () => {
  const quote = normalizeQuote({
    clientName: " 한빛상사 ",
    taxRate: 10,
    items: [
      { name: "의자", quantity: 10, unit: "개", unitPrice: 120000 },
      { name: "배송비", quantity: 1, unit: "식", unitPrice: 50000 }
    ]
  });

  assert.deepEqual(quoteTotals(quote), {
    supply: 1250000,
    tax: 125000,
    total: 1375000
  });
  assert.equal(quote.clientName, "한빛상사");
});

test("비어 있는 품목과 음수 금액은 거부한다", () => {
  assert.throws(
    () => normalizeQuote({ clientName: "한빛상사", items: [{ name: "", quantity: 1, unitPrice: -1 }] }),
    /품목명/
  );
});

test("유효하지 않은 숫자와 날짜는 거부한다", () => {
  const base = { clientName: "한빛상사", items: [{ name: "의자", quantity: 1, unitPrice: 1000 }] };
  assert.throws(() => normalizeQuote({ ...base, taxRate: "not-a-number" }));
  assert.throws(() => normalizeQuote({ ...base, quoteDate: "2026-02-29" }));
});
