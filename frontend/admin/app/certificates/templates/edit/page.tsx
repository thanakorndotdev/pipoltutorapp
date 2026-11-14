import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { TemplateEditor } from "./editor";

/** Static export has no dynamic segments; the template id rides in ?id=. */
export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <TemplateEditor />
    </Suspense>
  );
}
