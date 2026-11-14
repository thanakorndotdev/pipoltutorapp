import { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { ArticleEditor } from "./editor";

/** Static export has no dynamic segments; the article id rides in ?id= and no id means a new article. */
export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <ArticleEditor />
    </Suspense>
  );
}
