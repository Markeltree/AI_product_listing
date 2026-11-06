# Build Depop now, keep Mercari manual

Depop can be integrated properly; Mercari US can only be integrated partly. Depop has an official, free connection for outside software (an "API"), and its documents name crosslisting tools as an intended user. If Depop approves Velista, the app can post, edit and delist on Depop and hear about sales there, which matches what Velista already does on Etsy and eBay. Mercari US has no such connection that we could find, and its rules ban automated tools that Mercari did not provide. The crosslisters that explain how they reach Mercari use browser add-ons or log in as the seller, and on a plain reading both break those rules, which puts the seller's account and money at risk. We recommend applying to Depop this month and offering Mercari as a helped manual flow: Velista writes the listing, the seller posts it, and Velista tells the seller when to take it down. Velista should not promise automatic delisting on Mercari. The biggest unknown is whether Depop will accept a small startup, because it publishes no acceptance rules or timeline. This report reflects research as of 6 November 2026 and is not legal advice.

## At a glance: Depop covers every step except video, Mercari covers none

| What Velista needs | Depop | Mercari US |
|---|---|---|
| Official connection for sellers' tools | Yes, private; apply by email | None found |
| Post a listing | Yes | Seller posts by hand, or one-way import to a draft on desktop |
| Edit a listing | Yes | Seller only |
| Delist automatically | Yes | No |
| Learn that an item sold | Yes, close to real time | No |
| Video | No; 1 to 8 photos only | Not researched |
| Are crosslisting tools allowed? | Yes, under Depop's rules | Rules ban automation not provided by Mercari |
| Cost to Velista | Free by default | No official route to price |

## Depop: an official route exists, if Depop lets Velista in

### The API is private, but it is built for tools like Velista

Depop's "Selling API" has public documents, but the login details are not public. The site says the API is **"currently private and is not available to the general public"** and asks interested companies to get in touch ([Depop](https://partnerapi.depop.com/api-docs/)). The contact address is business@depop.com ([Depop help](https://depophelp.zendesk.com/hc/en-gb/articles/4411154329233-Selling-as-a-charity-or-business)).

