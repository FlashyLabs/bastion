---
name: Bug report
about: Something the code does that a test or a document says it should not
title: ''
labels: bug
assignees: ''
---

**Which branch did you measure?**
`git symbolic-ref --short refs/remotes/origin/HEAD` and the commit you ran.

**What happened**
The request (method, path, headers, body) and the response you got.

**What should have happened**
Point at the sentence in `README.md`, `ARCHITECTURE.md` or `CLAUDE.md` that
promises otherwise, or at the test that should have caught it.

**Reproduce**
A `node --test` case, or the `curl` against `npm start`, that shows it.

**Is this a security issue?**
If it could be, stop here and follow `SECURITY.md` instead of filing this.
