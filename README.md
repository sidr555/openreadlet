# openreadlet

An open protocol for distributing small units of reading content — **readlets** — from
ordinary public S3 buckets, plus a reference adapter for reading them.

A readlet is a short text meant for a single reading session: an article, a story, a note.
A collection of readlets is called a **lib**. A lib is a folder in a bucket holding
manifests in a known format. Nothing more: no database, no server, no registration. Anyone
can publish a lib and share a link or a QR code for it, and any reader that understands the
protocol will subscribe and keep receiving updates.

The point is that content and its updates live with the publisher rather than inside
somebody's service. An application distributes only itself and knows how to read other
people's libs.

## How a lib is built

```
{base}/about.json           showcase: the lib's passport and a preview selection
{base}/feed.json            feed: bundles with update dates, age ranges and tags
{base}/bundles/{id}.json    bundle: a list of readlets
{base}/text/{id}.md         readlet text
{base}/pic/{id}.webp        cover
{base}/test/{id}.json       quiz about what was read
```

A reader remembers `{base}` — that is the whole of a subscription. From there it fetches
the feed on its own, picks the bundles that match the reader's age and chosen tags, and
pulls the readlets out of them.

The full description is in [doc/protocol.md](doc/protocol.md). Valid examples of every
document are in [examples/](examples/).

## Status

The version 1 specification is written. The reference adapter `@openreadlet/lib` is **not
published yet** — it is being worked on; see [doc/adapter.md](doc/adapter.md) for what
falls inside its boundaries and what stays with the application.

## Licence

Apache License 2.0, covering both the code and the text of the specification. Full text in
[LICENSE](LICENSE), copyright in [NOTICE](NOTICE).

You may implement the protocol freely and without asking. The licence grants no trademark
rights: your implementation goes by your own name.
