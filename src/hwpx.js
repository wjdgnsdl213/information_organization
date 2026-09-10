import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { quoteTotals } from "./quote.js";

// Hancom-converted Classic_Quotation.docx. Keep package metadata and style references intact.
const template = readFileSync(new URL("../templates/classic.hwpx", import.meta.url));
const HP = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const HH = "http://www.hancom.co.kr/hwpml/2011/head";
const nodes = (node, name) => Array.from(node.getElementsByTagNameNS(HP, name));
const children = (node, name) => Array.from(node.childNodes).filter(n => n.localName === name);
const parse = data => new DOMParser().parseFromString(strFromU8(data), "application/xml");

function fill(cell, value) {
  const text = String(value ?? "");
  if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(text)) {
    throw new Error("HWPX XML cannot contain invalid XML 1.0 characters.");
  }
  const list = nodes(cell, "subList")[0];
  const paragraph = nodes(list, "p")[0].cloneNode(true);
  const run = nodes(paragraph, "run")[0].cloneNode(false);
  // Template's empty cells use a 10pt run; retain their paragraph alignment.
  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);
  const t = cell.ownerDocument.createElementNS(HP, "hp:t");
  text.split(/\r?\n/).forEach((line, i) => {
    if (i) t.appendChild(cell.ownerDocument.createElementNS(HP, "hp:lineBreak"));
    t.appendChild(cell.ownerDocument.createTextNode(line));
  });
  run.appendChild(t);
  paragraph.appendChild(run);
  while (list.firstChild) list.removeChild(list.firstChild);
  list.appendChild(paragraph);
}

export function createHwpx(quote) {
  const files = unzipSync(template);
  const section = parse(files["Contents/section0.xml"]);
  const tables = nodes(section, "tbl");
  const set = (table, row, col, value) => fill(children(children(tables[table], "tr")[row], "tc")[col], value);
  const money = value => Math.round(value).toLocaleString("ko-KR");
  const totals = quoteTotals(quote);
  set(0, 0, 1, quote.quoteNumber);
  set(0, 0, 3, quote.quoteDate);
  set(0, 1, 1, quote.supplier.companyName);
  set(0, 1, 3, quote.clientName);
  set(2, 0, 1, quote.supplier.companyName);
  set(2, 0, 3, quote.supplier.registrationNumber);
  set(2, 1, 1, quote.supplier.representative);
  set(2, 2, 1, quote.supplier.address);
  set(4, 0, 1, quote.clientName);
  set(4, 0, 3, quote.clientContact);
  // No payment/delivery facts are inferred from quote date or general notes.
  set(7, 0, 1, money(totals.supply));
  set(7, 0, 3, money(totals.tax));
  set(7, 1, 1, money(totals.total) + " 원");
  set(7, 1, 3, quote.validUntil);
  set(8, 0, 1, quote.notes);
  const itemTable = tables[6];
  const originalRows = children(itemTable, "tr");
  while (children(itemTable, "tr").length <= quote.items.length) {
    itemTable.appendChild(originalRows[1].cloneNode(true));
  }
  const rows = children(itemTable, "tr");
  itemTable.setAttribute("rowCnt", String(rows.length));
  nodes(itemTable, "sz")[0].setAttribute("height", String(1415 + (rows.length - 1) * 1555));
  let supplySoFar = 0;
  let taxSoFar = 0;
  for (let i = 1; i < rows.length; i++) {
    const item = quote.items[i - 1];
    let values = [String(i), "", "", "", "", "", "", ""];
    if (item) {
      const supply = Math.round(item.quantity * item.unitPrice);
      supplySoFar += supply;
      const cumulativeTax = Math.round(supplySoFar * quote.taxRate / 100);
      const tax = cumulativeTax - taxSoFar;
      taxSoFar = cumulativeTax;
      values = [String(i), item.name, item.spec, item.quantity + " " + item.unit,
        money(item.unitPrice), money(supply), money(tax), money(supply + tax)];
    }
    children(rows[i], "tc").forEach((cell, col) => {
      fill(cell, values[col]);
      nodes(cell, "cellAddr")[0].setAttribute("rowAddr", String(i));
    });
  }
  // Allocate usable space to descriptions, with all rows sharing the same grid.
  const widths = [2600, 11700, 7000, 4700, 6400, 6900, 5600, 7540];
  rows.forEach(row => children(row, "tc").forEach((cell, col) => {
    nodes(cell, "cellSz")[0].setAttribute("width", String(widths[col]));
    const margin = nodes(cell, "cellMargin")[0];
    margin.setAttribute("left", "180");
    margin.setAttribute("right", "180");
  }));
  nodes(itemTable, "sz")[0].setAttribute("width", String(widths.reduce((a, b) => a + b, 0)));
  const header = parse(files["Contents/header.xml"]);
  for (const font of Array.from(header.getElementsByTagNameNS(HH, "font"))) font.setAttribute("face", "Pretendard");
  const serializer = new XMLSerializer();
  files["Contents/header.xml"] = strToU8(serializer.serializeToString(header));
  files["Contents/section0.xml"] = strToU8(serializer.serializeToString(section));
  files["Preview/PrvText.txt"] = strToU8("견적서\n" + quote.clientName + "\n" + quote.items.map(i => i.name).join("\n"));
  // A static thumbnail would show the unfilled template in file previews.
  delete files["Preview/PrvImage.png"];
  return Buffer.from(zipSync(files, { level: 0 }));
}
