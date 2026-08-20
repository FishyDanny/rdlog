# r/AusFinance draft — moderator approval required

Current community rule note: r/AusFinance prohibits promotion of an app owned by the poster. Do not post this unless the moderators give explicit prior approval. The product’s primary evidence is government guidance, not a Reddit post.

## Title

How are software teams keeping R&D experiment records while the work happens?

## Post

A recurring concern in Australian R&D Tax Incentive discussions here is contemporaneous evidence: keeping the technical record while experiments are running, rather than reconstructing it when the claim is due.

The government guidance puts it plainly: “Records should be created at the time the activity is conducted.” I wanted to see whether a small, focused tool could make that easier for a software team.

I built a free open-source experiment log that records a hypothesis, method, observation, evaluation, conclusion or project note. Entries cannot be edited through the app. Corrections are linked amendments, each entry is SHA-256 hash-linked to the previous one, and the browser captures exact responses from two OpenTimestamps calendars. The whole record exports as JSON.

This is record-keeping only. It does not determine R&D eligibility, calculate a refund, replace an accountant or adviser, prove that an entry is true, or carry ATO or department endorsement. Fresh calendar responses are pending until upgraded and independently verified against Bitcoin.

For people who have prepared or reviewed an R&D claim: is the experiment vocabulary close to the way your technical record is actually kept, and what would make the export more useful at review time?

Live app: https://s72-rdlog.pages.dev

Official source: https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/record-keeping-for-the-rd-tax-incentive
