const schema = {
  type: "object",
  properties: {
    clientName: { type: "string", description: "견적을 받는 거래처명. 없으면 빈 문자열" },
    clientContact: { type: "string", description: "담당자명 또는 연락처. 없으면 빈 문자열" },
    quoteDate: { type: "string", description: "YYYY-MM-DD. 언급이 없으면 오늘 날짜" },
    validUntil: { type: "string", description: "YYYY-MM-DD. 없으면 빈 문자열" },
    taxRate: { type: "number", description: "부가세율. 부가세 별도는 10, 면세는 0" },
    notes: { type: "string", description: "납기, 결제 조건 및 기타 메모" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" }, spec: { type: "string" }, quantity: { type: "number" },
          unit: { type: "string" }, unitPrice: { type: "number" }
        },
        required: ["name", "spec", "quantity", "unit", "unitPrice"],
        additionalProperties: false
      }
    },
    missingFields: { type: "array", items: { type: "string" }, description: "작성에 꼭 필요하지만 입력에 없는 항목" }
  },
  required: ["clientName", "clientContact", "quoteDate", "validUntil", "taxRate", "notes", "items", "missingFields"],
  additionalProperties: false
};

export function parseModelQuote(content) {
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.items) || !Array.isArray(parsed.missingFields)) {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  const string = value => typeof value === "string" ? value.trim() : null;
  const finiteNumber = value => typeof value === "number" && Number.isFinite(value) ? value : null;
  const clientName = string(parsed.clientName);
  const clientContact = string(parsed.clientContact);
  const quoteDate = string(parsed.quoteDate);
  const validUntil = string(parsed.validUntil);
  const notes = string(parsed.notes);
  const taxRate = finiteNumber(parsed.taxRate);
  if ([clientName, clientContact, quoteDate, validUntil, notes, taxRate].includes(null) || taxRate < 0 || taxRate > 100) {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  const items = parsed.items.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
    const name = string(item.name);
    const spec = string(item.spec);
    const unit = string(item.unit);
    const quantity = finiteNumber(item.quantity);
    const unitPrice = finiteNumber(item.unitPrice);
    if ([name, spec, unit, quantity, unitPrice].includes(null) || quantity < 0 || unitPrice < 0) throw new Error("AI 응답 형식이 올바르지 않습니다.");
    return { name, spec, quantity, unit, unitPrice: Math.round(unitPrice) };
  });
  const missingFields = parsed.missingFields.map(string);
  if (missingFields.includes(null)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return { clientName, clientContact, quoteDate, validUntil, taxRate, notes, items, missingFields };
}

export async function extractQuote(input, { apiKey = process.env.OPENROUTER_API_KEY, model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini" } = {}) {
  if (!apiKey) {
    const error = new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  if (typeof input !== "string" || !input.trim()) throw new Error("견적 내용을 입력해 주세요.");
  const today = new Date().toISOString().slice(0, 10);
  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      // Fetch headers must be ByteStrings; OpenRouter display titles can be ASCII.
      "X-OpenRouter-Title": "Quote Creator"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `당신은 한국어 견적 요청에서 사실만 추출한다. 오늘은 ${today}이다. 입력에 없는 거래처, 품목, 수량, 단가를 추측하지 말고 빈 값이나 0으로 두며 missingFields에 한국어 필드명을 넣는다. 금액은 원 단위 숫자로 바꾼다.` },
        { role: "user", content: input }
      ],
      response_format: { type: "json_schema", json_schema: { name: "quote_draft", strict: true, schema } },
      provider: { require_parameters: true },
      temperature: 0
    })
    });
  } catch {
    const error = new Error("OpenRouter 요청을 전송하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    error.status = 502;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error?.message || `HTTP ${response.status}`;
    const message = response.status === 401 || response.status === 403
      ? "OpenRouter API 키를 확인해 주세요."
      : response.status === 402
        ? "OpenRouter 크레딧 또는 결제 상태를 확인해 주세요."
        : response.status === 429
          ? "OpenRouter 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
          : `OpenRouter가 모델 또는 구조화 출력 요청을 처리하지 못했습니다: ${detail}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter가 빈 응답을 반환했습니다.");
  try {
    return parseModelQuote(content);
  } catch {
    const error = new Error("OpenRouter 응답 형식이 올바르지 않습니다.");
    error.status = 502;
    throw error;
  }
}
