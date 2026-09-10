import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { quoteTotals } from "./quote.js";

const font = readFileSync(new URL("../assets/Pretendard-Regular.otf", import.meta.url));
const money = value => `${Math.round(value).toLocaleString("ko-KR")}원`;

export function createPdf(quote) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: { Title: `${quote.quoteNumber} 견적서` } });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("Pretendard", font).font("Pretendard");

    const left = 42;
    const width = 511;
    const half = (width - 16) / 2;
    const field = (label, value, x, y, w = half) => {
      doc.fillColor("#6b7785").fontSize(8).text(label, x, y, { width: w });
      doc.fillColor("#18212e").fontSize(10).text(value || "-", x, y + 13, { width: w });
    };
    const pageHeader = () => {
      doc.fillColor("#2463eb").fontSize(8).text("QUOTATION", left, 42);
      doc.fillColor("#18212e").fontSize(25).text("견적서", left, 57);
      field("견적서 번호", quote.quoteNumber, 390, 48, 163);
      field("견적일", quote.quoteDate, 390, 78, 163);
      doc.moveTo(left, 104).lineTo(left + width, 104).lineWidth(1.4).strokeColor("#18212e").stroke();
    };
    pageHeader();

    doc.fillColor("#2463eb").fontSize(10).text("공급자", left, 121).text("고객", left + half + 16, 121);
    field("상호", quote.supplier.companyName, left, 143);
    field("회사명 또는 성명", quote.clientName, left + half + 16, 143);
    field("대표자", quote.supplier.representative, left, 177);
    field("담당자 · 연락처", quote.clientContact, left + half + 16, 177);
    field("사업자등록번호", quote.supplier.registrationNumber, left, 211);
    field("견적 유효기간", quote.validUntil, left + half + 16, 211);
    field("주소", quote.supplier.address, left, 245, width);

    let y = 290;
    const columns = [28, 150, 62, 48, 86, 67, 70];
    const headers = ["No.", "품목명 / 규격", "수량", "단위", "단가", "공급가액", "합계"];
    const drawTableHeader = () => {
      doc.rect(left, y, width, 25).fill("#f1f4f8");
      let x = left;
      headers.forEach((header, i) => { doc.fillColor("#526070").fontSize(8).text(header, x + 4, y + 8, { width: columns[i] - 8, align: i > 1 ? "right" : "left" }); x += columns[i]; });
      y += 25;
    };
    drawTableHeader();
    let supplySoFar = 0;
    let taxSoFar = 0;
    quote.items.forEach((item, index) => {
      if (y > 735) { doc.addPage(); pageHeader(); y = 125; drawTableHeader(); }
      const supply = Math.round(item.quantity * item.unitPrice);
      supplySoFar += supply;
      const cumulativeTax = Math.round(supplySoFar * quote.taxRate / 100);
      const tax = cumulativeTax - taxSoFar;
      taxSoFar = cumulativeTax;
      const values = [index + 1, `${item.name}${item.spec ? ` / ${item.spec}` : ""}`, item.quantity, item.unit, money(item.unitPrice), money(supply), money(supply + tax)];
      let x = left;
      values.forEach((value, i) => { doc.fillColor("#18212e").fontSize(8.5).text(String(value), x + 4, y + 9, { width: columns[i] - 8, align: i > 1 ? "right" : "left", ellipsis: true }); x += columns[i]; });
      doc.moveTo(left, y + 29).lineTo(left + width, y + 29).lineWidth(.35).strokeColor("#dce3ea").stroke();
      y += 30;
    });
    const totals = quoteTotals(quote);
    y += 18;
    if (y > 680) { doc.addPage(); pageHeader(); y = 130; }
    const totalX = 360;
    [["공급가액", totals.supply], ["부가세", totals.tax], ["견적 합계", totals.total]].forEach(([label, value], i) => {
      doc.fillColor(i === 2 ? "#2463eb" : "#526070").fontSize(i === 2 ? 12 : 9).text(label, totalX, y + i * 25, { width: 75 });
      doc.text(money(value), totalX + 75, y + i * 25, { width: 118, align: "right" });
    });
    if (quote.notes) {
      doc.fillColor("#6b7785").fontSize(8).text("비고", left, y);
      doc.fillColor("#18212e").fontSize(9).text(quote.notes, left, y + 16, { width: 280, height: 65, ellipsis: true });
    }
    doc.end();
  });
}
