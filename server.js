import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractQuote } from "./src/openrouter.js";
import { normalizeQuote, quoteTotals } from "./src/quote.js";
import { createHwpx } from "./src/hwpx.js";

const port = Number(process.env.PORT || 3000);
const publicRoot = join(process.cwd(), "public");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

async function jsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error("입력 크기는 1MB 이하여야 합니다.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("JSON 요청 본문이 올바르지 않습니다.");
    error.status = 400;
    throw error;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (request.method === "POST" && pathname === "/api/quotes/parse") {
      const { input } = await jsonBody(request);
      if (typeof input !== "string" || !input.trim()) return sendJson(response, 400, { error: "견적 내용을 입력해 주세요." });
      return sendJson(response, 200, await extractQuote(input.slice(0, 10_000)));
    }
    if (request.method === "POST" && pathname === "/api/quotes/export") {
      const quote = normalizeQuote(await jsonBody(request));
      const file = createHwpx(quote);
      response.writeHead(200, {
        "Content-Type": "application/hwp+zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${quote.quoteNumber}-견적서.hwpx`)}`,
        "Content-Length": file.length
      });
      return response.end(file);
    }
    if (request.method === "POST" && pathname === "/api/quotes/calculate") {
      const quote = normalizeQuote(await jsonBody(request));
      return sendJson(response, 200, quoteTotals(quote));
    }
    if (request.method !== "GET") return sendJson(response, 404, { error: "요청한 기능을 찾을 수 없습니다." });

    const requested = decodeURIComponent(pathname);
    const requestedPath = requested === "/" ? "landing.html" : requested === "/create" ? "index.html" : requested.slice(1);
    const filePath = resolve(publicRoot, requestedPath);
    const pathFromRoot = relative(publicRoot, filePath);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${String.fromCharCode(92)}`) || pathFromRoot.startsWith("../") || isAbsolute(pathFromRoot)) {
      return sendJson(response, 403, { error: "접근할 수 없습니다." });
    }
    const contentType = types[extname(filePath)];
    if (!contentType) return sendJson(response, 404, { error: "페이지를 찾을 수 없습니다." });
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return sendJson(response, 404, { error: "페이지를 찾을 수 없습니다." });
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 400;
    if (status >= 500) console.error(error);
    sendJson(response, status, { error: error.message || "요청을 처리하지 못했습니다." });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, () => console.log(`견적서 작성기: http://localhost:${port}`));
}
