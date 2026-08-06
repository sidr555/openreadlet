# The Lib protocol, version 1

This document specifies the format that describes a collection of readlets stored in
a public S3-compatible bucket. The document and the code in this repository are licensed
under the Apache License 2.0; anyone may implement the protocol without asking permission.

"Must", "must not", "should" and "may" carry their usual meaning for specifications:
"must" is a requirement whose violation makes a lib or a reader non-conforming, "should"
is a strong recommendation, "may" is a permission.

## Model

A **readlet** is a short text meant for a single reading session. It has an identifier,
a title and up to three kinds of content: text, a cover image and a quiz.

A **lib** is a collection of readlets stored under a common base address. A lib has no
server and no database: it is a folder of files. Everything needed to work with a lib is
its base address.

A **subscription** is the base address of a lib stored on the reader's device, and nothing
more. Unsubscribing means deleting that address and everything downloaded through it. The
publisher does not learn about subscribers: the protocol is one-way and has no back channel.

A **bundle** is a named group of readlets inside a lib. Bundles exist so that a reader can
decide whether to download a group **without downloading it**: age and tags are declared
in the feed, next to the link to the bundle.

## Layout

The base address of a lib, `{base}`, is an `https://` address with no trailing slash, for
example `https://s3.example.com/mylib`. Relative to it:

```
{base}/about.json           showcase
{base}/feed.json            feed
{base}/bundles/{id}.json    bundle
{base}/text/{id}.md         readlet text
{base}/pic/{id}.webp        readlet cover
{base}/test/{id}.json       readlet quiz
```

The protocol defines no other files and does not forbid them. Bucket listing is neither
required nor used: everything a reader needs to open is named in a manifest.

The lib catalogue (`libs.json`) is not part of this layout — it lives at an arbitrary
address and is described in its own section below.

## General rules

**Version.** Every JSON document must carry a `ver` field, a string of the form
`"MAJOR.MINOR"`, for example `"1.0"`. Parsing rules are in "Compatibility".

**Identifiers.** The `id` of a readlet or a bundle is a string of 1 to 64 characters drawn
from `A-Z a-z 0-9 _ -`. This restriction is not cosmetic: the identifier is substituted
into a URL path, and a reader **must** reject a document carrying an identifier outside
that set rather than try to escape it. This is the only thing standing between a reader
and a lib that redirects it to a foreign address through `../` or a backslash.

An identifier is unique within a lib. Two entries sharing an `id` in the same document are
an error; a reader must reject such a document as a whole rather than keep whichever came
first.

**Dates.** ISO 8601 in UTC: `2026-06-17T01:45:02Z`.

**Collections are arrays.** Lists of readlets, bundles, tags and libs are written as arrays
of objects carrying an `id` or a `url`, not as "key → object" maps. Order is meaningful —
the publisher sets it and readers follow it when displaying. Object key order is not
guaranteed by the standard, and a duplicate key is lost silently.

**Unknown fields are ignored.** This is what makes minor versions useful.

**Size.** A reader should cap the size of every document it downloads and reject anything
larger: the lib belongs to someone else, and there is nothing else standing between the
reader and an endless file. Reasonable caps are 5 MB for manifests and 1 MB for readlet
text.

## about.json — the showcase

The lib's passport plus a selection of readlets a person uses to decide whether to
subscribe. This is a **showcase, not a catalogue**: the selection may hold any number of
readlets but is not required to hold them all. The full contents of a lib are described
by its bundles.

```json
{
  "ver": "1.0",
  "title": "Backyard Birds",
  "about": "Short field notes for early readers, written by a nine-year-old",
  "author": "Anna Fields",
  "contact": "anna@example.com",
  "age": [5, 7],
  "tags": [
    { "id": "watching", "title": "Watching" },
    { "id": "songs", "title": "Bird songs" }
  ],
  "readlets": [
    {
      "id": "dawn-song",
      "title": "Who sings before sunrise",
      "date": "2026-06-17T01:45:02Z",
      "tags": ["songs"],
      "text": true,
      "pic": true,
      "test": true
    }
  ],
  "refs": [
    { "title": "Night Sky", "url": "https://s3.example.com/nightsky" }
  ]
}
```

