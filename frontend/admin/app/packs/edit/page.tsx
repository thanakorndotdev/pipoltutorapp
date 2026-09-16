import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { PackEditor } from "./editor";

/** Static export has no dynamic segments; the pack id rides in ?id=. */
export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <PackEditor />
    </Suspense>
  );
}
