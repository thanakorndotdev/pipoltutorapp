import { app } from "./app";
import { startCertificateWorker } from "./certificates/worker";
import { archiveDaily, ensureDay } from "./features/daily";
import { publishDue } from "./features/cms";
import { purgeExpired } from "./features/retention";
import { bangkokDay } from "./features/common";
import { db } from "./db";
const port = Number(process.env.PORT ?? 3001);
app.listen(port);
startCertificateWorker();
let maintaining = false,
  lastPurge = 0;
async function maintenance() {
  if (maintaining) return;
  maintaining = true;
  try {
    await publishDue();
    await db.transaction((tx) => ensureDay(tx, bangkokDay()));
    await archiveDaily();
    // Hourly is enough for day-granular retention.
    if (Date.now() - lastPurge > 3600_000) {
      await purgeExpired();
      lastPurge = Date.now();
    }
  } catch {
    console.error("Scheduled maintenance failed; it will retry");
  } finally {
    maintaining = false;
  }
}
void maintenance();
setInterval(() => void maintenance(), 30_000);
console.log(`PIPOL TUTOR API listening on ${port}`);
