const $ = selector => document.querySelector(selector);
const won = value => `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;

const elements = {
  request: $("#requestInput"), mic: $("#micButton"), micLabel: $("#micLabel"), live: $("#liveRow"),
  parse: $("#parseButton"), inputError: $("#inputError"), form: $("#quoteForm"), empty: $("#emptyState"),
  rows: $("#itemRows"), template: $("#itemTemplate"), missing: $("#missingFields"), exportError: $("#exportError")
};
let stopListening = () => {};

function addItem(item = {}) {
  const row = elements.template.content.firstElementChild.cloneNode(true);
  for (const input of row.querySelectorAll("input")) input.value = item[input.dataset.field] || (input.dataset.field === "unit" ? "개" : "");
  row.querySelector(".remove-item").addEventListener("click", () => { row.remove(); calculate(); });
  row.addEventListener("input", calculate);
  elements.rows.append(row);
  calculate();
}

function calculate() {
  let supply = 0;
  for (const row of elements.rows.rows) {
    const quantity = Number(row.querySelector('[data-field="quantity"]').value || 0);
    const unitPrice = Number(row.querySelector('[data-field="unitPrice"]').value || 0);
    const total = Math.round(quantity * unitPrice);
    row.querySelector(".line-total").textContent = won(total);
    supply += total;
  }
  const tax = Math.round(supply * Number($("#taxRate").value || 0) / 100);
  $("#supplyTotal").textContent = won(supply);
  $("#taxTotal").textContent = won(tax);
  $("#grandTotal").textContent = won(supply + tax);
}

function quoteData() {
  const items = [...elements.rows.rows].map(row => Object.fromEntries(
    [...row.querySelectorAll("input")].map(input => [input.dataset.field, ["quantity", "unitPrice"].includes(input.dataset.field) ? Number(input.value) : input.value])
  ));
  return {
    quoteNumber: $("#quoteNumber").value, quoteDate: $("#quoteDate").value, validUntil: $("#validUntil").value,
    clientName: $("#clientName").value, clientContact: $("#clientContact").value, taxRate: Number($("#taxRate").value),
    notes: $("#notes").value, items,
    supplier: { companyName: $("#supplierCompany").value, representative: $("#supplierRepresentative").value, registrationNumber: $("#supplierRegistration").value, address: $("#supplierAddress").value }
  };
}

function showDraft(draft) {
  $("#quoteNumber").value = `Q-${String(draft.quoteDate || new Date().toISOString().slice(0, 10)).replaceAll("-", "")}`;
  $("#quoteDate").value = draft.quoteDate || new Date().toISOString().slice(0, 10);
  $("#validUntil").value = draft.validUntil || "";
  $("#clientName").value = draft.clientName || "";
  $("#clientContact").value = draft.clientContact || "";
  $("#taxRate").value = draft.taxRate ?? 10;
  $("#notes").value = draft.notes || "";
  elements.rows.replaceChildren();
  for (const item of draft.items || []) addItem(item);
  if (!elements.rows.children.length) addItem();
  const missing = draft.missingFields || [];
  elements.missing.hidden = !missing.length;
  elements.missing.textContent = missing.length ? `확인이 필요합니다: ${missing.join(", ")}` : "";
  elements.empty.hidden = true;
  elements.empty.classList.add("is-hidden");
  elements.form.hidden = false;
  elements.form.classList.add("is-visible");
  calculate();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

elements.parse.addEventListener("click", async () => {
  elements.inputError.textContent = "";
  const input = elements.request.value.trim();
  if (!input) return elements.inputError.textContent = "견적 내용을 입력해 주세요.";
  stopListening();
  elements.parse.disabled = true;
  elements.parse.textContent = "견적 내용을 정리하는 중…";
  try {
    const response = await fetch("/api/quotes/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showDraft(body);
  } catch (error) {
    elements.inputError.textContent = error.message || "견적 초안을 만들지 못했습니다.";
  } finally {
    elements.parse.disabled = false;
    elements.parse.textContent = "AI로 견적 초안 만들기";
  }
});

$("#addItem").addEventListener("click", () => addItem());
$("#taxRate").addEventListener("input", calculate);

elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  elements.exportError.textContent = "";
  const button = elements.form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "PNG 만드는 중…";
  try {
    const response = await fetch("/api/quotes/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quoteData()) });
    if (!response.ok) throw new Error((await response.json()).error);
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: `${$("#quoteNumber").value}-견적서.png` });
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    elements.exportError.textContent = error.message || "파일을 만들지 못했습니다.";
  } finally {
    button.disabled = false;
    button.textContent = "확인 후 PNG 다운로드";
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  elements.mic.disabled = true;
  elements.mic.title = "이 브라우저는 실시간 음성 인식을 지원하지 않습니다.";
  $("#speechSupport").textContent = "이 브라우저에서는 문자로 입력해 주세요. Chrome 또는 Edge에서 실시간 음성을 사용할 수 있습니다.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  let listening = false;
  let baseText = "";
  let finalText = "";

  function setMicState(active) {
    elements.mic.setAttribute("aria-pressed", String(active));
    elements.micLabel.textContent = active ? "입력 종료" : "음성 입력";
    elements.live.hidden = !active;
  }

  stopListening = () => {
    if (!listening) return;
    listening = false;
    recognition.stop();
    setMicState(false);
  };

  recognition.addEventListener("result", event => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${transcript} `;
      else interim += transcript;
    }
    elements.request.value = [baseText, finalText, interim].filter(Boolean).join(" ").trim();
  });
  recognition.addEventListener("end", () => {
    if (!listening) return;
    try {
      recognition.start();
    } catch {
      listening = false;
      setMicState(false);
      elements.inputError.textContent = "음성 인식을 다시 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  });
  recognition.addEventListener("error", event => {
    if (event.error !== "no-speech") {
      listening = false;
      setMicState(false);
      elements.inputError.textContent = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "마이크 권한을 허용한 뒤 다시 시도해 주세요."
        : "음성 인식에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  });

  elements.mic.addEventListener("click", () => {
    elements.inputError.textContent = "";
    if (listening) {
      stopListening();
      return;
    }
    baseText = elements.request.value.trim();
    finalText = "";
    listening = true;
    setMicState(true);
    try {
      recognition.start();
    } catch {
      listening = false;
      setMicState(false);
      elements.inputError.textContent = "음성 인식을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  });
}

for (const id of ["supplierCompany", "supplierRepresentative", "supplierRegistration", "supplierAddress"]) {
  const input = $(`#${id}`);
  input.value = localStorage.getItem(id) || "";
  input.addEventListener("change", () => localStorage.setItem(id, input.value));
}
