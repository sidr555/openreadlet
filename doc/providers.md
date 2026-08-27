# Where a lib can live

This document answers one question for a publisher: **where do I put my lib so that a reader
in a browser can actually read it?**

It is not part of the specification. `protocol.md` states the requirements a storage must
meet and deliberately names no providers, because a provider's API ages faster than a format.
This file is the practical companion: what has been measured to work, what has been measured
not to, and why.

Everything below was verified with real requests against real public folders, with an
`Origin` header set, on the date given. Where something does not work, the exact point of
failure is recorded so that nobody has to measure it again.

## Works today

### Any static HTTPS host

The protocol's layout is a base address plus a relative path, so any host that serves files
at predictable addresses works with no provider-specific code at all. This is the widest and
by far the least troublesome option:

- **S3-compatible buckets with public read** — AWS S3, Cloudflare R2, Backblaze B2, Wasabi,
  Selectel, Yandex Object Storage, VK Cloud Storage, a self-hosted MinIO.
- **Static site hosting** — GitHub Pages, `raw.githubusercontent.com`, GitLab Pages, Codeberg
  Pages, Netlify, Vercel, Cloudflare Pages.
- **Archives and plain servers** — archive.org item downloads, your own nginx, Caddy, Apache,
  or a NAS with a web server.

The requirements are the four already listed in `protocol.md`: `https`, public read access to
every file named in a manifest, `Access-Control-Allow-Origin`, and a single origin for the
whole lib. The third is the one that trips people up, so configurations follow.

**nginx:**

```nginx
location /mylib/ {
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Max-Age 3600 always;

    if ($request_method = OPTIONS) {
        return 204;
    }
}
```

`always` matters: without it the header is dropped on error responses, and a reader then
cannot tell a missing document from a blocked one.

**Caddy:**

```caddy
example.com {
    root * /srv/libs
    file_server

    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
        Access-Control-Max-Age "3600"
    }

    @options method OPTIONS
    respond @options 204
}
```

**S3-compatible bucket** — the CORS document, applied with your provider's console or CLI:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type", "Last-Modified",
                        "Accept-Ranges", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

A bucket also needs a read policy for the lib's prefix. Grant `GetObject` and **not**
`ListBucket`: listing is neither required nor used by the protocol, and withholding it keeps
the bucket's other contents from being enumerated.

### Yandex.Disk, public folder

A public folder on Yandex.Disk is subscribed to with the `yadisk` prefix:

```
yadisk+https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ
```

Nothing has to be configured on the publisher's side beyond making the folder public. The
files are laid out inside it exactly as the protocol describes — `about.json`, `feed.json`,
`bundles/`, `text/`, `pic/`, `test/`.

Two consequences a publisher should know. Reading one document costs two requests, because
the address of the file is resolved through the public API before it is fetched; a reader
that synchronises a large feed will therefore make roughly twice as many requests as it would
against a static host. And Yandex publishes no CORS guarantee for these endpoints, so support
is empirical: it works, and it is watched.

### WebDAV, and Nextcloud in particular

A WebDAV server needs no source of its own, because **WebDAV adds nothing to a `GET`**. The
protocol never lists a directory, so `PROPFIND` is never issued; a document is fetched from a
path, which is what the static source already does. What matters is only whether the server
exposes files at a joinable address.

A Nextcloud public share does. Verified 2026-08-27 against Nextcloud 34.0.3 in a container:

```
https://host/public.php/dav/files/<share-token>
```

is a base address like any other. `about.json` and a nested `text/probe.md` both answered
`200` anonymously, and a missing document answered `404` with a DAV error document. The other
address a share offers — `/s/<token>/download?path=…&files=…` — answers `303` and is the
browser's download flow; a reader never needs it.

**What does need doing is CORS, and Nextcloud ships with it off.** Nothing in the responses
above carried `Access-Control-Allow-Origin` until the server was configured. For Apache, which
is what the official image runs:

```apache
<LocationMatch "^/public\.php/dav/">
  Header always set Access-Control-Allow-Origin "*"
  Header always set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
  Header always set Access-Control-Max-Age "3600"
</LocationMatch>
```

`always` is not decoration. Without it Apache drops the header on error responses, and a
reader then cannot tell a document that is missing from one it is not allowed to read — the
`404` above arrives headerless and becomes an opaque failure.

