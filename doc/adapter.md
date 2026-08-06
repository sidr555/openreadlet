# The reference adapter

`@openreadlet/lib` is the package that knows how to talk to a lib: build an address, fetch
a document, validate it against a schema and return a typed result. It does nothing else,
and that is the main thing to know about it.

**The package is not published yet.** This document records the boundary agreed on before
the work started, so that it does not drift afterwards.

## Why a separate package

Reading a lib has at least two consumers: the reader itself, and the parent's dashboard,
where an adult browses a showcase before handing a QR code to a child. If manifest parsing
lives inside the reader, the dashboard either duplicates it or starts fetching content
through a backend — and both roads end with two understandings of one format.

A separate package also makes the specification testable: a gap between the prose and the
code becomes a failing test instead of a discussion.

## In scope

**Address resolution.** Build the path to any document from a lib's base address. This is
also where the identifier is checked against the character set from the specification —
before it is substituted into a path, not after. That is not a convenience but a security
boundary, and a boundary belongs in exactly one place.

**Fetching.** An HTTP request with a timeout and an `AbortSignal`, a cap on response size,
refusal to follow a redirect to another origin, refusal to speak `http`.

**Validation.** Schema-checked parsing of the five documents with a legible rejection:
which document, which field, what is wrong. Casting through `as` is not allowed — this
data comes from strangers.

**Types.** The shapes of `About`, `Feed`, `Bundle`, `Test`, `Libs` and the readlet entry,
derived from those same schemas so that the type and the check cannot drift apart.

**Version matching.** The major and minor rules from the specification, once, here.

**Selection.** Pure functions with no I/O: does a bundle match by age, does it match the
selected tags, what needs re-downloading according to `updated`. The filtering rules are
part of the specification, so they belong in shared code — otherwise two implementations
will disagree about an empty `age` and drift apart silently.

## Out of scope

**Storage.** No IndexedDB, no files, no cache. An adapter that drags browser storage along
instantly stops being usable from the dashboard and from tests under Node.

**Scheduling.** When to re-read the feed is the application's decision. The adapter holds
no timers and does not remember when it was last called.

**Subscription state.** The list of libs a reader is subscribed to is application data.

**User interface.** No components, no markup, no Markdown sanitising: sanitising happens
where the text is rendered and depends on what renders it.

**Network policy.** Retries, queues, offline behaviour — all the application's. The adapter
tried once and reports honestly what happened.

## The shape of errors

A failure is an exception carrying a stable `kebab-case` code, not human-facing prose: the
prose is written by the application, in its own language and tone. The codes fall into
three groups — did not arrive (`network-failed`, `timeout`, `insecure-origin`), arrived but
wrong (`not-found`, `too-large`, `bad-json`), parsed and refused (`schema-mismatch`,
`unsupported-version`, `bad-id`, `duplicate-id`).

## How this gets verified

Tests run against the fixed documents in [../examples](../examples) — the same ones
attached to the specification — and against a set of deliberately broken ones: a duplicate
identifier, an identifier containing `../`, a foreign major version, an unknown field,
truncated JSON. The network is stubbed at the boundary; parsing and selection are not
mocked at all.
