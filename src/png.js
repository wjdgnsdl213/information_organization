import { spawn } from "node:child_process";
import { join } from "node:path";

export function createQuotePng(quote) {
  return new Promise((resolve, reject) => {
    const renderer = spawn("python", [join(process.cwd(), "scripts", "render_quote_png.py")], { stdio: ["pipe", "pipe", "pipe"] });
    const output = [];
    let error = "";
    renderer.stdout.on("data", chunk => output.push(chunk));
    renderer.stderr.on("data", chunk => { error += chunk; });
    renderer.on("error", () => reject(new Error("PNG 렌더러를 시작하지 못했습니다.")));
    renderer.on("close", code => code === 0
      ? resolve(Buffer.concat(output))
      : reject(new Error(error.trim() || "견적서 PNG를 만들지 못했습니다.")));
    renderer.stdin.end(JSON.stringify(quote));
  });
}
