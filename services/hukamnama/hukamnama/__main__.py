"""CLI.

  python -m hukamnama serve   --db DB --state STATE [--port 8080] [--no-poll]
  python -m hukamnama tick    --db DB --state STATE [--force]
  python -m hukamnama approve YYYY-MM-DD --first-line ID --last-line ID --by NAME --reason TEXT
  python -m hukamnama hold    YYYY-MM-DD --by NAME --reason TEXT
  python -m hukamnama show    YYYY-MM-DD

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
from .corpus import open_ro, resolution_for_range, scripture_sha256
from .engine import Engine
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
            threading.Thread(target=tick_loop, args=(state, Engine(store, con, fingerprint), stop), daemon=True).start()
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
    print(json.dumps({"decision": store.decision(day), "served": day_record(store, day, fingerprint, now)},
                     ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
