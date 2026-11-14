/* eslint-disable @next/next/no-img-element -- validated CMS media */
import { Fragment } from "react";
import katex from "katex";
import type { ArticleBlock } from "@/lib/types";
const href = (v: string) =>
  /^https:\/\//.test(v) || /^\/(?!\/)/.test(v) ? v : "#";
function Equation({ text, block = false }: { text: string; block?: boolean }) {
  return (
    <span
      className={
        block
          ? "block overflow-x-auto py-3"
          : "inline-block max-w-full overflow-x-auto align-middle"
      }
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(text, {
          throwOnError: false,
          trust: false,
          displayMode: block,
          maxExpand: 1000,
          maxSize: 10,
          strict: "warn",
        }),
      }}
    />
  );
}
export function Inline({ text }: { text: string }) {
  const parts = text.split(
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|\$[^$]+\$|\[[^\]]+\]\([^)]+\))/g,
  );
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("__") ? (
          <u key={i}>{p.slice(2, -2)}</u>
        ) : p.startsWith("*") ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : p.startsWith("$") ? (
          <Equation key={i} text={p.slice(1, -1)} />
        ) : p.startsWith("[") ? (
          (() => {
            const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            return m ? (
              <a
                key={i}
                href={href(m[2]!)}
                rel="noopener noreferrer"
                className="text-brand underline underline-offset-2"
              >
                {m[1]}
              </a>
            ) : (
              p
            );
          })()
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
function embed(url: string) {
  try {
    const u = new URL(url);
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(u.hostname)) {
      const id =
        u.hostname === "youtu.be"
          ? u.pathname.slice(1)
          : (u.searchParams.get("v") ?? u.pathname.split("/").at(-1));
      if (id && /^[\w-]{6,20}$/.test(id))
        return `https://www.youtube.com/embed/${id}`;
    }
    if (["www.tiktok.com", "tiktok.com"].includes(u.hostname)) {
      const id = u.pathname.match(/\/video\/(\d+)/)?.[1];
      if (id) return `https://www.tiktok.com/embed/v2/${id}`;
    }
  } catch {}
  return null;
}
export function ArticleBlocks({
  blocks,
  mobile = false,
}: {
  blocks: ArticleBlock[];
  mobile?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5 text-[17px] leading-[1.75]">
      {blocks.map((b, i) => {
        if (b.type === "heading")
          return (
            <h2
              key={i}
              className="mt-3 text-[24px] font-semibold leading-[1.35]"
            >
              <Inline text={b.text} />
            </h2>
          );
        if (b.type === "separator")
          return <hr key={i} className="border-border" />;
        if (b.type === "math") return <Equation key={i} text={b.text} block />;
        if (b.type === "image")
          return (
            <figure
              key={i}
              style={{
                width: `${b.width ?? 100}%`,
                alignSelf:
                  b.align === "left"
                    ? "flex-start"
                    : b.align === "right"
                      ? "flex-end"
                      : "center",
              }}
            >
              <a href={href(b.url)} target="_blank" rel="noopener noreferrer">
                <img
                  src={b.url}
                  alt={b.alt}
                  loading="lazy"
                  className="h-auto w-full rounded-[16px]"
                />
              </a>
              {b.caption ? (
                <figcaption className="mt-2 text-center text-[14px] text-ink2">
                  {b.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        if (b.type === "columns")
          return (
            <div
              key={i}
              className={`grid min-w-0 gap-5 ${mobile ? "grid-cols-1" : b.columns.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              {b.columns.map((c, j) => (
                <ArticleBlocks key={j} blocks={c} mobile={mobile} />
              ))}
            </div>
          );
        if (b.type === "table")
          return (
            <div
              key={i}
              className="max-w-full overflow-x-auto rounded-[12px] border border-border"
            >
              <table className="w-full border-collapse">
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td
                          key={k}
                          rowSpan={c.rowSpan}
                          colSpan={c.colSpan}
                          className="min-w-[120px] border border-border p-3 align-top"
                          style={{
                            textAlign: c.align,
                            background: c.background,
                          }}
                        >
                          <Inline text={c.text} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type === "video") {
          const src = embed(b.url);
          return src ? (
            <iframe
              key={i}
              src={src}
              title={b.title}
              className="aspect-video w-full rounded-[16px] border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <a key={i} href={href(b.url)} rel="noopener noreferrer">
              {b.title}
            </a>
          );
        }
        if (b.type === "button" || b.type === "attachment")
          return (
            <a
              key={i}
              href={href(b.url)}
              className="inline-flex min-h-[44px] self-start items-center rounded-[12px] bg-brand px-5 py-3 font-medium text-on-fill"
              rel="noopener noreferrer"
              download={b.type === "attachment" || undefined}
            >
              {b.text}
            </a>
          );
        if (b.type === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={`pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}
            >
              {b.items.map((t, j) => (
                <li key={j}>
                  <Inline text={t} />
                </li>
              ))}
            </List>
          );
        }
        if (b.type === "code")
          return (
            <pre
              key={i}
              className="max-w-full overflow-x-auto rounded-[12px] bg-page p-4 text-[14px]"
            >
              <code>{b.text}</code>
            </pre>
          );
        if (b.type === "quote")
          return (
            <blockquote
              key={i}
              className="rounded-[12px] bg-page p-5 italic text-ink2"
            >
              <Inline text={b.text} />
            </blockquote>
          );
        if (b.type === "callout")
          return (
            <aside key={i} className="rounded-[12px] bg-brand-50 p-4 text-ink2">
              <Inline text={b.text} />
            </aside>
          );
        if (b.type === "rich")
          return (
            <p
              key={i}
              className="whitespace-pre-wrap break-words"
              style={{
                fontSize: b.fontSize,
                color: b.color,
                background: b.background,
                textAlign: b.align,
              }}
            >
              <Inline text={b.text} />
            </p>
          );
        return (
          <p key={i} className="whitespace-pre-wrap break-words text-ink2">
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
