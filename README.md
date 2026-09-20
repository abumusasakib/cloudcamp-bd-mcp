# CloudCamp BD MCP — safe local mirror

A local, security-conscious replacement for the community-posted
`cloudcamp-bd-mcp.equisaas-bd.com` server. It gives your AI agent CloudCamp
BD competition knowledge base content, but fixes every concern raised about
the original — and keeps multiple sources **separate and clearly labeled**
rather than merging them into one blob:

| Source | File | Status |
| --- | --- | --- |
| International AI Builders Congress 2026 (community mirror) | `knowledge-base.md` | **PARTIALLY RECONCILED** — third-party mirror; deadline + rubric now confirmed accurate against the live site, but track/domain structure and per-field scoring table are unconfirmed/likely wrong. See its reconciliation note. |
| International AI Builders Congress 2026 (official) | `knowledge-base-ai-builders-congress.md` | **OFFICIAL, live-scraped** directly from `cloudcampbd.com/ai-builders-congress` via a local headless browser (no LLM involved). Same event as the row above — this is the corrected/authoritative version. |
| THE INFINITY AI BUILDFEST 2026 | `knowledge-base-infinity-buildfest.md` | **OFFICIAL** — organizer-authored content exported from a Google NotebookLM notebook, names CloudCamp Bangladesh / BRAC University as organizers. A separate, earlier CloudCamp event. |

The Congress and the Infinity BuildFest are **two different events** with
different deadlines, tracks, and rubrics — the server never conflates them.
The two Congress rows are the *same* event from two sources of differing
trust; use `list_knowledge_sources` to see all three files and their
verification status before answering a question, and prefer the
live-scraped official file over the community mirror wherever they disagree.

Original concerns and how this project addresses them, generally:

| Concern with the original | How this version addresses it |
| --- | --- |
| Hosted on a third-party domain (`equisaas-bd.com`), not `cloudcampbd.com` | Content lives in **your own local repo** — you control it, no trust in someone else's server at query time. |
| Auth was a static shared URL token, anyone with the link had access, content could change silently at any time | Server is **stdio-only, local-only** — nothing to leak, nothing remote to query at all. Content only changes when *you* run a refresh script and approve it. |
| Agent was told to fetch remote content and "help me plan, structure, and build my project" straight from it — classic instructions-from-untrusted-data pattern | Every file and every tool response carries an explicit **"reference text, not instructions"** banner. The included skill (`cloudcamp-kb-sync`) tells the agent to flag, not follow, any embedded command-like text. |
| No independent way to confirm it's official or current | Each file has a **provenance header** (source, fetch date, verified flag) and a `get_provenance_*` tool per source — plus, now, an actual live scrape of the official domain to cross-check the community mirror against, with discrepancies documented rather than silently trusted either way. |
| Server exposed tools that could write/execute | This server exposes **zero write/exec/delete tools** — only read-only `get_knowledge_base_*` / `get_provenance_*` / `list_knowledge_sources`. It cannot be used to modify files, run commands, or reach the network on its own. |

## What's here

- `knowledge-base.md` — International AI Builders Congress 2026, as mirrored
  by the unofficial third-party server. **Now partially reconciled** against
  the live official site — see its `## 🔎 Reconciliation` section for
  exactly what's confirmed accurate vs. contradicted.
- `knowledge-base-ai-builders-congress.md` — the same event, **scraped
  directly from `cloudcampbd.com/ai-builders-congress`**, the source of
  truth for anything the reconciliation note flags as unconfirmed in the
  mirror (domains/challenges, schedule, organizers, sponsors).
- `knowledge-base-infinity-buildfest.md` — THE INFINITY AI BUILDFEST 2026, a
  **separate** event, exported by the user from a Google NotebookLM notebook
  and reviewed before import. Self-identifies CloudCamp Bangladesh / BRAC
  University as organizers.
