"""CLI.

  python -m hukamnama serve   --db DB --state STATE [--port 8080] [--no-poll] [--archive DIR]
  python -m hukamnama tick    --db DB --state STATE [--force]
  python -m hukamnama approve YYYY-MM-DD --first-line ID --last-line ID --by NAME --reason TEXT
  python -m hukamnama hold    YYYY-MM-DD --by NAME --reason TEXT
  python -m hukamnama show    YYYY-MM-DD
  python -m hukamnama resend  YYYY-MM-DD --by NAME --reason TEXT

Push (``serve``): sending is OFF unless ``HUKAMNAMA_SEND=on``. It then needs the APNs Auth Key,
read from ``HUKAMNAMA_APNS_KEY_FILE`` (a Render secret file, PEM), ``HUKAMNAMA_APNS_KEY_ID`` and
``HUKAMNAMA_APNS_TEAM_ID``; without all three the service refuses to start rather than run with
sending silently off.

``approve`` and ``hold`` are the owner's tools for a day the gate held (or got wrong). They
overwrite the day's decision and are written to the audit table.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import sys
import threading

from . import clock
from .api import State, day_record, serve, tick_loop
from .archive import Archive
from .corpus import open_ro, resolution_for_range, scripture_sha256
from .engine import Engine
from .sources import fetch
from .store import Store


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="hukamnama")
    p.add_argument("--db", default=os.environ.get("HUKAMNAMA_DB", "db/sggs.sqlite"))
    p.add_argument("--state", default=os.environ.get("HUKAMNAMA_STATE", "hukamnama-state.sqlite"))
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--host", default="0.0.0.0")
    s.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    s.add_argument("--no-poll", action="store_true")
    s.add_argument("--archive", default=os.environ.get("HUKAMNAMA_ARCHIVE") or None,
                   help="keep every distinct page fetched, gzip, under DIR/<amritsar date>/ (the soak's replay corpus)")
    t = sub.add_parser("tick")
    t.add_argument("--force", action="store_true")
    a = sub.add_parser("approve")
    a.add_argument("date"); a.add_argument("--first-line", type=int, required=True)
    a.add_argument("--last-line", type=int, required=True)
    a.add_argument("--by", required=True); a.add_argument("--reason", required=True)
    h = sub.add_parser("hold")
    h.add_argument("date"); h.add_argument("--by", required=True); h.add_argument("--reason", required=True)
    sh = sub.add_parser("show")
    sh.add_argument("date")
    rs = sub.add_parser("resend")
    rs.add_argument("date"); rs.add_argument("--by", required=True); rs.add_argument("--reason", required=True)
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    con = open_ro(args.db)
    fingerprint = scripture_sha256(con)
    store = Store(args.state)
    known = store.get_meta("scripture_sha256")
    if known and known != fingerprint and args.cmd == "serve":
        # published ranges are pinned to the corpus they were resolved in; a different corpus
        # would serve ids that may point elsewhere. Refuse rather than guess.
        print(f"corpus fingerprint changed ({known[:12]} -> {fingerprint[:12]}); re-resolve before serving",
              file=sys.stderr)
        return 2
    store.set_meta("scripture_sha256", fingerprint)
    now = clock.utcnow()

    if args.cmd == "serve":
        state = State(store, fingerprint)
        stop = threading.Event()
        if not args.no_poll:
            fetcher = Archive(args.archive).wrap(fetch) if args.archive else fetch
            engine = Engine(store, con, fingerprint, fetcher=fetcher)
            threading.Thread(target=tick_loop, args=(state, engine, stop), daemon=True).start()
        if os.environ.get("HUKAMNAMA_SEND", "off") == "on":
            apns = _apns_from_env()
            if apns is None:
                return 2
            from .push import Sender, send_loop
            threading.Thread(target=send_loop, args=(Sender(store, apns), stop), daemon=True).start()
            state.sending = True
        httpd = serve(state, args.host, args.port)
        signal.signal(signal.SIGTERM, lambda *_: (stop.set(), threading.Thread(target=httpd.shutdown).start()))
        logging.info("hukamnama %s serving on %s:%s (scripture %s)", "poll" if not args.no_poll else "read-only",
                     args.host, args.port, fingerprint[:12])
        httpd.serve_forever()
        return 0
    if args.cmd == "tick":
        r = Engine(store, con, fingerprint).tick(now, force=args.force)
        print(json.dumps({"action": r.action, "detail": r.detail}, ensure_ascii=False))
        return 0
    day = clock.parse_day(args.date)
    if args.cmd == "approve":
        res = resolution_for_range(con, args.first_line, args.last_line)
        store.publish(day, res, fingerprint, now, args.by, reason=args.reason, overwrite=True)
    elif args.cmd == "hold":
        store.hold(day, now, args.by, args.reason, overwrite=True)
    elif args.cmd == "resend":
        n = store.requeue_day(day, now)
        store.audit(now, args.by, "resend", day, f"{n} devices: {args.reason}")
        print(json.dumps({"requeued": n}))
        return 0
    print(json.dumps({"decision": store.decision(day), "served": day_record(store, day, fingerprint, now)},
                     ensure_ascii=False, indent=1))
    return 0


def _apns_from_env():
    path = os.environ.get("HUKAMNAMA_APNS_KEY_FILE", "")
    kid = os.environ.get("HUKAMNAMA_APNS_KEY_ID", "")
    team = os.environ.get("HUKAMNAMA_APNS_TEAM_ID", "")
    if not (path and kid and team):
        print("HUKAMNAMA_SEND=on needs HUKAMNAMA_APNS_KEY_FILE, HUKAMNAMA_APNS_KEY_ID and HUKAMNAMA_APNS_TEAM_ID",
              file=sys.stderr)
        return None
    try:
        with open(path, encoding="ascii") as f:
            pem = f.read()
    except OSError as e:
        print(f"cannot read the APNs key file: {type(e).__name__}", file=sys.stderr)   # never the path's content
        return None
    from .push import APNs, TOPIC
    apns = APNs(pem, kid, team, os.environ.get("HUKAMNAMA_APNS_TOPIC", TOPIC))
    try:
        apns.provider_token()                     # fail now, not at 05:30 IST, if the key is unusable
    except Exception as e:
        print(f"the APNs key cannot sign a provider token: {type(e).__name__}", file=sys.stderr)
        return None
    return apns


if __name__ == "__main__":
    sys.exit(main())
