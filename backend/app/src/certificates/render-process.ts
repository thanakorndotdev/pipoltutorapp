/** CPU-heavy native rendering runs outside the HTTP event loop. Input is private server-generated data. */
import { mkdir } from "node:fs/promises";
import { renderPng, pngToPdf, type RenderInput } from "./render";
import { CERT_FILES_DIR, certFile } from "./issue";
const input = JSON.parse(await Bun.stdin.text()) as {
  id: string;
  render: RenderInput;
  title: string;
};
if (!/^[a-f0-9-]{36}$/.test(input.id)) throw new Error("Invalid render job");
const png = await renderPng(input.render);
const pdf = await pngToPdf(png, input.render.layout.paper, input.title);
await mkdir(CERT_FILES_DIR, { recursive: true });
await Bun.write(certFile(input.id, "png"), png);
await Bun.write(certFile(input.id, "pdf"), pdf);
