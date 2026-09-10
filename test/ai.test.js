import test from "node:test";
import assert from "node:assert/strict";
import { extractQuote, parseModelQuote } from "../src/openrouter.js";

test("OpenRouter의 JSON 응답을 견적 초안으로 정규화한다", () => {
  const quote = parseModelQuote(JSON.stringify({
    clientName: "한빛상사",
    clientContact: "",
    quoteDate: "2026-09-10",
    validUntil: "",
    taxRate: 10,
    notes: "부가세 별도",
    items: [{ name: "의자", spec: "", quantity: 10, unit: "개", unitPrice: 120000 }],
    missingFields: []
  }));

  assert.equal(quote.items[0].unitPrice, 120000);
  assert.deepEqual(quote.missingFields, []);
});

test("OpenRouter 응답의 유효하지 않은 숫자는 거부한다", () => {
  assert.throws(() => parseModelQuote(JSON.stringify({
    clientName: "한빛상사", clientContact: "", quoteDate: "2026-09-10", validUntil: "",
    taxRate: null, notes: "", items: [], missingFields: []
  })));
});

test("OpenRouter에 구조화 출력 요청을 보낸다", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options: JSON.parse(options.body), headers: options.headers };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      clientName: "한빛상사", clientContact: "", quoteDate: "2026-09-10", validUntil: "",
      taxRate: 10, notes: "", items: [], missingFields: []
    }) } }] }), { status: 200 });
  };
  try {
    await extractQuote("한빛상사 견적", { apiKey: "test-key", model: "test/model" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request.options.model, "test/model");
  assert.equal(request.options.response_format.type, "json_schema");
  assert.equal(request.options.response_format.json_schema.strict, true);
  assert.equal(request.options.provider.require_parameters, true);
  assert.equal(request.headers["X-OpenRouter-Title"], "Quote Creator");
});

test("OpenRouter 모델 또는 구조화 출력 오류를 그대로 안내한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "No endpoints found that support response_format" } }), { status: 400 });
  try {
    await assert.rejects(
      () => extractQuote("한빛상사 견적", { apiKey: "test-key", model: "test/model" }),
      { message: /모델 또는 구조화 출력 요청.*No endpoints found/ }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
