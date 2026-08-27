# openreadlet documentation

Added a file to `doc/`? Add it here too.

## Protocol

- [protocol.md](protocol.md) — the Lib specification, version 1: bucket layout, the five
  documents, age and tags, updating, subscribing and QR, bucket and reader requirements,
  compatibility rules
- [../examples/](../examples/) — valid examples of all five documents, one lib throughout

## Implementation

- [adapter.md](adapter.md) — the boundaries of the reference adapter `@openreadlet/lib`:
  what it does, what it does not, the shape of errors

## Designs

- [specs/2026-08-27-sources-design.md](specs/2026-08-27-sources-design.md) — reading a lib
  from storage that is not a static host: the source abstraction, the prefixed address form
  and the Yandex.Disk source, with the CORS probe the design rests on

- [plans/2026-08-27-sources.md](plans/2026-08-27-sources.md) — the implementation plan for
  that design, task by task

## Everything else

| File | What is in it |
|------|---------------|
| `README.md` | what openreadlet is, how a lib is built, current status |
| `CHANGELOG.md` | dated record of what shipped, per release |
| `LICENSE` | Apache License 2.0, verbatim |
| `NOTICE` | copyright, as clause 4 of the licence requires |
