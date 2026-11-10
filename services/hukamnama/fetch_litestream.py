"""Download the pinned Litestream release into /usr/local/bin (image build step only).

The version and sha256 come from the Dockerfile's build args. The sha256 is the one published in
the release's checksums.txt; any mismatch fails the build.
"""

import hashlib
import io
import os
import sys
import tarfile
import urllib.request


def main() -> None:
    version = os.environ["LITESTREAM_VERSION"]
    want = os.environ["LITESTREAM_SHA256"]
    url = (
        "https://github.com/benbjohnson/litestream/releases/download/"
        f"v{version}/litestream-{version}-linux-x86_64.tar.gz"
    )
    with urllib.request.urlopen(url, timeout=120) as resp:  # noqa: S310 - fixed https URL
        data = resp.read()
    got = hashlib.sha256(data).hexdigest()
    if got != want:
        sys.exit(f"ERROR: litestream {version} sha256 {got} != pinned {want}")
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        src = tf.extractfile(tf.getmember("litestream"))
        if src is None:
            sys.exit("ERROR: litestream binary missing from the release archive")
        with src, open("/usr/local/bin/litestream", "wb") as dst:
            dst.write(src.read())
    os.chmod("/usr/local/bin/litestream", 0o755)
    print(f"litestream {version} installed (sha256 ok)")


if __name__ == "__main__":
    main()