| Field | Req. | Meaning |
|---|---|---|
| `ver` | yes | protocol version |
| `title` | yes | lib name, up to 120 characters |
| `about` | no | one or two sentences, up to 500 characters |
| `author` | no | publisher name for display |
| `contact` | no | address for getting in touch |
| `age` | no | age range of the lib as a whole, see "Age" |
| `tags` | no | the lib's tag dictionary: `id` and a human-readable `title` |
| `readlets` | no | preview selection, see below |
| `refs` | no | links to neighbouring libs: `title` and `url` |

`refs` is the decentralised way to discover libs: one points at another and a reader may
offer to follow. The protocol introduces no registry that is required to know about
everyone.

### The readlet entry

Identical in `about.json` and in a bundle.

| Field | Req. | Meaning |
|---|---|---|
| `id` | yes | identifier |
| `title` | yes | title for listings, up to 200 characters |
| `date` | yes | when the readlet was created |
| `updated` | no | when its content last changed |
| `tags` | no | array of tag `id`s declared in `about.json` |
| `text` | no | whether `{base}/text/{id}.md` exists, defaults to `false` |
| `pic` | no | whether `{base}/pic/{id}.webp` exists, defaults to `false` |
| `test` | no | whether `{base}/test/{id}.json` exists, defaults to `false` |

A readlet without `text` is pointless but formally allowed; a reader simply will not list
it on the shelf. A tag absent from `about.json` should be ignored for display but must not
cause the whole document to be rejected — the showcase and the bundles are updated
independently and may disagree for a while.

## feed.json — the feed

The list of bundles. This is the document a reader re-reads on a schedule, so it must stay
small: it carries neither readlet titles nor descriptions.

```json
{
  "ver": "1.0",
  "bundles": [
    { "id": "spring-2026", "updated": "2026-06-17T01:45:02Z", "age": [3, 7], "tags": ["songs"] },
    { "id": "archive", "updated": "2026-02-01T09:00:00Z", "age": [12] },
    { "id": "misc", "updated": "2026-01-05T12:30:00Z" }
  ]
}
```

The document's required fields are `ver` and `bundles`. `bundles` is an array of entries:

| Field | Req. | Meaning |
|---|---|---|
| `id` | yes | bundle identifier, also its file name under `bundles/` |
| `updated` | yes | when the bundle's contents or membership last changed |
| `age` | no | age range of the bundle, see "Age" |
| `tags` | no | tags of the bundle as a whole |

The feed **always** lists bundles, even when a lib holds three readlets; then there is one
bundle. A second mode in which the feed carries readlets directly is deliberately absent:
it would cost every implementation two parsing paths forever in exchange for one saved
request on a small lib.

## bundles/{id}.json — a bundle

```json
{
  "ver": "1.0",
  "readlets": [
    {
      "id": "dawn-song",
      "title": "Who sings before sunrise",
      "date": "2026-06-17T01:45:02Z",
      "updated": "2026-06-20T08:10:00Z",
      "tags": ["songs"],
      "text": true,
      "pic": true,
      "test": true
    }
  ]
}
```

The document's required fields are `ver` and `readlets`. The readlet entry is the same as
in the showcase. One readlet may belong to several bundles; a reader stores it once.

## text/{id}.md — the text

Markdown in UTF-8. The first level-one heading is the readlet's title; when present it
takes precedence over `title` from the manifest.

A `<!-- q:ID -->` marker standing between paragraphs asks for the question with that `id`
to be shown **at that point in the text** rather than at the end. A question whose `id` is
not mentioned in the text is shown in the common block after the text. A reader that does
not support inline questions must ignore the marker as an ordinary Markdown comment —
nothing is lost, the question appears in the common block.

