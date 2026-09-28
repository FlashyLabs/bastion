# Bastion — the commercial gateway for agent traffic

`@flashylabs/bastion`. An operator hands Bastion an existing website or API
and Bastion exposes a secure, authenticated, discoverable, payable machine
interface in front of it: `/.well-known/agent` derived from config, callers
authenticated by `delegation/1` chains, calls gated by `pay-policy/1`, a
receipt per action. Node 22, ESM, `node:` builtins only, nothing to install.

**Visibility: private-intended.** This is a commercial product, not a
protocol; the protocols it implements are the open specs it links to. It is
the revenue layer. Nothing that a sibling specification needs may live here,
and nothing here may redefine one — `agent/1`, `delegation/1` and
`pay-policy/1` are referenced by name and never restated.

**Status: v0 skeleton, in design.** Stage 1 of the request path is built;
stages 2–4 are designed only; stage 5 is a stub. Every response that reaches
a designed-only stage says so in its body (`verified: false`,
`evaluated: false`, `status: not_implemented`). Do not change a label to
`implemented` without the code and a test that proves it.

## What makes this repository different

**A product, not a protocol.** Every other repository in this neighbourhood
publishes a format for strangers to adopt. This one sells an implementation.
That inverts the usual rule: here the discovery document is an *output*, the
config is the *input*, and the specs are *upstream* — read them, cite them,
do not fork them.

**The pure handler and the network edge are separate files, and the tests
hold the line.** `src/config.mjs`, `src/agent-doc.mjs`, `src/handler.mjs` and
`src/vendor-domain.mjs` import no `node:` builtin and touch nothing outside
their arguments: not a clock, not a key, not a socket. `handle(request, config, deps)` takes its
`now` and `receiptSigner` from `deps`, so every flow is walked in a test
with plain objects. `src/server.mjs` is the only file that opens a socket,
reads a file, or hashes with `node:crypto`; it does nothing with a request
except hand it to the handler. `test/repo.test.mjs` and `tools/lint.mjs`
both fail if a `node:` import lands in a pure module.

**The proxy stage refuses to pretend.** `proxyToOrigin` throws
`NotImplemented`; the handler renders it as a 501 that names the endpoint it
would have called. A 200 from a gateway that did not forward the call is a
fabricated receipt. When the proxy is built, it is built behind that seam
and the 501 test is replaced by one that drives a fake origin — never
removed first.

**The same-domain rule is vendored, not written here.** A capability
endpoint is a path on `origin` or an https URL on the origin's host or a
subdomain of it; a stranger, the origin's parent or a sibling is refused as
`endpoint-cross-domain`. The rule is `src/vendor-domain.mjs`, a
byte-identical copy of the file canonical in the `agent-dns` repository and
vendored likewise into `agent-wellknown` and `flashy-examples`, so a gateway
deriving an `agent/1` document and a consumer checking one answer "same
domain" identically. It is host-or-subdomain by design and never a
"registrable domain" guess: without a Public Suffix List nothing can tell
`co.uk` from `example.com`, and the label-slice rules it replaced read
`acme.co.uk` and `other.co.uk` as one publisher. `test/vendor-drift.test.mjs`
compares the copy against canon when agent-dns is checked out beside this
repository and reports unknown when it is not. Re-vendor; never edit it here.
The well-known path is `/.well-known/agent` only, and a repo gate asserts no
`.json` spelling appears in `src/`.

**The receipt "signature" is a digest and says so.** `defaultDeps()` in the
server signs with an unkeyed sha256 labelled `sha256-digest-unsigned`. It
proves the bytes have not changed since rendering and nothing about who
rendered them. A keyed signature with a published verification key is
stage 5's design; until it lands, do not rename the `alg`.

## Commands

```bash
npm test        # node --test 'test/*.test.mjs' — must pass
npm run lint    # node tools/lint.mjs — node --check every .mjs, import discipline, credential shapes
npm start       # node src/server.mjs examples/operator.config.json  (PORT, HOST from env)
```

## Rules — each enforced by a test

- **The parser refuses; it does not guess.** `validateConfig` refuses a
  non-https `origin` or `edge`, a URL carrying credentials, a float or
  string or negative price, a lowercase currency, a missing price (free is
  `amount: 0`, never omitted), a capability verb that is a department word
  (`sales`, `marketing`, `engineering`, `operations`, `support`, `finance`,
  `legal`, `hr`), a duplicate verb, a missing accountable human, a contact
  carrying mailto header separators, an unknown auth or payment method, an
  empty capability list, a capability endpoint off the origin's domain
  (`endpoint-cross-domain`), and any unknown key not prefixed `x-`. It
  reports every error at once. `test/config.test.mjs`.
- **The discovery document is derived, never hand-written.**
  `deriveAgentDocument` is the only source of `/.well-known/agent`; it
  refuses an invalid config rather than emitting a partial document; two
  derivations of one config are byte-identical. `test/agent-doc.test.mjs`.
- **The origin never leaks.** The derived document carries edge endpoints
  only. A test renders the document and asserts the origin host and every
  origin path are absent from the bytes.
- **Verb capabilities, https endpoints, minor units.** Every published
  capability has a slug verb, an `https:` endpoint on the edge, and an
  integer `price.amount` with a three-letter `currency`.
- **Well-known GET 200, wrong method 405 with `Allow`, unknown path 404,
  unknown verb 404, known verb POST 501 with `wouldProxyTo` and a receipt
  stub.** `test/handler.test.mjs` walks each.
- **Receipts are not optional.** `policies.receipts.perAction` may only be
  `true`; the receipt payload is signed by the injected signer and the
  signature is not inside its own payload.
- **The handler runs without a clock or a key.** It throws `TypeError` when
  `deps` lacks `now` or `receiptSigner`; it never reaches for `Date` itself.
- **No dependencies, no LICENSE file, private, ESM, Node 22, no install in
  CI.** `test/repo.test.mjs` reads `package.json`, the tree and
  `.github/workflows/ci.yml`.
- **The example is fictional and says so.** Hosts stay on `.example`; the
  config carries an `x-note` declaring the operator invented.
- **No audience or adoption claim in any copy.** A repo gate scans the
  README, ARCHITECTURE and this file.

## Don't

- Hand-write anything that `agent-doc.mjs` derives. Edit the config.
- Import a `node:` builtin in `src/config.mjs`, `src/agent-doc.mjs`,
  `src/handler.mjs` or `src/vendor-domain.mjs`.
- Edit `src/vendor-domain.mjs`. It is a copy; change it in `agent-dns` and
  re-vendor.
- Add a package. `node:` builtins only; the lint refuses any other specifier.
- Put a real company, person, domain or price in an example or a test.
- Commit a `LICENSE` file or declare a licence anywhere in this tree.
- Turn a `designed` or `not_implemented` label green without the code and
  the test behind it.

## House rules — true in every repository in this estate
**`main` is not necessarily the default branch.** Ask, every time: `git symbolic-ref --short refs/remotes/origin/HEAD`.
**Say which branch you measured.** Reading the working tree tells you about your checkout, not the repository.
**Re-vendor before you trust a vendored change.** Files named `vendor-*.mjs` are byte-identical copies; a stale copy disagrees silently.
**No secret in a file, a repo, or an artifact.** Secret Manager only.
**The licence is declared once**, in `tools/estate-licences.mjs` in flashyos. Do not decide this repository's licence inside it.
**A generated file is regenerated, never hand-edited.**
**Report what happened, including when it is worse than expected.**