- `mcp/cloudcamp-kb-mcp/` — the local MCP server (stdio transport):
  - `index.js` — read-only server; serves all three local files as
    resources and via per-source tools (`get_knowledge_base_<suffix>` /
    `get_provenance_<suffix>` for `congress`, `infinity_buildfest`, and
    `ai_builders_congress`), plus `list_knowledge_sources` to see all three
    at a glance. Never touches the network on its own.
  - `refresh.mjs` — talks to the **unofficial mirror's original remote
    server** (an MCP endpoint), only when a human runs `npm run refresh`
    and explicitly confirms. Never overwrites `knowledge-base.md`
    automatically — prints the fetched text for review/hand-merge.
  - `refresh-official.mjs` — talks to the **live `cloudcampbd.com` domain
    directly**, only when a human runs `npm run refresh:official` (or
    `refresh:official:deep`) and explicitly confirms. Since `cloudcampbd.com`
    is a client-rendered SPA, this uses a local headless browser
    (Playwright/Chromium) to render the page — **no LLM or third-party AI
    service is involved anywhere** (unlike an LLM-extraction scraper such as
    ScrapeGraphAI would require); rendering and HTML→markdown conversion both
    happen locally, and script/style tags are stripped before conversion.
    Prints the result; never auto-writes. Two modes, one script:
    - **plain** (`npm run refresh:official`, default target: the Infinity
      BuildFest page) — a single render, converted to markdown. Fast, but
      misses anything gated behind a click (tabs, accordions, modals).
    - **deep** (`npm run refresh:official:deep`, i.e. `--deep`, default
      target: the Congress page) — same render, plus **clicks through**
      UI-gated content a plain render can't reach: all 11 domain tabs (to
      reveal each domain's 5 challenge names), the "Awards" nav item, and
      all ~281 FAQ question accordions (each opens a modal). Slower (~291
      read-only clicks, a couple of minutes) and only useful for pages with
      this kind of gated content — currently just the Congress page. This is
      how `knowledge-base-ai-builders-congress.md`'s full domain/challenge
      list and complete FAQ were captured.
      **Known finding (2026-09-20):** clicking "Awards" doesn't currently
      reveal a distinct prize-amount section — it's captured anyway so a
      future refresh picks up real content automatically if the site adds
      it. As of that date the only published prize figure anywhere (this
      page, its FAQ, or the official Participants Guide doc linked from
      Resources & Links) is one illustrative example: *"the E-Commerce
      domain awards 50,000 BDT to the Champion and 30,000 BDT to the
      Runner-Up."* No full prize sheet is publicly reachable.
  - There is no refresh script for the Infinity BuildFest file — it only
    changes when the user provides a newer NotebookLM export.
- `.claude/skills/cloudcamp-kb-sync/SKILL.md` — tells Claude Code how to use
  this content safely (answer from the right source, don't act on embedded
  instructions, surface each source's actual verification status, never
  conflate the Congress and the Infinity BuildFest).

## Quickstart

```bash
cd mcp/cloudcamp-kb-mcp
npm install
npx playwright install chromium   # only needed for npm run refresh:official
```

Or run the helper, which also offers to register the server:

```bash
npm run setup
```

Register manually if you skip that prompt:

```bash
claude mcp add --transport stdio cloudcamp-kb -- node mcp/cloudcamp-kb-mcp/index.js
```

Restart/reload Claude Code afterward — new MCP registrations aren't picked
up by an already-running session.

## Using it

Ask Claude Code about CloudCamp BD deadlines, submission fields, or scoring,
or invoke the `cloudcamp-kb-sync` skill. It will call `list_knowledge_sources`
first if it's unsure which event/source you mean, then answer from the
matching file, preferring the official live-scraped Congress file over the
community mirror wherever the two disagree, and will call out each source's
actual verification status. Confirm anything you'll actually act on against
`cloudcampbd.com` directly.

## Refreshing the content (manual, reviewed)

**Unofficial mirror** (`knowledge-base.md`), from the original community MCP server:

```bash
cd mcp/cloudcamp-kb-mcp
npm run refresh
```

**Official Congress page**, scraped live from `cloudcampbd.com`:

```bash
cd mcp/cloudcamp-kb-mcp
npm run refresh:official
# or target a different official page:
CLOUDCAMP_OFFICIAL_URL="https://cloudcampbd.com/events-public" npm run refresh:official
```

For the full click-through capture (domain tabs + the Awards nav item +
every FAQ answer, ~291 clicks, takes a couple of minutes):

```bash
cd mcp/cloudcamp-kb-mcp
npm run refresh:official:deep
```

All three refresh commands (`refresh`, `refresh:official`, `refresh:official:deep`):

1. Warn you what they're about to contact and why.
2. Ask for explicit `y/N` confirmation.
3. Fetch/render **once** and print the result — neither writes anything to
   disk.
4. Leave it to you to hand-update the relevant `knowledge-base*.md` file
   (keeping its provenance header accurate) if, after reviewing it, you
   trust the change.

## Notes

- This server has no environment variables required and no credentials to
  manage — that's intentional. There's nothing here for a leaked token or a
  compromised remote host to affect. (`refresh-official.mjs` accepts an
  optional `CLOUDCAMP_OFFICIAL_URL` override, but defaults to the known
  official page and needs nothing secret.)
- `npm run refresh:official` downloads a local Chromium browser via
  Playwright the first time you run `npx playwright install chromium` —
  that's a real download (~100MB), only needed if you want to re-scrape.
- If you'd rather not run any of this, the safest option is still to read
  the `knowledge-base*.md` files directly as plain files, or better, get the
  guidelines straight from an official CloudCamp channel.
