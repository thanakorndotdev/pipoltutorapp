#!/usr/bin/env sh
# Assemble deploy.html from the shared manual stylesheet + body.html, then render the PDF.
set -eu
cd "$(dirname "$0")"
{
  sed -n '1,/<\/style>/p' ../manual/manual.html \
    | sed 's|<title>.*</title>|<title>คู่มือ Deploy PIPOL TUTOR</title>|' \
    | sed 's|</style>|  pre { font-family: ui-monospace, Menlo, monospace; font-size: 8.4pt; line-height: 1.55; background: #141b34; color: #e8ebf5; border-radius: 2.5mm; padding: 3mm 4mm; margin: 1.5mm 0 3mm; white-space: pre-wrap; word-break: break-all; break-inside: avoid; }\n  pre.one { white-space: pre; word-break: normal; font-size: 7.6pt; }\n  li pre { margin-top: 1.5mm; }\n  .note code, td code { word-break: break-all; }\n  .cover h1 { font-size: 26pt; }\n</style>|'
  echo '</head><body>'
  cat body.html
  echo '</body></html>'
} > deploy.html
node render.mjs "$@"
