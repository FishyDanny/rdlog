# Show HN draft

Human rewrite required before posting: Hacker News currently prohibits generated or AI-edited comments.

## Title

Show HN: Rdlog, an append-only record of Australian R&D experiments

## First comment

I built Rdlog after reading the Australian R&D Tax Incentive guidance that records should be created when the activity is conducted.

You can open an experiment and append a hypothesis, method, observation, evaluation, conclusion or project note. Each entry is SHA-256 hash-linked to the previous one. Corrections are linked amendments rather than edits. The browser sends each hash to two OpenTimestamps calendars, stores their exact responses, and exports the record, hash chain, amendments and receipts as JSON.

It does not decide whether work is eligible, calculate a claim, provide tax advice, or prove anything to a regulator. Fresh OpenTimestamps responses are pending until upgraded and independently checked against Bitcoin. The app stores record content in Cloudflare D1 and keeps the bearer workspace token in the browser; the calendars receive hashes only.

The front end is React and TypeScript on Cloudflare Pages. The Hono API uses Cloudflare Workers and D1. Hashing and calendar requests happen in the browser.

I would value feedback on three points: whether the experiment vocabulary fits real engineering work, whether the pending-receipt limitation is clear, and whether the JSON export contains what an R&D adviser would need for review.

Live app: https://s72-rdlog.pages.dev
