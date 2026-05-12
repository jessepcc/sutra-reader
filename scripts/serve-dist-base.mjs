#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? process.argv[2] ?? 4174);
const base = process.env.BASE_PATH ?? "/sutra-reader/";
const dist = join(process.cwd(), "dist");

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end("not found");
    return;
  }

  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const normalized = normalize(relative || "index.html");
  if (normalized.startsWith("..")) {
    res.writeHead(400).end("bad path");
    return;
  }

  const directPath = join(dist, normalized);
  const filePath = existsSync(directPath) && statSync(directPath).isFile()
    ? directPath
    : join(dist, "index.html");
  const type = types.get(extname(filePath)) ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`serving ${dist} at http://127.0.0.1:${port}${base}`);
});
