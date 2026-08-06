# Example documents

Valid protocol version 1 documents. All five describe the same fictional lib, "Backyard
Birds", so they can be read one after another: identifiers and tags line up across them.

| File | What it corresponds to in a bucket |
|------|------------------------------------|
| `about.json` | `{base}/about.json` |
| `feed.json` | `{base}/feed.json` |
| `bundle.json` | `{base}/bundles/spring-2026.json` |
| `test.json` | `{base}/test/dawn-song.json` |
| `libs.json` | a lib catalogue, living outside the lib at an arbitrary address |

`bundle.json` and `test.json` are named after the kind of document, not the path: in a real
lib these files are named after the bundle and the readlet identifier.

`about.json` lists three readlets while `bundle.json` lists two. That is not an
inconsistency but the very case the showcase is separated from the catalogue for: the third
readlet lives in the `watching-basics` bundle.

Full field descriptions are in [../doc/protocol.md](../doc/protocol.md).
