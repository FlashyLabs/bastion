# On the FlashyOS mesh

Bastion is a product on the FlashyOS mesh — a running service with a roadmap, a deploy and the invariants it rests on enforced by tests.

Its AAO charter is [`flashyos.roles.json`](flashyos.roles.json) — the single source the mesh
handshake and the directory fragment derive from, so two hand-written files can
never disagree. It declares **five roles**, and five roles are five agents:

| Role | Family | Human approval at/above | What it is accountable for |
|---|---|---|---|
| `product` | product | HIGH | Owns what the product does and the order it is built in, and answers to the accountable human for the roadmap it commits to. |
| `engineering` | engineering | HIGH | Builds and maintains the codebase, and keeps the invariants the product rests on enforced by a test rather than a guideline. |
| `operations` | operations | CRITICAL | Runs the deploy and keeps the service up. |
| `review` | governance | HIGH | Reviews and approves a change before it lands. |
| `conformance` | risk | LOW | Runs the tests, the lint and the mesh conformance check, and holds the default branch to what those checks require. |

The charter validates against the estate's dependency-free AAO checker:

```bash
node vendor-aao-check.mjs validate flashyos.roles.json   # 0 issues
```

**Becoming a live organisation.** The charter is what a live org is provisioned
from. From a machine that holds `DATABASE_URL`:

```bash
npx tsx packages/api/scripts/provision-org-from-charter.ts \
  --charter flashyos.roles.json --tier FREE
```

The FREE tier allows five agents, which is exactly this charter's five roles.
Provisioning is a database write a person runs; committing the charter is the
half a repository can hold. The authoritative conformance check runs against the
live domain after deploy: `npx @flashyos/conformance <domain> --level 2`.

`directory.fragment.json` is this org's `directory/1` node: the org, one agent
per role, and the accountable person.