The file carries no protocol version: there is nowhere to put one without corrupting the
text. The version of the bundle that declares the readlet applies.

Images inside the text are not defined in version 1.

## pic/{id}.webp — the cover

One cover per readlet, always WebP, always at this path. The format is fixed rather than
declared in the manifest so that a reader never has to guess an extension and a publisher
never has to explain why half the covers fail to open on someone else's device.

The presence of the file is declared by the `pic` field of the readlet entry. A reader must
keep working when the file fails to load: a cover is decoration, not content.

## test/{id}.json — the quiz

```json
{
  "ver": "1.0",
  "timer": "3m",
  "questions": [
    {
      "id": "q1",
      "type": "true-false",
      "question": "Does the thrush start singing before sunrise?",
      "hint": "Look at the second paragraph",
      "points": 1,
      "answer": true
    }
  ]
}
```

The document's required fields are `ver`, `timer` and `questions`.

`timer` is a duration string, `"3m"` or `"90s"`. It bounds the reading session, not the
quiz. `questions` is an array; its order is meaningful.

Fields common to every question: `id` (a string unique within the quiz), `type`, `question`,
and the optional `hint` and `points`.

| `type` | Extra fields | Correct answer |
|---|---|---|
| `true-false` | — | `answer`: boolean |
| `choice` | `items`: array of strings | `answer`: index into `items` |
| `multi-choice` | `items`: array of strings | `answer`: array of indices |
| `order` | `items`: array of strings | `answer`: indices in the correct order |
| `blocks` | `items`: array of strings | `answer`: indices in the correct order |
| `spot` | `text`: string | `answer`: indices of the sought words in `text` |
| `fill` | — | `answer`: string |
| `pairs` | `pairs`: array of `[left, right]` | derived from the pairs themselves |

The order of `items` is the order they are displayed in, not the correct one: for `order`
and `blocks` the correct order is given by `answer`.

Free-text answers (`text`) and code answers (`code`) are **not** part of version 1. The
reason is not that there is no way to display them, but that the protocol has no meaningful
automatic check to offer for a free-form answer: comparing it to a reference string is
wrong more often than it is right. They will arrive together with a sensible way to grade
them, which is an addition and therefore a minor version.

The quiz is part of the protocol but not an obligation for a reader. A reader may choose
not to show quizzes at all; it then simply never requests these files.

## libs.json — the lib catalogue

A list of libs by address. A catalogue is not part of a lib's layout and lives anywhere;
a reader may know one default catalogue and let people add others.

```json
{
  "ver": "1.0",
  "title": "Example catalogue",
  "libs": [
    {
      "title": "Backyard Birds",
      "about": "Short field notes for early readers, written by a nine-year-old",
      "age": [5, 7],
      "url": "https://s3.example.com/birds"
    }
  ]
}
```

The document's required fields are `ver` and `libs`; the catalogue's own `title` is
optional.

The lib entry requires `title` and `url` and allows `about` and `age`. Catalogue data is
a hint for rendering a list; the truth about a lib remains its own `about.json`, which
a reader reads once the person goes there.

A catalogue grants no rights and vouches for nobody. Appearing in someone's catalogue is
neither an endorsement nor a review.

## Age

`age` is an array of integers between 0 and 120:

| Value | Meaning |
|---|---|
| absent, `null` or `[]` | no restriction, same as `[0]` |
| `[7]` | 7 and older |
| `[5, 7]` | from 5 to 7 inclusive |

More than two numbers is a format error. A second number smaller than the first is too.

A reader matches the reader's age against the **bundle's** `age` and does not download what
does not fit. The `age` on the lib in `about.json` and in a catalogue is for showing to
a person; it is not a filter, because a lib labelled "5 to 7" may perfectly well carry
a bundle for those who have turned nine.

Where a reader gets the reader's age is outside this protocol.

## Tags

A tag is an identifier drawn from the same character set as an `id`. Human-readable tag
names are declared in `about.json`; an undeclared tag is allowed, and a reader should
display it as-is.

