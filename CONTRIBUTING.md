# Contributing

Bastion is a private-intended commercial repository. Contributions come from
people with access to it; there is no public contribution path, and no part
of this tree is a specification anyone else is asked to adopt.

## Before you open a pull request

```bash
npm run lint    # node --check every module, import discipline, credential shapes
npm test        # node --test test/
```

Both must pass. There is nothing to install: Node 22 and `node:` builtins
only. A change that needs a package is a change to discuss first, and the
lint refuses any import that is not `node:` or relative.

## Rules the tests hold

Read `CLAUDE.md` — "Rules, each enforced by a test" is the list. In short:

- The discovery document is derived from the operator config. Never
  hand-write a field of it; change the config or the derivation.
- `src/config.mjs`, `src/agent-doc.mjs` and `src/handler.mjs` stay pure: no
  `node:` imports, no clock, no key, no socket. Inject through `deps`.
- A stage that is designed and not built says so in the response. Do not
  turn `verified: false`, `evaluated: false` or `status: not_implemented`
  into anything else without the code and the test behind it.
- Examples and tests use fictional operators on `.example` hosts only.
- No secret, no real customer, no adoption figure, anywhere.

## What a good change looks like

- One concern per pull request.
- A test that fails before and passes after. For a refusal, a test that the
  bad input is refused with a sentence naming the field.
- README and ARCHITECTURE updated in the same change if a claim there moves
  from "designed" to "implemented" — and only then.
- The commit message says what happened, including when it is worse than
  expected.

## Reporting a security issue

See `SECURITY.md`. Do not open a public issue for a vulnerability.
