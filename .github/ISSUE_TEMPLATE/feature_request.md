---
name: Feature request
about: A stage to build, a refusal to add, or a change to what an operator can declare
title: ''
labels: enhancement
assignees: ''
---

**Which stage of the request path does this touch?**
1 discover · 2 authenticate (`delegation/1`) · 3 pay (`pay-policy/1`) ·
4 proxy · 5 receipt · none of these (say what instead).

**What should an operator be able to do, or an agent be able to rely on?**

**Does it change a sibling specification?**
If it needs `agent/1`, `delegation/1` or `pay-policy/1` to say something
new, the change belongs in that repository first. Bastion implements the
specs; it does not extend them.

**Which test would prove it?**
A refusal needs a test that the bad input is refused with a sentence naming
the field. A new stage needs the pure handler walked with fake `deps`.

**Which label moves?**
If this turns a `designed` or `not_implemented` row in `ARCHITECTURE.md`
into `implemented`, say so — the README, CLAUDE.md and the response bodies
move in the same change.