**A password-protected share needs two more things**, and one of them is not obvious. The
share is read with HTTP Basic authentication, the token as the username and the share password
as the password, which the reference adapter already supports. But sending an `Authorization`
header makes the request non-simple, so the browser sends a preflight first — and Nextcloud
answers `OPTIONS` on a protected share with `401`. A preflight that does not answer 2xx fails
the check no matter which headers it carries, so the share stays unreadable until `OPTIONS` is
answered before Nextcloud sees it:

```apache
<LocationMatch "^/public\.php/dav/">
  Header always set Access-Control-Allow-Origin "*"
  Header always set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
  Header always set Access-Control-Allow-Headers "Authorization, Range"
  Header always set Access-Control-Max-Age "3600"

  RewriteEngine On
  RewriteCond %{REQUEST_METHOD} OPTIONS
  RewriteRule ^ - [R=204,L]
</LocationMatch>
```

With that in place the preflight answers `204` with the headers, and the share opens. An open
share needs none of it: a plain `GET` with no `Authorization` is a simple request and is never
preflighted.

**The cost worth knowing before choosing this route.** On a self-hosted server, CORS is an
administrator's setting rather than a property of the service. Half the servers a reader meets
will be configured and half will not, and the person who sees the difference is the child whose
library will not load. Point a publisher at this section before they publish, not after.

## Measured and not working

Verified 2026-08-27 against real public folders, with `Origin: https://my.readlet.ru`.
None of these can be read by a browser today, each for its own reason.

| Provider | Where it breaks |
|---|---|
| **Mail.ru Cloud** | The entry points have no CORS. `api/v2/folder?weblink=…` and `api/v2/dispatcher` both answer `200` with valid JSON, and neither carries `Access-Control-Allow-Origin`; the `OPTIONS` preflight answers `200` with no `access-control-*` header at all. A browser can obtain neither the listing nor the address of a content node, and that address carries a token, so it cannot be hardcoded either. |
| **OneDrive** | CORS is fine, anonymous access is not. `api.onedrive.com/v1.0/shares/{id}/driveItem`, the same with `/root/content`, and Microsoft Graph's `shares/{id}/driveItem` all answer `401`; Graph says plainly "Access token is empty". The current share-link format requires a token. |
| **pCloud** | The API is open — `eapi.pcloud.com/showpublink` and `getpublinkdownload` both answer with `Access-Control-Allow-Origin: *` — but the content host answers a preflight with `Access-Control-Allow-Origin: https://www.pcloud.com` and sends no such header on the `GET` itself. Reading the body cross-origin is permitted to exactly one application, their own web client. Two further obstacles, recorded for completeness: the region is part of the address (`api.pcloud.com` rejects a link issued for `eapi`), and there is no addressing by path — `getpublinkdownload` requires a `fileid` obtained from a listing. |
| **Google Drive** | A public file is readable only through `files/{id}?alt=media&key=…`. The key is publishable, so this is not a secret leak, but the quota is charged to whoever issued the key rather than to the publisher of the lib, and it is shared by every reader. |
| **Dropbox** | The content host is open (`ACAO: *`), but there is no addressing by path inside a shared folder: a path is resolved through the `sharing/*` endpoints, and those require an app token. A token is a secret, and a secret cannot live in a client-side package. |

Two observations that explain the pattern, rather than complain about it.

**Yandex.Disk is the exception, not the representative case.** It is the only consumer cloud
measured here that offers CORS and anonymous access at the same time. Every other one fails
on one of the two, and which one varies: Mail.ru allows anonymous reads but no CORS, OneDrive
allows CORS but no anonymous reads.

**Mail.ru has a working alternative in another product of the same company.** VK Cloud Storage
speaks an S3-compatible protocol, and a public bucket there is an ordinary static host — it is
supported today, with no prefix and no provider code.

A corroborating detail, for anyone tempted to try again: every community tool built for
Mail.ru Cloud — the downloaders, the WebDAV bridges, the file-manager plugins — runs
server-side, where the same-origin policy does not apply. No browser client exists, and that
is not a coincidence.

## Choosing

If you have no strong preference, publish to a **static host**. It is the cheapest option to
support, the fastest to read, the only one with no second request per document, and the only
one whose behaviour is entirely under your control. GitHub Pages serves
`Access-Control-Allow-Origin: *` without any configuration at all, which makes it the shortest
path from nothing to a published lib.

Reach for Yandex.Disk when the publisher already keeps the material there and will not set up
hosting.
