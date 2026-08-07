# Changelog

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
