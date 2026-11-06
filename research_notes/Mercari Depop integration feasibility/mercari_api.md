# Mercari seller/listing API situation, focused on Mercari US (as of 6 November 2026)

Method note: all pages were accessed 2026-11-06. Pages were read through a summarising fetch tool that limits verbatim quotes to about 125 characters, so quotes below are exact but partial, and the wording around them is paraphrase. "Snippet only" means the fact came from a search result and the page itself was not opened.

## Does Mercari US have an official public seller/listing API or partner program?

### Takeaway
No official Mercari US seller API, developer portal or partner program was found, and Mercari US's own help pages describe no such route. This is an absence of evidence, not a Mercari statement: no Mercari page saying "we have no API" was found either. The only official crosslisting route is a one-way, desktop-only import into Mercari drafts, with no sync, delist, sold-status or webhook capability.

### Cited Findings
- Vendor statement (not Mercari): "Mercari does not have an official API for sellers". The vendor says it instead "uses a browser extension that automates your own logged-in session". Undated FAQ; the page's latest dated item is 2026-10-31 — [Sell The Flip](https://selltheflip.com/marketplaces/mercari)
- A crosslisting vendor's comparison (updated 2026-10-07) says Flyp "uses a Chrome extension for crosslisting, delisting, and sales tracking". Its footer names eBay, Etsy and Depop APIs but not Mercari, and says the app "is not endorsed or certified by Mercari, Inc." — [Nifty](https://nifty.ai/post/mercari-cross-listing)
- Vendoo's current Mercari connection path appears to be a Chrome extension: Vendoo Crosslist Extension v3 covers 10+ marketplaces including Mercari (snippet only) — [Chrome Web Store](https://chromewebstore.google.com/detail/vendoo-crosslist-extensio/mnampbajndaipakjhcbbaihllmghlcdf)
- Conflicting vendor claim: a search summary reported Closo and Vendoo claiming secure OAuth connections with Mercari, with Closo calling its integration official (snippet only, not confirmed against any Mercari document) — [Closo](https://closo.co/blogs/platform-specific-guides/mercari-crosslist). This conflicts with Sell The Flip above and with the absence of any Mercari developer documentation. Treat as unverified marketing.
- Official import tool: "Currently the tool supports imports from eBay, Poshmark and Depop only." — [Mercari Cross-listing Tool Import FAQ](https://www.mercari.com/us/help_center/article/609/)
- Same FAQ: desktop browsers only, not the app. Prices must be $1 to $2,000. Duplicates are removed automatically. Imports land in drafts and must be activated; items missing information go to "Action Required". Later changes to the original do not carry over, and items must be updated individually. The page has no third-party-tool language and no release date — [Mercari FAQ](https://www.mercari.com/us/help_center/article/609/)
- Capability summary for Mercari US, official route: create = import to draft only; update = none; delist = none; read sold status/orders = none; webhooks = none. No published API cost, because no API was found. Derived from the [Mercari FAQ](https://www.mercari.com/us/help_center/article/609/); the "no sold sync" point is confirmed by [Value Added Resource, 2024-04-01](https://www.valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop/)

### Inferences
- There is no self-serve official API route for Velista on Mercari US. Create, update, delist and sold-status automation are all unavailable through documented means.
- The one official, ToS-clean path is indirect: Velista posts to eBay or Depop, and the user runs Mercari's desktop import. This gives a Mercari draft only. It does not fit a mobile-only flow and gives no auto-delist, so a Mercari sale would have to be delisted manually, or detected by some other means.
- Private partner deals could exist without being public. Management's reported interest in "partnerships" (see the status question below) gives a possible reason to ask, but nothing suggests that means listing-tool partners.

### Gaps
- No Mercari statement confirming or denying an API or partner program was found. A direct enquiry to Mercari US business development is the only way to settle this.
- Whether any crosslister has a private Mercari agreement could not be verified.
- Mercari US developer-domain probing and the Mercari engineering blog were not checked in this pass.

## What exists in Japan, and can US sellers or non-Japan businesses use it?

### Takeaway
Mercari Shops (Japan) has a real, documented GraphQL API with products, orders and webhooks, but it serves Japanese B2C shops, requires a fixed IP address in Japan, and does not reach Mercari US listings. It is not a route to Mercari US.

### Cited Findings
- Endpoints: production `https://api.mercari-shops.com/v1/graphql`, sandbox `https://api.mercari-shops-sandbox.com/v1/graphql` — [Mercari Shops API docs](https://api.mercari-shops.com/docs/index.html)
- Network requirement: "日本国内の固定IPアドレスである必要があります。他社と共有しているIPアドレスは使用不可となります。" (Must be a fixed IP in Japan; IPs shared with other companies cannot be used.) IP ranges are not allowed, and unregistered IPs get a 404 — [docs](https://api.mercari-shops.com/docs/index.html)
- Client identity: each API client needs a name supplied by Mercari at contract time, plus a User-Agent of `<API_CLIENT_NAME>/<VERSION>`. This indicates a contract step rather than purely self-serve access — [docs](https://api.mercari-shops.com/docs/index.html)
- Auth: Personal API Access Token issued from the shop admin page, sent as a bearer token; it identifies the shop. Up to 10 tokens, no expiry. Webhook operations need an admin or owner token — [docs](https://api.mercari-shops.com/docs/index.html)
- Capabilities: product create, update, batch update, delete, variants and stock; order and transaction queries, shipments, tracking, cancellation; inquiries and messages; webhook create, list, delete. Auctions and country restrictions are sandbox-only for now, for registered shops — [docs](https://api.mercari-shops.com/docs/index.html)
- Webhooks include `order_transaction_created`, `order_transaction_paid`, `order_transaction_canceled`, `order_transaction_message_created`, `order_cancellation_completed`, `product_administrator_deleted`, `inquiry_message_created`, `inquiry_resolved`. `order_created`, `order_paid` and `order_canceled` are deprecated — [docs](https://api.mercari-shops.com/docs/index.html)
- Rate limit: 10,000 points per hour per shop, shared across tokens. Query cost cap is 2,000 per request; over-limit returns HTTP 400 `TOO_MANY_REQUESTS` — [docs](https://api.mercari-shops.com/docs/index.html)
- Planned change: a cart feature needs a new API group. Existing order-management APIs assume one item per order and will be retired after a transition; listing-only users need no migration — [cart migration PDF](https://api.mercari-shops.com/docs/mercari-shops-api-cart-G8Ko5urichtHGSZy6ayAx3.pdf) (snippet only; date not verified)
- Third-party Japanese EC tools have integrated, for example Sukeneko (2023-2024) — [Sukeneko press release](https://www.sukeneko.com/press/pdf/press_20231220.pdf) (snippet only)
- Shop eligibility: sole proprietors who have filed a business-opening notice, and legally recognised corporations. Opening is free; the fee is 10% of the sale price plus transfer fees. Bank account and address must match the business. Information as of October 2025 — [Mercari Shops news site](https://jp-news.mercari.com/mercari-shops/info/52487) (snippet only; the search returned several articles from this site and the exact article for each point was not confirmed)
- Japan-to-overseas selling is supported in the other direction: shops can reach 120+ countries and regions using domestic operations (snippet only, same site). Mercari IR says the focus is "direct crossborder transactions through the global app", which lets overseas users buy Japanese items — [Mercari IR FAQ, as of September 2026](https://about.mercari.com/en/ir/faq/)
- The community package `mercapi-shops` is an unofficial client, not a Mercari SDK — [PyPI](https://pypi.org/project/mercapi-shops/0.0.4/)

### Inferences
- A US seller's Mercari US listings cannot be managed through this API: it authenticates Mercari Shops shops only, and nothing in the docs mentions Mercari US. This is inferred from the docs' scope, not stated by Mercari.
- For Velista it would only matter if it served Japan-based business sellers. That needs a Japanese fixed IP, a Mercari contract step, and sellers who qualify under Japanese rules. It is out of scope for a US launch.
- The API shows what Mercari can offer when it chooses to: full listing and order webhooks. That is useful as a reference point in any conversation with Mercari US, not as evidence a US API is coming.

### Gaps
- Whether a foreign corporation can open a Mercari Shops shop, or needs a Japanese address or bank account, could not be verified. The search results do not settle it.
- The formal API application procedure, API fees and API terms were not found. The docs page has no terms section, and only the first 100,000 of about 284,000 characters of the docs were read.
- `api.mercari.jp` and any public API for the Japanese C2C Mercari app could not be verified. No official documentation for either was found; this was not exhaustively checked.

## How do Mercari US and Mercari Japan differ as companies and platforms?

### Takeaway
They are separate segments of one group, with separate legal terms and different market scale. The US is a C2C-only marketplace with US-law terms and no found B2C shop or API layer, while Japan has the larger marketplace plus Mercari Shops and fintech.

### Cited Findings
- Mercari's IR page lists "Mercari (US)" among group companies and treats the US as one of three segments, described as "US (the C2C marketplace Mercari in the US)". It does not state ownership or say whether platforms are shared. As of September 2026 — [Mercari IR FAQ](https://about.mercari.com/en/ir/faq/)
- US positioning: "a cross-category C2C service that offers a variety of shipping options" — [Mercari IR FAQ](https://about.mercari.com/en/ir/faq/)
- US terms: contracting entity Mercari, Inc.; California governing law; San Francisco courts for non-arbitrated disputes; AAA binding arbitration under the Federal Arbitration Act — [Mercari US Terms of Service](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/)
- Scale: US FY2026 (year to June 2026) GMV $810 million, revenue ¥40.7 billion, core operating profit ¥2 billion — [Value Added Resource, 2026-08-10](https://www.valueaddedresource.net/mercari-q4-2026-earnings/). Group FY2026 revenue ¥229.2 billion, operating profit ¥43.9 billion, reported 5 August — [BigGo Finance](https://finance.biggo.com/news/687e403e-284f-4201-98e4-f0f76a6333ae) (snippet only; secondary source)
- Japan has its own help centre and rules, including an English prohibited-conduct guide — [Mercari Japan Help](https://gl.help.jp.mercari.com/en/guide/articles/gl_0053) (snippet only)

### Inferences
- US revenue is about 18% of group revenue (¥40.7bn of ¥229.2bn). Mercari US is therefore a smaller, break-even-focused unit, which may partly explain limited seller tooling; that link is speculation.
- A Mercari Japan relationship would not automatically grant Mercari US access, given the separate terms and operations.

### Gaps
- The legal ownership chain could not be verified from pages read. From background knowledge, not sourced here: the US company is a wholly owned subsidiary of the Tokyo-listed parent, and both use the English name "Mercari, Inc.", which can confuse sources.
- Whether the US and Japan share any code or infrastructure was not found. Accounts being separate between the two is expected but not verified here.

## What do Mercari's terms and prohibited conduct rules say about bots, scraping, automated listing and third-party tools?

### Takeaway
The Prohibited Conduct policy bans any "automated means or interface not provided by us", which on a plain reading covers session-automation crosslisters. The penalties include suspension, held funds and bars from future services. No Mercari statement naming crosslisting tools was found, and no documented enforcement against them was found either.

### Cited Findings
- Core clause, in the "Interfering with the operation of the Service" bullet: "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us". It covers accessing the Service or extracting data (that last part is paraphrase) — [Mercari Prohibited Conduct](https://www.mercari.com/us/help_center/article/341/)
- Same list: "Creating multiple listings of the same item" and "Excessive reposting of previously listed items" — [Prohibited Conduct](https://www.mercari.com/us/help_center/article/341/)
- The page has no API or third-party-tool language. Dates shown are 1/23/2023, 11/12/2021 and 6/29/2020. Mercari says it may update the list from time to time (snippet only) — [Prohibited Conduct](https://www.mercari.com/us/help_center/article/341/)
- Enforcement on that page: Mercari may verify users or listings ("We may contact Users or utilize a third party verification service to verify a User, an account or listing information."), remove items, block access, suspend users, and hold funds after suspension or termination to cover chargeback or refund risk. "Mercari may prohibit a user that is terminated for engaging in any prohibited conduct" from future services (end of sentence paraphrased) — [Prohibited Conduct](https://www.mercari.com/us/help_center/article/341/)
- Terms of Service, current version: "Effective November 5, 2026", with the prior entry "Updated February 24, 2025" — [Mercari US ToS](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/)
- A fetch of the ToS found no explicit bot, automated-means or API language. The relevant clauses are below — [Mercari US ToS](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/)
  - Section 8, "Don't Try to Harm Our Systems": "any activity that provides an excessive burden on the Services"
  - "Mercari hereby grants you a personal, limited, revocable, non-transferable license to use the App and Website."
  - "You may not rent, lease, lend, sell, redistribute or sublicense the App or Website."
  - "You may not copy, decompile, reverse engineer, disassemble, attempt to derive the source code of"
  - "attempt to disable or circumvent any security or other technological measure"
  - "We may refuse service to anyone and may terminate or suspend your Account" and "at any time, for any reason, without notice unless required by law."
- The ToS points to Help Center policies, including Prohibited Conduct, so the bot clause is incorporated by reference (snippet only) — [mercari.com/tos](https://www.mercari.com/tos). Direct fetches of that URL returned HTTP 403.
- Account consequences: "if the behavior is too risky or repetitive we may close your account." Prohibited Conduct is a listed trigger; bots are not mentioned — [Why was my account limited or closed?](https://mercari.com/us/help_center/article/162)
- Import tool condition, as quoted by a trade outlet: "make sure all listing text and images are your own." — [Value Added Resource, 2024](https://www.valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop/)
- Enforcement evidence: one targeted search surfaced no report of Mercari banning accounts for Vendoo-style tools. Those results were mostly vendor marketing, and Reddit content did not surface, so this is weak negative evidence. Community source, unopened: [Export Your Store, "Mercari banned", 2025-10-29](https://exportyourstore.com/blog/mercari-banned)

### Inferences
- A cloud bot or browser extension acting on a user's Mercari session is very likely an "automated means or interface not provided by us", even with the user's consent. Session automation by Velista would put the user's account, and held funds, at risk. This is a reading of the text, not legal advice and not a Mercari ruling.
- The clause targets the user ("By using our Service, you agree"), so the immediate exposure sits with Velista's users. Velista's own exposure (for example inducing breach, or reverse engineering of private app APIs) needs legal review.
- Reverse engineering Mercari's mobile API would additionally hit the reverse-engineering and circumvention clauses, and is the worst option.
- A mobile app is also a poor fit technically: the workarounds confirmed here (Flyp, Sell The Flip) rely on desktop Chrome extensions. Nifty describes cloud automation, but how it connects to Mercari was not stated.
- Tolerance is the observed state: multiple crosslisters openly advertise Mercari support in 2026. Tolerance is not permission, and Mercari can change it without notice under its termination language.
- A human-in-the-loop design (Velista prepares the text and photos; the user pastes and posts in Mercari) appears to stay outside the automation clause, because the user performs the action. Inference; confirm with counsel.

### Gaps
- What changed in the 5 November 2026 ToS was not determined; it took effect the day before this research. No coverage was found. Compare it against the 24 February 2025 version, specifically for automation or AI-agent language.
- The ToS check depended on a summarising tool. Someone should read the full text directly before relying on "no explicit bot language".
- A search summary cited a "July 5, 2026" ToS date from ConductAtlas. The [ConductAtlas page](https://conductatlas.com/platform/mercari/) itself shows no captured ToS versions, so that date is rejected in favour of Mercari's own page.
- No official Mercari statement on crosslisters or third-party listing tools was found.
- Reseller community reports (Reddit r/Flipping, r/Mercari) could not be reached, so ban rates are unknown.

## Current status as of late 2026: fees, restructuring, market exits, new seller tools, new API, crosslisting announcements

### Takeaway
Mercari US is stable and growing again, under a new US CEO since July 2026, with a 10% seller fee and a ToS update on 5 November 2026. No market exit, new API or new bulk-listing tool was found. The last official crosslisting move found is the import tool from 2024, later extended to Poshmark.

### Cited Findings
- Fees: 10% selling fee on item price plus buyer-paid shipping for listings created or updated on or after 2025-01-06; 3.6% Buyer Protection fee. Article marked updated 10/23/2026 (snippet only) — [Fees on Mercari](https://www.mercari.com/us/help_center/article/169/)
- No extra payment processing fee under the structure (snippet only) — [Mercari fee FAQ](https://www.mercari.com/us/help_center/article/2518/). Some third-party guides still show older processing fees; treat those as outdated.
- IR confirms a seller fee plus a 3.6% buyer protection fee, as of September 2026 — [Mercari IR FAQ](https://about.mercari.com/en/ir/faq/)
- Q4 FY2026: US GMV up 15% to $208 million, down from $211 million in Q3; MAU 4.2 million, up 4% year on year. Full-year GMV $810 million, up 11%, which the outlet says is still about 20% below fiscal 2023. Core operating profit more than doubled to ¥2 billion — [Value Added Resource, 2026-08-10, updated 2026-08-23](https://www.valueaddedresource.net/mercari-q4-2026-earnings/)
- Leadership: Jeff LeBeau, formerly VP of Growth, became US CEO on 1 July 2026; Group CEO Shintaro Yamada will focus more on longer-term US strategy — [Value Added Resource](https://www.valueaddedresource.net/mercari-q4-2026-earnings/)
- FY2027 US plan: "at least 10% US GMV growth while continuing to operate around break-even", with bundle and basket-size work and more activity outside Entertainment & Hobbies and fashion. Long-term ambition of "20% to 30% or more", and exploring partnerships that could accelerate growth — [Value Added Resource](https://www.valueaddedresource.net/mercari-q4-2026-earnings/). The 10% target is also in the [Mercari IR FAQ](https://about.mercari.com/en/ir/faq/).
- Smaller AI-assisted teams will work on features, US UI/UX, customer service and fraud prevention. That article does not mention crosslisting or AI listing — [Value Added Resource](https://www.valueaddedresource.net/mercari-q4-2026-earnings/)
- Other recent items: shipping rate increases and free shipping for some trading cards (October 2026, snippet only) — [Value Added Resource](https://www.valueaddedresource.net/mercari-shipping-rates-october-2026/). Mercari absorbs half of a new $50 USPS HAZMAT noncompliance fee — [Value Added Resource](https://www.valueaddedresource.net/mercari-q4-2026-earnings/)
- Crosslisting history (older): the AI-powered importer launched around April 2024 for eBay and Depop, with one-time imports and no inventory sync, alongside the since-replaced "Zero Selling Fee" structure — [Value Added Resource, 2024-04-01](https://www.valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop/). The current FAQ adds Poshmark — [Mercari FAQ](https://www.mercari.com/us/help_center/article/609/)
- Vendor observation, 2026-10-07: "Mercari doesn't have built-in crosslisting tools" beyond the importer's scope (the vendor's wording does not mention the importer) — [Nifty](https://nifty.ai/post/mercari-cross-listing)

### Inferences
- No sign of a US market exit. The group targets US growth and the segment is profitable, so Mercari US is a viable long-term channel.
- Mercari's stance looks like it wants inbound listings (the importer) but provides nothing that helps sellers leave or sync. That fits a supply-acquisition goal, though Mercari has not said so.
- New leadership from a growth background, plus stated interest in partnerships, makes late 2026 a reasonable moment for a low-cost partnership enquiry. Expect low odds of a reply for a small startup.
- Velista's safest near-term position is to treat Mercari as manual-assist or import-assisted, and not to promise auto-delist on Mercari.

### Gaps
- The primary Mercari FY2026 earnings materials were not opened; figures come from Value Added Resource and BigGo. Some quarterly figures differ between secondary sources.
- The date Poshmark was added to the importer was not found. A competitor claim of a 3,000-listing import limit (Vendoo, snippet only) was not confirmed by Mercari.
- No evidence was found of a 2026 Mercari bulk-listing tool or new API. Searches were limited, and this cannot rule out an unannounced or very recent change.
- No information was found on layoffs or restructuring at Mercari US in 2026.
