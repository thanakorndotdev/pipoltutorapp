import { Fragment } from "react";

const URL_RE = /(https:\/\/[^\s<>"]+)/g;
/** Sentence punctuation that usually follows a link rather than belonging to it. */
const TRAILING = /[).,;:!?'"ฯ]+$/;

/**
 * Plain text with every https:// link turned into a new-tab anchor, so an
 * admin can paste a Google Drive link into a prompt. Only https is linked;
 * everything else renders as text, never as HTML.
 */
export function LinkedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const tail = part.match(TRAILING)?.[0] ?? "";
        const href = tail ? part.slice(0, -tail.length) : part;
        return (
          <Fragment key={i}>
            <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline underline-offset-2">
              {href}
            </a>
            {tail}
          </Fragment>
        );
      })}
    </>
  );
}
