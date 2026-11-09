# Hukamnama service image (Sri Harmandir Sahib Hukamnama, located in the pinned corpus).
# Python-stdlib only. Build context is the REPO ROOT, like webapp/Dockerfile, because the
# scripture DB is installed from the pin in dataset.lock.json:
#
#   docker build -f services/hukamnama/Dockerfile -t hukamnama .   # from the repo root
#
# Render runs it with a persistent disk mounted at /var/data, which holds the only mutable files:
# the decision/audit state (SQLite, WAL) and the fetch archive. The scripture DB is read-only.
FROM python:3.12-slim

WORKDIR /app

# The exact database pinned by the lock (sha256 + size verified; the build fails on a mismatch).
COPY dataset.lock.json ./dataset.lock.json
COPY scripts/data/fetch_dataset.py ./scripts/data/fetch_dataset.py
RUN python scripts/data/fetch_dataset.py --lock dataset.lock.json \
 && python -c "import sys; ok=open('db/sggs.sqlite','rb').read(16)==b'SQLite format 3\x00'; sys.exit(0 if ok else 'ERROR: db/sggs.sqlite is not a SQLite database')" \
 && chmod 0444 db/sggs.sqlite

COPY services/hukamnama/hukamnama/ ./hukamnama/

# Render passes RENDER_GIT_COMMIT as a build arg; /health reports it so a deploy is verified by
# the commit it runs, not by its version string.
ARG RENDER_GIT_COMMIT=""
ENV HUKAMNAMA_COMMIT=${RENDER_GIT_COMMIT} \
    HUKAMNAMA_DB=/app/db/sggs.sqlite \
    HUKAMNAMA_STATE=/var/data/hukamnama-state.sqlite \
    HUKAMNAMA_ARCHIVE=/var/data/archive \
    PYTHONUNBUFFERED=1

# Render mounts the persistent disk at /var/data owned by root, so the process runs as root, as
# the API image does; it writes only under /var/data. The directory exists for local runs too.
RUN mkdir -p /var/data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request as u; u.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT','8080')}/health\").read()" || exit 1

CMD ["python", "-m", "hukamnama", "serve"]