The important detail is who it is for. Depop describes one sign-in method as being **"for third-party applications (such as cross-listing tools) that will be used by multiple sellers"** ([Depop](https://partnerapi.depop.com/api-docs/concepts/authentication/)). That is Velista's exact model: each seller taps "connect", logs in on Depop's own page and grants permission, so Velista never sees their password.

Access is **free by default**, although Depop can add fees with 60 days' written notice ([Depop terms](https://partnerapi.depop.com/api-docs/terms/)). Depop also checks the applicant: proof of bank account ownership, identity and employment with the company are all part of onboarding (same source).

No minimum seller count, acceptance rules or timeline are published. Depop's language about "enterprise partners" ([Depop](https://partnerapi.depop.com/api-docs/openapi.yaml)) and "high-volume sellers" ([Depop](https://partnerapi.depop.com/api-docs/why-depop/)) suggests it may favour larger companies, but that is our reading. We found no account of a small startup applying.

### It does nearly everything Velista needs, except video

The API can create, edit and delete listings, mark items sold, and read orders ([Depop](https://partnerapi.depop.com/api-docs/reference/)). It also sends Velista an instant message, called a webhook, when a new order arrives. Delivery is not guaranteed, so Depop tells partners to run a regular backup check as well ([Depop](https://partnerapi.depop.com/api-docs/concepts/webhooks/)). Together these cover cross-platform auto-delist in both directions. The limits are far above what a startup would reach: 200 listing requests per 10 seconds for each seller ([Depop](https://partnerapi.depop.com/api-docs/concepts/rate-limits/)).

Four product details need attention. **Video is not supported**: the word does not appear anywhere in the API's technical specification ([Depop](https://partnerapi.depop.com/api-docs/openapi.yaml)), so Velista's video can only be a source of up to 8 still photos. **Brand and condition are required**, and descriptions stop at 1,000 characters, so the AI must always produce fitting output ([Depop](https://partnerapi.depop.com/api-docs/reference/)). **Depop's category list is not served through the API**, and the place it is downloaded from has anti-bot protection ([Depop](https://partnerapi.depop.com/api-docs/concepts/taxonomy/)), so Velista should ask Depop for a supported copy. **Country coverage is unconfirmed**: the UK and US look safest, and Australia needs checking with Depop ([Depop](https://partnerapi.depop.com/api-docs/why-depop/)).

### Crosslisters are moving onto the official API

Vendoo announced in July 2026 that its Depop connection **"now runs on the official Depop API"** and that it is retiring its older add-on method ([Vendoo](https://blog.vendoo.co/new-depop-api-integration)). Crosslist claims a private API partnership with Depop ([Crosslist](https://crosslist.com/blog/are-cross-listing-apps-safe)), and Nifty's connection steps look like the official flow ([Nifty](https://docs.nifty.ai/connections/connecting-depop.md)). Smaller tools show the other side: FlowLister says Depop is manual for it and that it is not an approved partner ([FlowLister](https://flowlister.com/how-crosslisting-works/)). Depop publishes no partner list we could find, so these are the companies' own claims.

### The official route is safe, and the unofficial routes are not

Depop's seller terms allow listing elsewhere "via third party cross-listing platforms", but they ban bots and other third-party software on the service. Sellers also stay responsible for removing sold items ([Depop terms of service](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service)). We could read those terms only through a search excerpt, so someone should confirm them directly. We found no public case of Depop acting against a crosslisting tool, though we could not check Reddit, where such reports would appear.

The API contract has its own limits. Partners cannot use browser add-ons or scraping without written permission, and cannot use Depop's content to train AI without written permission. Depop can also end the agreement on 30 days' notice ([Depop terms](https://partnerapi.depop.com/api-docs/terms/)). Velista's AI works from the seller's own photos and voice, which looks fine, but a lawyer should confirm that no Depop data reaches model training.

### eBay now owns Depop, and API work has continued

eBay's purchase of Depop from Etsy closed on 30 July 2026, for about $1.4 billion in total ([Etsy 10-Q](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000092/etsy-20260930.htm)). eBay says Depop keeps its own brand and platform, and its CEO stays ([Depop](https://news.depop.com/ebay-completes-acquisition-of-depop/)). The API has received updates every month since, most recently in October 2026 ([Depop](https://partnerapi.depop.com/api-docs/changelog/)). We found no statement on whether eBay will change partner access, so that remains an open risk.

## Mercari US: no official way to automate anything

### No API was found, and the Japanese one does not help

We found no Mercari US seller API, developer site or partner program. Competing vendors say the same ([Sell The Flip](https://selltheflip.com/marketplaces/mercari); [FlowLister](https://flowlister.com/how-crosslisting-works/)). This is absence of evidence, because Mercari has not said so itself. One vendor, Closo, has been reported as claiming an official Mercari connection ([Closo](https://closo.co/blogs/platform-specific-guides/mercari-crosslist)), but its own help page says Mercari runs through its Chrome add-on ([Closo](https://help.closo.co/a/how-the-crosslister-works)). We treat that claim as marketing.

Mercari's only official crosslisting feature is an import tool, and it brings listings in from eBay, Poshmark and Depop only. **Etsy is not supported.** It works on desktop browsers, not the app. Items land as drafts the seller must finish, and later changes do not carry over ([Mercari](https://www.mercari.com/us/help_center/article/609/)). A sale elsewhere does not sync to Mercari either ([Value Added Resource](https://www.valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop/)).

Mercari Japan does have a real API for its Mercari Shops business product, but it requires a fixed internet address in Japan and a contract step ([Mercari Shops](https://api.mercari-shops.com/docs/index.html)). Nothing in it mentions US listings, so it is not a route to Mercari US.

### Crosslisters reach Mercari through add-ons or stored logins

The tools fall into two groups. Vendoo, Crosslist, List Perfectly and others use a Chrome add-on on a desktop computer, working inside the seller's logged-in session. Crosslist's add-on needs the computer awake and Chrome open ([Crosslist](https://docs.crosslist.com/knowledge-base/sales/autodelist)). Nifty offers a second option for sellers without a computer: they enter their username and password, Nifty says it discards the password, and the login lasts about a month ([Nifty](https://docs.nifty.ai/connections/connecting-mercari)). Mobile apps such as Lista advertise Mercari posting but do not explain how it works ([App Store](https://apps.apple.com/app/id1634103692)).

Even the best versions are imperfect. Vendoo scans for sales **every ten minutes, and only while a computer is on with Vendoo open** ([Vendoo](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist)). Nifty and Crosslist quote about 15 minutes ([Nifty](https://docs.nifty.ai/auto-delisting/auto-delisting.md); [Crosslist](https://docs.crosslist.com/knowledge-base/sales/autodelist)). These are vendor claims, and we found no independent reliability data. FlowLister admits Mercari and Depop "fail more often" than Poshmark ([FlowLister](https://flowlister.com/how-crosslisting-works/)).

Velista's mobile focus makes this harder. Phone apps cannot run Chrome add-ons, so full Mercari automation would need Velista's servers to hold the seller's login, or a hidden browser inside the app. Those are the riskier designs.

### The rules ban automation, even though enforcement has been quiet

Mercari's rules forbid **"any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us"** ([Mercari](https://www.mercari.com/us/help_center/article/341/)). Its safety guidance says never to share an account or password with "third-party websites" ([Mercari](https://mercari.com/us/help_center/article/321)). Penalties include removed items, suspension, held funds and a bar from future use ([Mercari](https://www.mercari.com/us/help_center/article/341/)). A blogger who asked Mercari in 2023 was told that third-party services are prohibited ([From Pennies to Plenty](https://www.frompenniestoplenty.com/blog/vendoo-review)).

The fair counterargument is that many tools sell Mercari support openly in 2026, and we found no lawsuit, legal warning letter or public ban of a named tool. Enforcement so far appears to be quiet friction, such as the temporary listing blocks Vendoo describes ([Vendoo](https://help.vendoo.co/en/articles/6812636-i-can-t-list-on-mercari)). This evidence is weak, because we could not read Reddit or search court records. FlowLister itself says crosslisting to Mercari breaks its terms and that a ban "is possible" ([FlowLister](https://flowlister.com/how-crosslisting-works/)).

Tolerance can also end quickly. New accounts reportedly lost the ability to connect Vinted to one crosslister from 23 September 2026, as Vinted stepped up its detection of automation ([Sell The Flip](https://selltheflip.com/blog/best-crosslisting-app-for-vinted)). That is a second-hand report from a vendor, but it shows the kind of change a Mercari-dependent product could face.

The legal picture is unsettled. In August 2026 a US appeals court ruled for Perplexity against Amazon on computer-access law, partly because Perplexity's servers never talked to Amazon's directly ([Jones Day](https://www.jonesday.com/en/insights/2026/09/ninth-circuit-vacates-cfaa-injunction-against-perplexitys-comet-ai-agent)). That reasoning helps software running on the user's own device, and it helps far less if Velista's servers hold seller logins. An older case, Facebook v. Power Ventures, found that user consent stopped protecting a company once the platform told it to stop ([Eric Goldman](https://blog.ericgoldman.org/archives/2017/09/catching-up-on-ninth-circuit-cfaa-jurisprudence-internet-law-casebook-excerpt.htm)). Sellers carry the first risk, since they lose accounts, but Velista could face claims too. Stored logins would also make Velista a target for hackers, because they open accounts with payouts in them.

### Mercari is healthy, but shows no sign of opening up

Mercari US is worth wanting. Sales through the platform reached **$810 million in the year to June 2026, up 11%**, with 4.2 million monthly users in the final quarter. Jeff LeBeau became US CEO on 1 July, and management says it is exploring partnerships ([Value Added Resource](https://www.valueaddedresource.net/mercari-q4-2026-earnings/)). Sellers pay a 10% fee ([Mercari](https://www.mercari.com/us/help_center/article/169/)). We found no new API or bulk-listing tool, and no market exit. Mercari's terms were updated on **5 November 2026**, the day before this research, and we do not know what changed ([Mercari](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/)).

## Recommendation: one official integration and one helped flow

### What is feasible and what is not

| Option | Verdict | Why |
|---|---|---|
| Depop through the official API | **Do it**, if approved | Full posting and two-way auto-delist, within the rules |
| Helped posting for Mercari and Depop | **Do it now** | The seller does the final step, which appears to stay outside the automation ban; confirm with a lawyer |
| Mercari delist reminder | **Do it now** | Keeps the seller safe without touching Mercari |
| Mercari's import tool | Mention as a tip | Desktop only, drafts only, no Etsy, no sync |
| Automation inside the phone app for Mercari | **Not now** | Lowest-risk automation, but it still breaks Mercari's rules and needs a lawyer's sign-off |
| Velista's servers holding Mercari logins | **Do not build** | Breaks the rules, weakest legal position, and a serious security burden |
| Solving captchas, rotating internet addresses, copying private app connections | **Do not build** | Directly hits Mercari's ban on bypassing security and reverse engineering |
| Buying a ready-made Mercari or Depop connector | Not available | No such service was found, and it would carry the same Mercari problem |

### The recommended path

The helped flow is the key building block, because it serves Mercari permanently and serves Depop while the application is pending. Velista copies the generated text, saves the photos to the phone and opens the marketplace app. The seller pastes and posts. This needs no cooperation from either company. Whether a link can pre-fill the listing form is undocumented and needs testing on a real phone.

Delisting needs two separate answers on Mercari. When an item sells on Etsy, eBay or Depop, Velista sends the seller a notification with a link to the Mercari listing, and the seller deletes it. When an item sells on Mercari, Velista cannot find out on its own, so the seller taps "Sold on Mercari" and Velista delists everywhere else automatically. That second direction is the weak spot, because a forgetful seller could sell the same item twice. An idea worth testing later is reading Mercari's "item sold" emails with the seller's permission. It avoids touching Mercari, but no crosslister documents doing it, and it would need a review of email-access rules.

| Order | Action |
|---|---|
| This month | Email business@depop.com. Ask about startup eligibility, timeline, supported countries, a category feed, and how sale messages work across many sellers. Have the company proofs ready, and show the working eBay and Etsy integrations. |
| This month | Ask a lawyer to review the helped flow, the Depop contract and the 5 November Mercari terms. Have someone search Reddit for ban reports. |
| This month | Send a short partnership enquiry to Mercari US. Expect low odds of a reply, but only Mercari can confirm whether private deals exist. |
| Next build | Ship the helped flow, the delist reminder and the "Sold on Mercari" button. |
| Once Depop approves | Build the connection, the category matching and the photo selection from video, then connect sale messages to the existing auto-delist system, with the backup check. |
| Review every six months, and on any Mercari announcement | Reconsider in-app automation for Mercari only if sellers clearly demand it and a lawyer signs off. Sellers would need to be told the risk plainly. |

Marketing should say "automatic delisting on Etsy, eBay and Depop, with guided delisting on Mercari". If Depop declines or stalls, Velista keeps the helped flow and asks again. It should not fall back to a browser add-on or scraping, because those routes also break Depop's rules.

### What we still do not know

Depop's decision on startups is the largest open question, followed by any change under eBay. Our reading of Mercari's terms relied on a summarising tool, so a person should read them in full. Real ban rates for either platform are unknown. App Store and Google Play rules on automating other companies' logins were not researched, and neither was non-US law.

## Conclusion

The main finding is that the two marketplaces are moving in opposite directions, and the gap is an advantage for Velista. Depop has turned crosslisting into a formal channel, so a small company can now offer what once needed add-ons, possibly faster than the 10 to 30 minute sale checks rivals quote. Several rivals also reserve auto-delist for higher-priced plans, such as Crosslist's $39.99 a month Gold tier ([Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026)), so working auto-delist across three marketplaces has real sales value.

Mercari is a business decision more than a technical one. Velista could copy its rivals, but it would be staking its sellers' accounts and its own reputation on another company's continued patience. For a young company, a slightly less magical Mercari flow is the cheaper mistake to make: it can be upgraded in a future release, while a wave of closed seller accounts could not be undone.
