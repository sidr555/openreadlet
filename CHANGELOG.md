# Changelog

## 2026-08-27 — 0.3.0

- A lib is now read through a **source**, not a hardcoded fetch of `{base}/…`. A source
  decides which URL to call for a path and which landing address a redirect there may end
  at; the size cap, timeout, abort forwarding, CORS diagnosis, address masking and error
  mapping stay in one shared, hardened `httpGet` and are never re-implemented per source.
- A subscription address may now carry a lowercase prefix naming which source reads it,
  `prefix+https://…`. The plain `https://…` form keeps working exactly as before and
  resolves to the same static source version 1 always used.
- New: the `yadisk` source reads a lib published as the contents of a public Yandex.Disk
  folder, resolving a path through the public API and reading the download address it
  answers with. A resolved address is never reused across calls: it is pinned to a
  version of the file, and reusing a stale one would answer 200 with stale content.
- **Breaking:** `Lib.picUrl(id)` is replaced by `Lib.directUrl(path)`. A source that has no
  stable address to hand back — `yadisk`, resolved through an API rather than addressed
  directly — returns `null` instead of throwing, so a caller must check for that rather
  than assume every source can offer one.
- **Breaking:** the standalone `picUrl(base, id)` is no longer exported from the package.
  Building a cover address without an open `Lib` no longer has a top-level shortcut; open
  a `Lib` and call `directUrl` on it.
- New subpath exports, `@openreadlet/lib/sources/static` and `@openreadlet/lib/sources/yadisk`,
  so a consumer can import a source directly and hand it to `openLib` without going through
  a subscription string. `openLib` itself still resolves any supported address from the main
  entry point, so importing it there carries both sources regardless of which one is used.
- Two long-standing defects, fixed while sources were split out of the one fetch path they
  used to share:
  - `new URL(landed)`, judging where a redirect landed, ran with no `try` around it. A
    stand-in `fetch` or an exotic response could make it throw a bare `TypeError` past
    `LibError`'s contract, reaching a caller that only catches the latter.
  - Whether a redirect was allowed was a single hardcoded origin comparison inside the
    fetch path itself. It is now a policy the source supplies — `allowsLanding` — so a
    source that legitimately lands somewhere the base address never names, such as
    `yadisk`'s short-lived download host, expresses that as its own rule instead of
    widening the shared check for everyone.

## 2026-08-23 — 0.2.0

- A refused request is no longer one code. `storage-unavailable` is new, and separates a
  storage account that is serving nothing — suspended, disabled, unpaid — from `forbidden`,
  a document the publisher closed. Both arrive as a bare 403; the `<Error>` document in the
  body tells them apart. A reader that showed «the publisher closed this library» when the
  hosting provider had suspended the account was accusing the publisher of something they
  had not done, and was backing off for a day from an outage that lasts minutes.
- At most 8 KiB of a refusal's body is read, and only its `<Code>` is looked at. A body
  that is missing, oversized, unreadable, or not that document leaves the code at
  `forbidden`, so a storage that does not speak the S3 error dialect behaves as before.
- The `LibErrorCode` union gained a member, which breaks exhaustive `switch` statements
  over it — hence a minor, not a patch.

## 2026-08-19 — tooling, no release

- ESLint and Prettier hold the style that used to live in reviewers' heads. A contributor
  now has a command that puts a patch into the accepted style rather than a neighbouring
  file to imitate: `npm run format`, `npm run lint`.
- TypeScript 6 is installed beside TypeScript 7 under the alias the TypeScript team
  documents for this: the native compiler no longer ships the JS API that typescript-eslint
  reads, and without it the plugin refuses to load at all. `tsc` is still the native 7.
- Typed lint rules found two places where a stand-in `fetch` stringified its input: the
  type admits a `Request`, and `String()` on one yields `[object Object]`. The address now
  comes from `Request.url`.
- `checks.yml` runs the linter and the formatter, and no longer runs twice for a single
  commit to a branch with an open pull request.
- Development dependencies are up to date: ESLint 10, globals 17, Vitest 4.1.11. That last
  one carries a Vite that no longer pulls the vulnerable `nanoid`, so `npm audit` is clean.

## 2026-08-07 — 0.1.1

- An address is rendered into an error only when it parses with a host and a scheme
  from an explicit set; anything else — `blob:`, `file:`, an opaque or scheme-relative
  address — leaves the address out rather than risking the credentials it may carry.
- The safe address of a fetched document strips userinfo and masks every query
  parameter value, so a presigned address no longer carries its signature into every
  error it raises. Parameter names are kept: they cost nothing and an error has to
  stay diagnosable.
- `assertHttps` takes the field it was called for, so a refused entry in a long
  catalogue names itself.
- `redactUrl` falls back to the closed form for an address it cannot parse or one
  whose userinfo it cannot strip.

A secret placed in a URL fragment is passed through unmasked. That is deliberate:
a fragment cannot come from an address this package builds.

## 2026-08-06 — 0.1.0

- First release of `@openreadlet/lib`: address resolution, fetching with a timeout,
  a size cap, an origin check and optional basic, bearer or query authentication.
- Validation of the five protocol documents with no runtime dependencies.
- Pure selection rules: age, tags, what to re-download, what disappeared.
