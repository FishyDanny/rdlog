# Product Hunt draft

## Tagline

Record Australian R&D experiments while the work is happening

## Description

Rdlog keeps an append-only record of hypotheses, methods, observations, evaluations and conclusions. Entries are SHA-256 hash-linked, corrections stay visible as amendments, two OpenTimestamps calendar responses are retained, and the full record exports as JSON. It is record-keeping only, not tax advice or eligibility proof.

## First comment

Australian Government guidance says R&D Tax Incentive records should be created when the activity is conducted. Rdlog gives technical teams a small place to do that without turning the record into a claim calculator.

The browser opens a bearer-token workspace. Each experiment entry is hash-linked to the one before it and submitted as a hash to two OpenTimestamps calendars. Corrections are additional linked records. The JSON export includes the original entries, amendments, hashes and exact base64 calendar responses.

There are deliberate limits. Rdlog does not assess eligibility, provide tax advice, verify that an entry is true, or claim government endorsement. A fresh calendar response is pending until upgraded and independently verified against Bitcoin.

I would like feedback from people who document technical experiments or review R&D records: are the entry types useful, are the receipt limits clear, and what is missing from the export?

## Suggested topics

- Developer Tools
- Productivity
- Open Source
