"""An object-storage sink for the public snapshot: Cloudflare R2 over its S3 API (stdlib only).

``public.Publisher`` writes each published day through a sink. ``public.DirSink`` writes files;
``R2Sink`` here writes the same keys to an R2 bucket, which the edge Worker
(``services/hukamnama-edge``) reads. Requests are signed with AWS Signature Version 4
(``sign_v4``, checked against AWS's published example in the tests).

Configuration (all four, or none; the service refuses to start half-configured):

  HUKAMNAMA_PUBLIC_BUCKET             the bucket the snapshot is written to
  HUKAMNAMA_R2_ENDPOINT               https://<account id>.r2.cloudflarestorage.com (shared with the backup)
  HUKAMNAMA_PUBLIC_ACCESS_KEY_ID      an R2 API token scoped to that one bucket, Object Read & Write;
  HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY  not the backup's token, which may only touch the state bucket

A failed write raises; the publisher logs it and tries again after the next poll. Nothing here
can change what is published: it only copies bytes the publisher already proved.
"""
from __future__ import annotations

import hashlib
import hmac
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

TIMEOUT = 10
REGION = "auto"                 # R2 has one region name
SERVICE = "s3"
CONTENT_TYPE = "application/json; charset=utf-8"
CACHE_CONTROL = "no-cache"      # the Worker sets what readers see; the stored object must revalidate


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def sign_v4(method: str, host: str, path: str, headers: dict[str, str], payload_sha256: str, *,
            access_key: str, secret_key: str, region: str, service: str, amz_date: str) -> str:
    """The ``Authorization`` header value for one request (AWS Signature Version 4, no query
    string). ``headers`` are the headers to sign besides ``host``; ``path`` is already
    percent-encoded; ``amz_date`` is ``YYYYMMDDTHHMMSSZ``."""
    signed = {k.lower(): " ".join(v.split()) for k, v in headers.items()}
    signed["host"] = host
    names = ";".join(sorted(signed))
    canonical = "\n".join([method, path, "", "".join(f"{k}:{signed[k]}\n" for k in sorted(signed)), names,
                           payload_sha256])
    scope = f"{amz_date[:8]}/{region}/{service}/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode("utf-8")).hexdigest()])
    key = _hmac(_hmac(_hmac(_hmac(("AWS4" + secret_key).encode("utf-8"), amz_date[:8]), region), service), "aws4_request")
    signature = hmac.new(key, to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={names}, Signature={signature}"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):        # a signed write must never be replayed elsewhere
        return None


class R2Sink:
    def __init__(self, endpoint: str, bucket: str, access_key: str, secret_key: str, *,
                 opener=None, now=lambda: datetime.now(timezone.utc)) -> None:
        u = urllib.parse.urlsplit(endpoint)
        if u.scheme != "https" or not u.hostname or u.path not in ("", "/") or u.query or u.username:
            raise ValueError("the R2 endpoint must be https://<host> with no path")
        if not bucket or "/" in bucket:
            raise ValueError("bad bucket name")
        self._base, self._host, self._bucket = f"https://{u.netloc}", u.netloc, bucket
        self._access, self._secret, self._now = access_key, secret_key, now
        self._open = (opener or urllib.request.build_opener(_NoRedirect)).open

    def _path(self, key: str) -> str:
        if not key or key.startswith("/") or ".." in key.split("/") or "//" in key:
            raise ValueError("bad object key")
        return "/" + urllib.parse.quote(f"{self._bucket}/{key}", safe="/-_.~")

    def _send(self, method: str, key: str, body: bytes | None) -> None:
        path = self._path(key)
        digest = hashlib.sha256(body or b"").hexdigest()
        amz_date = self._now().strftime("%Y%m%dT%H%M%SZ")
        headers = {"x-amz-content-sha256": digest, "x-amz-date": amz_date}
        if body is not None:
            headers["content-type"] = CONTENT_TYPE
            headers["cache-control"] = CACHE_CONTROL
        headers["Authorization"] = sign_v4(method, self._host, path, headers, digest, access_key=self._access,
                                           secret_key=self._secret, region=REGION, service=SERVICE, amz_date=amz_date)
        req = urllib.request.Request(self._base + path, data=body, method=method, headers=headers)
        try:
            with self._open(req, timeout=TIMEOUT) as r:
                r.read()
        except urllib.error.HTTPError as e:
            # the status only: an error body may quote the request, and nothing here is logged with keys
            raise OSError(f"R2 {method} {key}: HTTP {e.code}") from None
        except urllib.error.URLError as e:
            raise OSError(f"R2 {method} {key}: {type(e.reason).__name__}") from None

    def put(self, key: str, body: bytes) -> None:
        self._send("PUT", key, body)

    def delete(self, key: str) -> None:
        self._send("DELETE", key, None)         # S3 answers 204 whether or not the object existed


class MultiSink:
    """Writes to every sink; fails if any fails (the publisher then retries the whole key)."""
    def __init__(self, *sinks) -> None:
        self.sinks = sinks

    def put(self, key: str, body: bytes) -> None:
        for s in self.sinks:
            s.put(key, body)

    def delete(self, key: str) -> None:
        for s in self.sinks:
            s.delete(key)


ENV = ("HUKAMNAMA_PUBLIC_BUCKET", "HUKAMNAMA_R2_ENDPOINT", "HUKAMNAMA_PUBLIC_ACCESS_KEY_ID",
       "HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY")


def from_env(env) -> R2Sink | None:
    """The sink the environment asks for, or None when the public bucket is not configured.
    Raises ``ValueError`` naming what is missing when it is only half configured."""
    if not env.get("HUKAMNAMA_PUBLIC_BUCKET"):
        if env.get("HUKAMNAMA_PUBLIC_ACCESS_KEY_ID") or env.get("HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY"):
            raise ValueError("public snapshot credentials are set but HUKAMNAMA_PUBLIC_BUCKET is not")
        return None
    missing = [k for k in ENV if not env.get(k)]
    if missing:
        raise ValueError("HUKAMNAMA_PUBLIC_BUCKET is set but these are not: " + ", ".join(missing))
    return R2Sink(env["HUKAMNAMA_R2_ENDPOINT"], env["HUKAMNAMA_PUBLIC_BUCKET"],
                  env["HUKAMNAMA_PUBLIC_ACCESS_KEY_ID"], env["HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY"])
