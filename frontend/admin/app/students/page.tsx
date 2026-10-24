import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { Student } from "./student";

/** Static export has no dynamic segments; the user id rides in ?id=. */
export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Student />
    </Suspense>
  );
}
