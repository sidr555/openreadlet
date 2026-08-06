# openreadlet

An open protocol for distributing **readlets** — short texts for a single reading
session — through public storage, and its reference reader.

- [The Lib protocol, version 1](doc/protocol.md)
- [The reference adapter](doc/adapter.md)
- [Example documents](examples/)

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

## @openreadlet/lib

```bash
npm install @openreadlet/lib
```

```ts
import { openLib, pickBundles, needsBundle } from '@openreadlet/lib'

const lib = openLib('https://s3.example.com/birds')

const about = await lib.about()
const feed = await lib.feed()

// the application's own record of what it already has, keyed by bundle id — the package holds no state
const stored = new Map<string, string>()

for (const entry of pickBundles(feed, { age: 6, tags: ['songs'] })) {
  if (!needsBundle(entry, stored.get(entry.id))) continue

  const bundle = await lib.bundle(entry.id)

  for (const readlet of bundle.readlets) {
    if (readlet.text) console.log(await lib.text(readlet.id))
  }
}
```

The package fetches, validates and selects. Storage, scheduling, subscription state
and rendering stay with the application; the readlet text is returned as a raw
string, and sanitising it belongs where it is rendered.

Reading a lib that is not public:

```ts
openLib('https://libs.example.com/private', {
  auth: { type: 'basic', user: 'reader', password: '…' },
})
```

Requirements for whoever publishes a lib, and ready-made storage configuration,
are in [doc/protocol.md](doc/protocol.md).

## License

Apache 2.0, code and specification alike. Full text in [LICENSE](LICENSE), copyright in
[NOTICE](NOTICE).

You may implement the protocol freely and without asking. The licence grants no trademark
rights: your implementation goes by your own name.
