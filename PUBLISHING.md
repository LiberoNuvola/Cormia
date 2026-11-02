# Publishing this repository to GitHub

The local Git repository scaffold is prepared, but the connected GitHub integration currently exposes repository read/search and file/branch operations, not a repository-creation action. Therefore no remote repository has been created by this workflow.

Proposed remote:

- Owner: `LiberoNuvola`
- Name: `immortal-autonomous-execution-protocol`
- Visibility: public (recommended, subject to owner confirmation at creation)
- Default branch: `main`

After creating an empty repository under the intended owner, from this directory run:

```bash
git remote add origin https://github.com/LiberoNuvola/immortal-autonomous-execution-protocol.git
git push -u origin main
```

Before the first public push, review `LICENSING-DECISION.md`. Do not claim an open-source license until it is formally selected and approved. This scaffold contains no copied source code from the prior-art projects listed in `docs/research/PRIOR_ART.md`.
