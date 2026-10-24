import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { Results } from "./results";

/** Static export has no dynamic segments; the pack id rides in ?pack=. */
export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Results />
    </Suspense>
  );
}
