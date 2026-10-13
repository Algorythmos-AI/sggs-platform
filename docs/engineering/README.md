---
title: "Engineering handbook"
description: "The operating manual for this repository: which handbook page to read before which kind of change."
sidebar:
  order: 0
verified:
  commit: f25ab970
  date: "2026-09-25"
---
# Engineering handbook

The operating manual for this repository. Start with the invariants: they are
non-negotiable, and the prime directive overrides everything else.

<!-- sggs:cards -->
- [Engineering invariants](invariants.md) — Before any change — prime directive, data model, conventions & gotchas, how to verify
- [Local setup, repository map & API](local-setup.md) — Setting up, running or rebuilding locally; repository map; API reference; iOS DB pair
- [Delivery, versioning & release](delivery.md) — Shipping — versioning, the integration → staging → production loop, delivery tooling, how the iOS app takes each release
- [Brand & domains](brand.md) — Touching names, domains, URLs or visual identity
- [Release timeline & known issues](known-issues.md) — Background on past releases and items still open

Related: [CONTRIBUTING](../../CONTRIBUTING.md) · [architecture](../architecture/overview.md) ·
[ADRs](../adr/) · [process & runbooks](../process/) · [Answer Protocol](https://github.com/Algorythmos-AI/sggs-data/blob/main/Answer-Protocol.md) (sggs-data).
