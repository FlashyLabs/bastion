# Security

Bastion is a gateway: its whole purpose is to be the hardened single entry
point in front of an operator's systems. A vulnerability here is a
vulnerability in every operator that would sit behind it, so please report
privately and give us time to fix before disclosing.

## Reporting

Email **security@flashylabs** — this address is to be confirmed before the
repository is shared beyond the estate; until it is confirmed, report to the
accountable contact named in the estate's flashyos charter.

Include what you found, how to reproduce it, and what you believe the impact
is. You will get an acknowledgement, and we will tell you what we did about
it, including when the answer is worse than you hoped.

Do not open a public issue for a vulnerability. The issue templates link
here for that reason.

## Scope in v0

This is a v0 skeleton. Stages 2–4 of the request path (delegation
verification, payment policy, upstream proxy) are designed and not built,
so there is no authentication to bypass and no proxy to abuse yet. What is
real and in scope now:

- The operator config validator (`src/config.mjs`): anything it accepts that
  it should refuse — a non-https origin, a contact carrying mailto header
  separators, a credential in a URL.
- The derived discovery document (`src/agent-doc.mjs`): any way the private
  origin host or an origin path can reach the published document.
- The pure handler and the `node:http` adapter: request smuggling, body-cap
  bypass, a response that claims a stage ran when it did not.
- The receipt stub: any reading of `sha256-digest-unsigned` as a signature
  is a defect in our copy, not in your reading — tell us where.

## What we will not do

- Store a secret in this repository, an artifact or a config. Secret
  Manager only.
- Ship a stage labelled `implemented` ahead of the code and the test that
  prove it.
