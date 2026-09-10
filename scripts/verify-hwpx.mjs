import { writeFileSync, mkdirSync } from "node:fs";
import { createHwpx } from "../src/hwpx.js";
import { normalizeQuote } from "../src/quote.js";

mkdirSync("tmp/verification", { recursive: true });
for (const count of [2, 12]) {
  const quote = normalizeQuote({
    clientName: "테스트상사", clientContact: "김담당", taxRate: 10,
    supplier: { companyName: "공급상사", representative: "홍길동", address: "서울시 강남구", registrationNumber: "123-45-67890" },
    notes: "견적 내용 확인 후 연락 부탁드립니다.\n배송 일정은 별도 협의합니다.",
    items: Array.from({ length: count }, (_, i) => ({
      name: "사무용 의자 " + (i + 1), spec: "기본형", quantity: 2, unit: "개", unitPrice: 100000
    }))
  });
  writeFileSync("tmp/verification/quote-" + count + ".hwpx", createHwpx(quote));
}