Tags appear on readlets and on bundles, and these are different things. A bundle's tag is
what a reader uses to choose what to download: it is visible in the feed before anything
is fetched. A readlet's tag is what already-downloaded content is sorted by.

A subscription may carry a list of selected tags. A reader then takes from the feed only
those bundles that carry at least one of them — and a bundle with no tags at all counts as
matching always, otherwise selecting a tag would silently cut the reader off from every
untagged item.

## Updating

A reader re-reads `feed.json` no more often than its own schedule allows: the protocol
dictates no period but requires that one exist — the feed is not fetched every time the
application opens.

A bundle is re-downloaded when its `updated` in the feed is newer than the stored one.
A readlet's content (`text`, `pic`, `test`) is re-downloaded when the readlet's own
`updated` is newer; with no `updated`, the bundle's `updated` is used.

A readlet that has disappeared from every bundle should be treated as deleted.

## Subscribing and passing a lib along

A subscription is described by two values: the lib's base address and, optionally, a list
of selected tags. Passing a subscription between devices means passing that pair.

How exactly to encode it is not prescribed here, because prescribing it would force every
reader to register the same link handler and fight over it. The reference Readlet reader
uses:

```
readlet://sub?u=<base, urlencoded>&t=<tag,tag>
```

Another implementation may use its own scheme; the payload is what stays common.

Such a link has a known limitation worth knowing up front: for anyone without the
application installed, a QR code carrying a custom scheme opens nothing at all — the stock
camera reports an error. A reader distributed over the web should also accept a plain
`https` address on its own origin as a fallback.

## Bucket requirements

A publisher must provide:

- **`https`.** A reader should reject `http` addresses: children read this content, and
  substituting the text in transit must be ruled out.
- **Public read access** to every file named in a manifest.
- **CORS.** Responses must carry `Access-Control-Allow-Origin` set to `*` or to a list
  including the reader's origin. Without it a browser-based reader cannot read the lib
  **at all** — the request never reaches parsing. This is the single most common reason
  a correctly built lib does not work.
- **A single origin.** Every file of a lib lives under one `{base}`. A redirect to another
  origin is a reason to abandon the download, not to follow it.

Bucket listing is neither required nor recommended.

## Reader requirements

- **Lib content is untrusted.** Markdown must be sanitised before rendering: raw HTML and
  `javascript:` links must not reach the document. The lib belongs to someone else, and
  the reader knows nothing about who wrote its text.
- **Identifiers are validated before they enter a path**, see "General rules".
- **One failed document does not take down the rest.** A corrupt quiz still leaves the
  readlet readable; a corrupt bundle leaves the other bundles working.
- **Offline.** What has been downloaded must stay readable without a network. Downloading
  fills local storage; it is not how a text is opened.
- **Unsubscribing deletes content.** Dropping the address and keeping the files is not
  unsubscribing.

## Compatibility

The version is `"MAJOR.MINOR"`, both parts integers.

- The major version **differs** from the supported one — the reader must reject the
  document.
- The minor version is **higher** than supported — the reader must read the document,
  ignoring fields it does not know.
- The minor version is lower or equal — ordinary parsing.

The version is checked per document. They live in separate files and are updated
independently, and a bundle downloaded six months ago may well be older than the feed
that points at it.

Without a major bump you may: add optional fields, add question types, add values to
enumerations while marking old ones deprecated. You may not: make an optional field
required, change the meaning or type of an existing field, change the path layout.

## Not in version 1

Listed so that it is not reported as an oversight:

- **Signatures and integrity checks.** Trusting a lib means trusting its address and TLS.
- **Private libs.** All content is public; restricted distribution is a different
  protocol's problem.
- **A back channel.** A publisher learns neither the number of subscribers nor what was
  read.
- **Feed pagination.** A feed that grows unwieldy is a reason to split readlets across
  bundles.
- **Images inside the text**, and multiple images per readlet.
- **Localisation.** One lib is one language; a translation is published as its own lib.
