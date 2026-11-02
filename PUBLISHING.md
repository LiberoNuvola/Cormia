# Publishing Cormia to GitHub

The local Git repository scaffold is prepared at `/mnt/data/cormia`, including the existing AEP design history and the Cormia naming decision. The connected GitHub integration currently exposes repository read/search and file/branch operations, but no repository-creation action. Therefore the remote repository has **not** been created by this workflow.

Proposed remote:

- Owner: `LiberoNuvola`
- Name: `cormia`
- URL: `https://github.com/LiberoNuvola/cormia`
- Visibility: public is the intended direction, subject to owner confirmation at creation
- Default branch: `main`

Create an empty GitHub repository named `cormia` under `LiberoNuvola` (do not initialize it with a README, license, or .gitignore). Then, from the local repository directory, run:

```bash
git remote add origin https://github.com/LiberoNuvola/cormia.git
git push -u origin main
```

Before the first public push, review `LICENSING-DECISION.md`. No license is selected yet. Do not claim an open-source license until the rightsholder approves the choice and all imported code is audited for compatibility. This scaffold contains no copied source code from the prior-art projects listed in `docs/research/PRIOR_ART.md`.

The existing `LiberoNuvola/Immortal-Protocol` repository must remain untouched; Cormia is a separate repository.
