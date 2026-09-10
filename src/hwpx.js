import { quoteTotals } from "./quote.js";

function escapeXml(value) {
  const text = String(value ?? "");
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== 0x9 && codePoint !== 0xa && codePoint !== 0xd &&
      !(codePoint >= 0x20 && codePoint <= 0xd7ff) &&
      !(codePoint >= 0xe000 && codePoint <= 0xfffd) &&
      !(codePoint >= 0x10000 && codePoint <= 0x10ffff)) {
      throw new Error("HWPX XML cannot contain invalid XML 1.0 characters.");
    }
  }
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [];
  const directory = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(value, "utf8");
    const crc = crc32(data);
    const flags = name === "mimetype" ? 0 : 0x800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...directory, end]);
}

function paragraph(value, id, style = 0) {
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="${style}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>${escapeXml(value)}</hp:t></hp:run></hp:p>`;
}

const sectionProperties = `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="1" pic="1" tbl="1" equation="1"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>`;

export function createHwpx(quote) {
  const totals = quoteTotals(quote);
  let paragraphId = 2;
  const addParagraph = (value, style) => paragraph(value, paragraphId++, style);
  const itemLines = quote.items.map((item, index) =>
    addParagraph(`${index + 1}. ${item.name}${item.spec ? ` (${item.spec})` : ""}  ${item.quantity}${item.unit} \u00d7 ${item.unitPrice.toLocaleString("ko-KR")}\uc6d0 = ${Math.round(item.quantity * item.unitPrice).toLocaleString("ko-KR")}\uc6d0`)
  ).join("");
  const section = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
${sectionProperties}${addParagraph("\uacac \uc801 \uc11c", 1)}${addParagraph(`\uacac\uc801\ubc88\ud638: ${quote.quoteNumber}`)}${addParagraph(`\uacac\uc801\uc77c: ${quote.quoteDate}`)}${addParagraph(`\uc218\uc2e0: ${quote.clientName} \uadc0\uc911`)}
${addParagraph("\uc544\ub798\uc640 \uac19\uc774 \uacac\uc801\ud569\ub2c8\ub2e4.")}${itemLines}${addParagraph(`\uacf5\uae09\uac00\uc561: ${totals.supply.toLocaleString("ko-KR")}\uc6d0`)}${addParagraph(`\ubd80\uac00\uc138(${quote.taxRate}%): ${totals.tax.toLocaleString("ko-KR")}\uc6d0`)}${addParagraph(`\ud569\uacc4: ${totals.total.toLocaleString("ko-KR")}\uc6d0`, 1)}
${addParagraph(`\ube44\uace0: ${quote.notes || "-"}`)}${addParagraph(`\uacf5\uae09\uc790: ${quote.supplier.companyName || "-"} / \ub300\ud45c: ${quote.supplier.representative || "-"}`)}${addParagraph(`\uc0ac\uc5c5\uc790\ubc88\ud638: ${quote.supplier.registrationNumber || "-"}`)}${addParagraph(`\uc8fc\uc18c: ${quote.supplier.address || "-"}`)}
</hs:sec>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces itemCnt="1"><hh:fontface lang="HANGUL" fontCnt="1"><hh:font id="0" face="Noto Sans KR" type="TTF" isEmbedded="0"/></hh:fontface></hh:fontfaces><hh:charProperties itemCnt="1"><hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/></hh:charPr></hh:charProperties><hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="LEFT" vertical="BASELINE"/></hh:paraPr></hh:paraProperties><hh:styles itemCnt="2"><hh:style id="0" type="PARA" name="\uae30\ubcf8 \uae00\uaf34" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/><hh:style id="1" type="PARA" name="\uc81c\ubaa9" engName="Title" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles></hh:refList></hh:head>`;
  const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0"><opf:metadata><dc:title>\uacac\uc801\uc11c</dc:title><dc:language>ko</dc:language></opf:metadata><opf:manifest><opf:item id="header" href="header.xml" media-type="application/xml"/><opf:item id="section0" href="section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/hwp+zip"/><manifest:file-entry manifest:full-path="version.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="Contents/content.hpf" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="Contents/header.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="Contents/section0.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
  const settings = `<?xml version="1.0" encoding="UTF-8"?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:CaretPosition listIDRef="0" paraIDRef="1" pos="0"/></ha:HWPApplicationSetting>`;
  return zip([
    ["mimetype", "application/hwp+zip"],
    ["version.xml", `<?xml version="1.0" encoding="UTF-8"?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="0" os="1" xmlVersion="1.4" application="Quote Maker" appVersion="0.1"/>`],
    ["META-INF/manifest.xml", manifest],
    ["META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></rootfiles></container>`],
    ["Contents/content.hpf", content], ["Contents/header.xml", header], ["settings.xml", settings], ["Contents/section0.xml", section]
  ]);
}
