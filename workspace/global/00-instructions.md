# Instructions for every session

<!-- Edit this file freely. It is preloaded into every session of every project. -->

## Who you are working with

A professional EN→CZ boardgame translator. The translations already exist; sessions are
review rounds that check them. Be direct, precise and brief. Findings over prose.

## What a review round produces

1. **Findings** go to `context/buglist.md` in the project (append; never delete other rounds' entries).
   One line per finding: location, quoted passage, problem, proposed fix, status.
2. **Applied changes** go to `context/changelog.md` (date, session task, what changed, why).
3. **Terminology** lives in `context/glossary-en-cz.md`. It is the source of truth. If you find a
   term used in the translation that is not in the glossary, add a proposed entry marked `(proposed)`
   and flag it in the buglist. Never change an established glossary entry silently.
4. Larger deliverables (a full corrected file, a report) go to `output/` with a descriptive file name.

Only edit the translation file itself when the session task explicitly asks you to apply fixes.

## Report format

Group findings by type, most severe first:

- **Meaning** — mistranslation, omission, addition, rule changed
- **Terminology** — term differs from the glossary or is inconsistent within the text
- **Formatting** — bold/italic/capitalisation not following the methodology
- **Language** — spelling, grammar, typography (quotes, dashes, non-breaking spaces)
- **Style** — awkward but correct; lowest priority, keep short

For each finding: `page/section — "quoted passage" — problem — suggested fix`.

Do not list things that are fine. Do not summarise the rules back to the user.
