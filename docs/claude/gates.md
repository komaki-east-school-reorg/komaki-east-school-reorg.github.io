# 機械で確かめる決まり（auto_gates.py）

> `CLAUDE.md` から移した詳細（2026-11-28）。この作業をするときに読む。要点と禁止事項は `CLAUDE.md` にある。

## Machine-checked invariants (`.github/scripts/auto_gates.py`)

Beyond the auto-update pipeline's scope and evidence checks, these run site-wide on every gate invocation and are the things most likely to be broken by an innocent-looking edit:

| # | Check | Why it exists |
|---|---|---|
| 3 | `ja` and `en` have identical key sets | `i18n.js` skips `ja.json` for non-Japanese languages and relies on this |
| 4 | No `ja-kids` line exceeds 65 mora | Kids mode targets 3rd-grade reading; splitting sentences matters more than opening kanji |
| 5 | `data/i18n/pages/` is up to date | A stale page dictionary serves old text with a 200 and cannot be caught at runtime |
| 6 | External links (city / MEXT / Instagram) | Each domain is confined to its permitted URLs, and MEXT/Instagram additionally to their permitted pages |
| 8 | Timelines are in ascending `data-start` order | Both lists are append-targets; an out-of-order entry silently misstates when things happened |
| 9 | schedule.html ⇔ events.json agree for every event not yet over | The top-page bar and the calendar are drawn from events.json; the schedule list is hand-written HTML. Each list item's `data-start`〜`data-event-date` must contain an events.json date and vice versa |
| 10 | `now_text` marks every date with `data-past` / `data-until` | The いまの状況 box is prose; without the marks a passed date silently stays on the top page |
| 11 | Every page (except the `voices.html` redirect) carries `#share` / `#share-buttons` | The share buttons and the sticky bar are built only where that section exists; `clubs.html` shipped without it and nobody noticed until a reader did (2026-10-05) |
| 12 | Every root `*.html` is in `files.txt`, and every page except `voices.html` / `404.html` is in `sitemap.xml` with the 13 hreflang links in the `?lang=` form | Both files are hand-maintained; a page missing from the sitemap (or a broken hreflang) silently drops it — and its 11 translations — from search |
| 13 | `events/*.html`, the `id`/🔗 on each schedule item, and the sitemap's EVENTS block match `schedule.html` (`build_event_pages.py --check`) | A stale event page keeps a changed date in search results |
| 13b | `qa/*.html`, the link on each Q&A item of `faq.html` / `bus.html`, and the sitemap's QA block match the dictionary (`build_qa_pages.py --check`) | A stale Q&A page keeps the old answer in search results (2026-11-14) |
| 14 | `feed.xml` matches its data (`build_feed.py --check`) | Adding a changelog line by hand without rebuilding leaves the feed behind |
| 15 | Every page except `index` / `site` / `voices` / `404` lists at least one city, one prefecture and one national department plus the library block, and every number `contacts.json` says is shown on a page is really there | The user asked for all three levels on every page (2026-10-11); a department added to the HTML but not to `contacts.json` would escape the weekly number check |
| 17 | `data/child_estimate.json` matches `data/official_pages/population/` (`build_child_estimate.py --check`), its daily movement is at least 0.1, and the population files come only from the city's population-statistics pages | The top page shows the estimate to one decimal place so that it changes every day (2026-10-22); a stale or flat estimate would silently break that |
| 18 | No avoided spelling from `data/term_rules.json` appears in any dictionary, headline translation, event label or community-action field | English had Tokadai East and Tokadai Higashi for the same school (2026-10-23); a fix without a rule would drift back with the next translation |
| 6b | Every URL in `*.html`, `events/*.html`, `js/*.js`, `sw.js`, the dictionaries, `events.json`, `community_actions.json` and `headline_i18n.json` — after undoing HTML entities, JSON escapes and %-encoding — has a host in `PERMITTED_HOSTS`, and every `www.city.komaki.aichi.jp` URL has a path in `CITY_PATHS`; no `javascript:` / `data:` / `vbscript:` URL anywhere | Check 6 only looked for known domains, so `https://evil.example`, `//evil.example`, upper-case or entity-encoded hosts and `…/x.pdf#303/index.html` all passed (2026-10-26). **A new domain has to be added to `PERMITTED_HOSTS` too** |
| 19 | Dictionary HTML uses only `strong br small a span p li dt dd ul b em wbr` with `href target rel style class data-past data-until`; `href` is https / in-site / `#` / `tel:` / `mailto:`; `style` has no `url()`/`expression`; headline translations, event labels and community actions carry no tags at all | `data-i18n-html` goes straight into `innerHTML`; an `<img onerror>` drafted by the AI used to pass every gate (2026-10-26) |
| 19b | No HTML character reference (`&amp;` `&lt;` `&quot;` `&#…;` …) in a dictionary value that is shown as text (`data-i18n`, `-aria`, `-alt`, `meta_*`, keys main.js inserts as `data-i18n`), nor in `site-updates.json` / `events.json` / `community_actions.json` / `headline_i18n.json` | Those go in via `textContent`, so 「Q&amp;A」 showed literally on the top page (`ql_faq_p` / `ql_bus_p`, 2026-11-07, user's instruction). Write a plain `&`; only `data-i18n-html` values may use entities |
| 20 | No token-like string (`sk-ant-`, `ghp_`, `github_pat_`, private keys…) in any changed file | Last net against an AI writing a credential it could read into a public file (2026-10-26) |
| 22 | Lines the auto-update drafter adds to `data/site-updates.json` only prepend (≤2), leave every existing line untouched, and follow the changelog format | The drafter may log its own change (2026-11-04); the hand-written history and the scripts' `auto_key` lines must never be rewritten by an AI |
| 24 | Every `.ill-steps` / `.rev-steps` card links to an `#id` that exists on its page | Pages change and the cards under the TOC have to follow (2026-11-07) |
| 25 | `calendar.*.ics` matches the data (`build_calendar.py --check`) | A stale subscription calendar silently shows old dates in readers' own calendars (2026-11-07) |
| 23 | `data/search/*.json` matches the dictionaries and the pages (`build_search_index.py --check`) | A stale search index shows old wording or jumps to a section that no longer exists (2026-11-05) |
| 26 | Every `link` in `data/site-updates.json` points at an existing page and `#id` | Changelog lines link to the corner they are about (2026-11-10); a removed section must not leave dead links |
| 27 | `data/crosslinks/*.json` matches the search index (`build_crosslinks.py --check`) | The related links are computed from the page text (2026-11-10); a stale file points at removed sections or misses new ones |
| 28 | Every `data-i18n*` key in the HTML exists in `ja.json` (`site_lint.missing_keys()`) | A key with no dictionary entry keeps its inline Japanese in every language and nobody notices (2026-11-11) |
| 29 | Every in-site link (`page.html#id`, `#id`) in `*.html` and in dictionary values points at something that exists (`site_lint.broken_links()`; runtime ids `faq-qN` / `toc-<key>` and the old anchors MOVED ANCHORS forwards are accepted) | Sections get renamed and moved; a dead in-page link fails silently (2026-11-11) |
| 30 | `llms.txt` / `llms-full.txt` match the search index (`build_llms.py --check`) | AI assistants would quote removed sections or old wording (2026-11-24) |
| 31 | (warning only) the static JSON-LD block in each page is current (`build_static_seo.py --check`) | Crawlers that run no JavaScript read only this copy (2026-11-24) |
| 21 | review.html's 25 key-point cards (10 findings, 15 proposals), their 「くわしく →」 targets, `REVIEW LINKS` in `js/main.js` and the links between review.html and analysis.html all agree | The two pages are read as one: a key point must land on its evidence and every evidence card must lead back (2026-10-31) |
