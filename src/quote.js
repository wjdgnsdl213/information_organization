const text = value => typeof value === "string" ? value.trim() : "";
const number = value => typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
const validDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function normalizeQuote(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("견적 데이터 형식이 올바르지 않습니다.");
  const items = Array.isArray(input.items) ? input.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${index + 1}번째 품목 형식이 올바르지 않습니다.`);
    const normalized = {
      name: text(item.name),
      spec: text(item.spec),
      quantity: number(item.quantity),
      unit: text(item.unit) || "개",
      unitPrice: number(item.unitPrice)
    };
    if (!normalized.name) throw new Error(`${index + 1}번째 품목명을 입력해 주세요.`);
    if (!Number.isFinite(normalized.quantity) || !(normalized.quantity > 0)) throw new Error(`${normalized.name}의 수량은 0보다 커야 합니다.`);
    if (!Number.isFinite(normalized.unitPrice) || normalized.unitPrice < 0) throw new Error(`${normalized.name}의 단가는 0 이상이어야 합니다.`);
    normalized.unitPrice = Math.round(normalized.unitPrice);
    return normalized;
  }) : [];
  if (!text(input.clientName)) throw new Error("거래처명을 입력해 주세요.");
  if (!items.length) throw new Error("품목을 한 개 이상 입력해 주세요.");

  const quoteDate = text(input.quoteDate) || new Date().toISOString().slice(0, 10);
  const validUntil = text(input.validUntil);
  const taxRate = number(input.taxRate ?? 10);
  if (!validDate(quoteDate)) throw new Error("견적일은 YYYY-MM-DD 형식이어야 합니다.");
  if (validUntil && !validDate(validUntil)) throw new Error("유효일은 YYYY-MM-DD 형식이어야 합니다.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("부가세율은 0에서 100 사이여야 합니다.");

  return {
    quoteNumber: text(input.quoteNumber) || `Q-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
    quoteDate,
    validUntil,
    clientName: text(input.clientName),
    clientContact: text(input.clientContact),
    supplier: {
      companyName: text(input.supplier?.companyName),
      registrationNumber: text(input.supplier?.registrationNumber),
      representative: text(input.supplier?.representative),
      address: text(input.supplier?.address)
    },
    taxRate,
    notes: text(input.notes),
    items
  };
}

export function quoteTotals(quote) {
  const supply = quote.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice), 0);
  const tax = Math.round(supply * quote.taxRate / 100);
  return { supply, tax, total: supply + tax };
}
