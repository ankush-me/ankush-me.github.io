# ankush-me.github.io

Personal homepage for ankushgupta.org. Plain HTML, CSS and JavaScript; no build step is required.

- `index.html`: page content, appearance controls and lamp SVG.
- `assets/site.css`: responsive layout and the light/dark color palette.
- `assets/themes.js`: dark-by-default appearance and saved light/dark preference.
- `assets/lamp.js`: arm geometry, animation, lighting and text shadows.
- `assets/app.js`: mode, light and pointer controls.
- `rll-site/`: existing Berkeley pages and linked papers.

Run behavior checks with `node tests/site.test.cjs`. Preview locally with `python3 -m http.server 8000`.

Publish the repository root with GitHub Pages. `CNAME` retains the custom domain `ankushgupta.org`.
Local experiments in `lab/` and system metadata are ignored by Git.

Publish with `./commit-reset.sh`. It builds a temporary repository containing one
snapshot commit and replaces `origin/main`, preserving your local history and staging.
It includes current working-tree edits and new, non-ignored files. Existing tracked
files remain included even if an ignore rule now matches them; deleted files are omitted.

Run `./commit-reset.sh --dry-run` first to list the snapshot files without network
access or publishing. The real push uses an explicit force-with-lease and aborts if
`origin/main` changes while the snapshot is being published. The snapshot commit
uses your configured Git name and email, falling back to the latest local commit’s
author when no identity is configured.

Use this script instead of ordinary pushes to the public repository to avoid
publishing local edit history. Only `main` is replaced; other branches and tags are
untouched. Previously published commits may still exist in GitHub caches or forks.

Test the publishing script offline with `python3 tests/publish.test.py`.
