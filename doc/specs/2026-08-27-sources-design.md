# Sources: reading a lib from storage that is not a static host

Design, 2026-08-27. Covers **reading** only; publishing is a separate design that depends
on this one.

## The problem

A lib is a folder of files, and version 1 of the protocol says that folder is reached at an
`https` base address by joining a relative path to it. `paths.ts` joins the string and
`fetch.ts` gets it. Addressing and transport are fused by concatenation.

That fusion is fine for a static host and excludes everyone else. The publisher this design
is for does not have a static host: they have a consumer cloud drive, and a public folder in
it has no `{base}/text/{id}.md` address at all. Nothing is wrong with the documents such a
publisher would write — the layout, the manifests and the validation rules all apply
unchanged. Only the step from "which document" to "which HTTP request" differs.

## Scope

**In:** a source abstraction in `@openreadlet/lib`, a static source that behaves exactly as
today, a source for a public Yandex.Disk folder, the address form that names a source, and
the changes both imply for the reader.

**Out, deliberately:** private buckets with credentials, local sources (a device folder, a
zip, device-to-device transfer), and publishing. Each is recorded in the workspace backlog
with the reasoning that was already done, so none of it is re-derived later.

## What was measured

A probe ran on 2026-08-27 against a real public folder, with `Origin: https://my.readlet.ru`
on every request. It is the evidence this design rests on, and it is worth reading before
disagreeing with anything below.

| Step | Result |
|---|---|
| `GET /v1/disk/public/resources?public_key=…` | 200, `Access-Control-Allow-Origin` echoing the origin |
| `GET /v1/disk/public/resources/download?public_key=…&path=/A.txt` | 200, href on `downloader.disk.yandex.ru` |
| `GET` that href | 302 with `ACAO: *` to `s151nrg.storage.yandex.net` |
| `GET` the landing address | 200 with `ACAO: *`, body readable |
| `path=/text/nope.md` (nested, absent) | 404 `DiskNotFoundError` |
| bad `public_key` | 404 `NotFoundError` |
| whole folder as a zip | `zipper-external.disk.yandex.net`, **no** `access-control-*` at all |
| an href resolved 30 minutes earlier, after the file had been replaced | **200 with the previous content** |

Three things follow immediately. Nested paths resolve, so the protocol's layout maps onto a
public folder without change. The zip endpoint is unusable from a browser and is not needed,
because documents are fetched one at a time. And an href is pinned to a *version* of a file,
not to a path — the last row is the single most consequential measurement here.

Two facts about the href deserve stating: it carries no declared lifetime — no `expires-at`
parameter and no header, only a hex segment inside the path that looks like a timestamp —
and it arrived carrying `is_direct_zip_experiment=1`. The provider runs experiments on this
exact path and publishes no CORS guarantee. One probe is an observation, not a contract.

## The address

The canonical form of a subscription names its source with a prefix:

```
https://s3.example.com/mylib                      static host, unchanged
yadisk+https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ    public Yandex.Disk folder
```

A subscription must remain **one string**. The same string travels in a QR payload
(`readlet://sub?u=…`), is typed by hand, keys the reader's local store and is what
deduplicates two spellings of one lib. A structured pair of fields breaks all four at once.

**The prefix is parsed by string, never by `URL`.** `paths.ts` keeps an allowlist of schemes
with a comment explaining why: an opaque scheme leaves the whole inner address, userinfo
included, in `pathname`, where an origin check sails past it. `yadisk+https://…` is exactly
such a scheme. So: split at the first `+`, hand the remainder to the same `assertHttps` as
today. The allowlist is untouched, and the inner address passes the checks it always did.

**Entry and storage are different things.** A publisher copies `https://disk.yandex.ru/d/…`
out of the Disk interface and must not have to edit it. The reader recognises a known link
when a subscription is added, canonicalises it, and shows what it arrived at. The
specification states only the deterministic rule — a prefix names a source; no prefix plus
`https` is the static source — because a second implementation cannot be asked to guess the
same set of hostnames.

**Canonicalisation for Disk:** `yadi.sk` becomes `disk.yandex.ru`, the query string and a
trailing slash are dropped. The API's own `public_key` would identify a folder more exactly,
but obtaining it costs a network request, and a key in local storage may not depend on the
network in an offline-first reader.

**No migration.** Existing subscriptions are bare `https://…`, which is the canonical form of
the static source already.

## The Source interface

```ts
export interface SourcePayload {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
  /** Address with secrets already masked; this is what reaches LibError.url. */
  safeUrl: string
}

export interface Source {
  /** The canonical subscription string, prefix included. The lib's identity. */
  readonly base: string
  /** One document by its path inside the lib: `text/dawn-song.md`. */
  get(path: string, limit: number, options: RequestOptions): Promise<SourcePayload>
  /** A stable address for `<img src>`, or null when the source has none. */
  directUrl(path: string): string | null
  /** Which landing address a redirect may end at. Passed to the shared `httpGet`. */
  allowsLanding(target: URL, landed: URL): boolean
}
```

Everything above this line — `parseAbout`, `pickBundles`, `staleReadlets`, version matching —
is unchanged.

**A source decides where to go and what landing to accept. How to go is shared code.** The
size cap that aborts a read mid-stream, the timeout, the forwarded `AbortSignal`, the
`no-cors` probe that tells a blocked read from a dead network, address masking, the reading
of an S3 `<Error>` document, and the whole map of failure codes stay in one hardened
`httpGet`. A source that re-implemented any of them would be a hole opened by inattention.
Every source here is HTTP underneath, so almost all of it is shared.

**`assertId` does not move.** It stays in path building, before a source sees anything.
`adapter.md` calls it a security boundary that belongs in exactly one place; splitting
transport out must not multiply it.

