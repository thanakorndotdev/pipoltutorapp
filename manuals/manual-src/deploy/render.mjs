import { chromium } from "../../../frontend/pipoltutor-app/node_modules/playwright/index.mjs";
const dir = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`file://${dir}/deploy.html`, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: process.argv[2] ?? `${dir}/../../คู่มือ-Deploy-PIPOL-TUTOR.pdf`, format: "A4", printBackground: true, displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#7a839c;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>คู่มือ Deploy PIPOL TUTOR · 21 พ.ย. 2569</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" } });
await b.close();