**Redirects are declared by the source:** `allowsLanding(target: URL, landed: URL): boolean`.
The static source requires the same origin, as today. The Disk source accepts a landing on
`/^s\d+[a-z0-9]*\.storage\.yandex\.net$/` over https.

A limitation to write down rather than discover: **intermediate hops are invisible**. With
`redirect: 'follow'` only `response.url` can be inspected, and `redirect: 'manual'` yields an
opaque response in a browser, so `Location` cannot be read. The landing address is checked,
not the route. This is what the code does today; it is neither weakened nor improved here.

**Two things break on the public surface, for one reason.** A Disk document has no stable
address: it is resolved over the network and pinned to a version. So `Lib.picUrl(id)` becomes
`directUrl(path): string | null`, and the standalone `picUrl(base, id)` exported from
`paths.ts` is withdrawn — a pure function cannot answer for a source that needs the network,
and leaving it would let a caller build a confidently wrong URL. Covers go through `pic()` to
a `Blob` and a cached object URL instead. In the reader this is a single call site,
`LibCard.tsx:60`, which puts `picUrl(base, id)` straight into `<img src>` — and moving it
incidentally fixes covers not working offline in an offline-first application.

This is `0.3.0`. Breaking changes are allowed within `0.x`, and these two are the whole of
them: `openLib(base, options)` keeps working, and an overload taking a prepared `Source` is
added. `fetchLibs` stays https-only: a catalogue is not part of a lib's
layout, and a link to a lib on any provider is itself an ordinary string, so a catalogue can
always be published statically.

## The Yandex.Disk source

Reading one document takes two requests: resolve
`GET cloud-api.yandex.net/v1/disk/public/resources/download?public_key={base}&path=/{path}`
to an href, then `GET` that href and accept the one redirect.

**An href is never cached. Not across documents, not within a session.** The measurement
above is the reason: a stale href answers 200 with the *previous* content. Caching one would
break the protocol's update rule in the worst available way — the feed says `updated` has
moved, the reader follows a saved href, receives 200 with the old text, and records a
successful update. A visible failure is preferable to silent staleness, and the price is two
requests per document with no amortisation.

**Cost and rate.** A ten-readlet feed with covers and quizzes goes from roughly thirty
requests to roughly sixty, half of them to one host. The API publishes no rate limits and the
probe did not test them; the source issues requests sequentially rather than fanning out, and
the real limit must be measured against the first live publisher.

**`directUrl` returns null.**

## Errors and degradation

Existing codes cover everything; the contract does not grow.

| Condition | Code | Whose fault |
|---|---|---|
| `DiskNotFoundError` | `not-found` | the document is absent from the lib |
| `NotFoundError` (bad `public_key`) | `not-found`, on `about.json` | the subscription is dead |
| 429 | `http-error` with `status: 429` | our request rate |
| resolve or download without `ACAO` | `cors-blocked` | the provider changed behaviour |
| landing outside the allowed pattern | `foreign-origin` | the same |

No new code is introduced on purpose. "The subscription is dead" is distinguished by *which*
document failed, not by a code: `not-found` on `about.json` is unambiguous. A 429 is branched
on through `status`, which `LibError` already carries.

**A new class of failure appears: transport failing for one document.** The text arrives, the
cover does not. The specification already requires that a broken quiz leave a readlet
readable and a broken bundle leave the others working; the same rule now extends to a network
failure. A cover is optional by format, so its absence must not obstruct reading.

**Two audiences share one message.** A child needs to know the shelf is not broken; the adult
who added the subscription is the only one who can fix it. `cors-blocked` and `foreign-origin`
say "the library is unavailable right now" to a child and carry the code and the fact that the
fault lies with the storage to an adult.

**Nothing signed reaches a log.** `buildSafeUrl` already masks the value of every query
parameter; for Disk that is not a formality, because an href carries `hash` and a signature.

**A canary is required.** There is no published CORS guarantee and the probe saw an experiment
flag. Without an external check of this chain, a change on the provider's side is discovered
by a child's complaint.

## Testing

**Mock at `fetch` and nowhere deeper.** The Disk source is exercised by injecting
`options.fetch` returning recorded responses. Mocking `Source` while testing `openLib` would
be mocking the thing under test.

**The trap here is specific.** A synthetic `Response` leaves `url` at `''`, and the redirect
check then compares the target with itself, so a naively written test for `foreign-origin` or
`allowsLanding` passes while verifying nothing. Landing addresses must be set explicitly in
fixtures. This is the first test to write and the first to confirm fails before the
implementation exists.

**Fixtures come from the probe**, including the stale-href response, so the most surprising
behaviour is pinned by a real observation rather than an assumption.

**No test in the gate talks to the live provider.** It would go red on an experiment, a rate
limit or a flaky network and teach the team to ignore red. Live verification belongs to the
canary in production and to one-off scripts run by hand.

Covered in the package: prefix parsing and its refusals, including credentials smuggled into
the prefixed form; canonicalisation, so two spellings of one link give one subscription;
`assertId` firing before any source; the size cap on both legs; **the timeout covering both
legs together**, since two steps must not yield twenty seconds where ten were promised; and
`AbortSignal` cutting either leg. In the reader: covers through a blob, a missing cover not
breaking a card, and a `yadisk+…` subscription stored under its canonical string.

Tests precede implementation and must fail for a meaningful reason first. The 70% line and
branch threshold is not lowered by this work.

## What changes in the specification

`protocol.md` currently says the base address is an `https` address. It becomes a **source
address**: the `https` form is required of every implementation, other forms are optional
extensions named by a prefix. The document describes the addressing rule and the source
interface; it does not name commercial providers, whose APIs age faster than the format. A
provider list belongs in an appendix or outside the specification entirely.
