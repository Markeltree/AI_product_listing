# How third-party crosslisters connect to Mercari and Depop, and the risks of unofficial automation (as of 6 Nov 2026)

Evidence labels used throughout:
- **[Primary]**: the vendor's or marketplace's own page, fetched this session.
- **[Snippet]**: seen only in a search-result summary. The page itself was not fetched or could not be fetched.
- **[Competitor]**: written by a rival vendor, so it is commercially biased.
- **[Anecdote]**: a single user report.

Access limits this session:
- reddit.com is blocked to the search tool, so **no Reddit thread was read directly**.
- depop.com/terms-of-service, depophelp.zendesk.com, blog.depop.com and mercari.com/tos returned 403.
- The Depop ToS text below therefore comes from a search snippet of the help-centre copy, plus List Perfectly's paraphrase.

## What is the technical method per tool on Mercari and on Depop?

### Takeaway
The two marketplaces have diverged. **Depop now has a real, private, partner-gated Selling API with OAuth 2.0 aimed explicitly at cross-listing tools.** Vendoo and Crosslist state they use it, and Nifty's connection flow looks like it. **Mercari has no seller API that any source could identify.** Every Mercari integration is either a Chrome extension in the user's logged-in session or a server-side session or cloud browser.

### Cited Findings

**Depop Selling API (the key finding)**
- Depop publishes docs for a RESTful "Selling API" covering inventory create/update/delete, order retrieval and management, webhooks, offers automation and a sandbox with simulated purchases. It is private and not open to the general public, and partners must email Depop for next steps — [Depop Selling API overview](https://partnerapi.depop.com/api-docs/) [Primary]. Access address is business@depop.com — [Depop help, "Selling as a charity or business"](https://depophelp.zendesk.com/hc/en-gb/articles/4411154329233-Selling-as-a-charity-or-business) [Snippet].
- There are two auth modes. API keys are "for direct partners building an integration to manage their own shop(s)". OAuth 2.0 (Authorization Code + PKCE, granular scopes such as `products_read`) is "for third-party applications (such as cross-listing tools) that will be used by multiple sellers". Credentials cannot be self-provisioned; you must contact Depop first — [Depop API authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/) [Primary].
- Rate limits: pace bulk jobs to 20 requests/second per shop or seller. Cross-listers are told to "Throttle the total request rate across all sellers". Docs say "Use webhooks instead of polling", because "Webhooks tell you about sales, refunds and product changes as they happen" — [Depop rate limits](https://partnerapi.depop.com/api-docs/concepts/rate-limits/) [Primary].
- The API is actively developed. The changelog shows self-serve webhooks and `v1:product.update` (Aug 2026), `v1:product.create` (Sep 2026) and a default sort change (16 Oct 2026) — [Depop API changelog](https://partnerapi.depop.com/api-docs/changelog/) [Primary].
- Depop's help centre says it works closely with crosslisting tools via API connection — [Depop help](https://depophelp.zendesk.com/hc/en-gb/articles/4411154329233-Selling-as-a-charity-or-business) [Snippet].

**Mercari**
- "Poshmark and Mercari do not publish a seller API that lets a program create listings" — [FlowLister](https://flowlister.com/how-crosslisting-works/) [Primary vendor statement, page undated, about Aug-Nov 2026]. Closo likewise says Poshmark, Vinted, Depop and Mercari have no public listing API — [Closo help](https://help.closo.co/a/how-the-crosslister-works) [Primary vendor statement].
- Mercari's robots.txt disallows crawler access to /sell/, /mypage/ and /transaction/ — [mercari.com/robots.txt](https://www.mercari.com/robots.txt) [Snippet].

**Per-tool matrix**

| Tool | Mercari | Depop | Evidence |
|---|---|---|---|
| Vendoo | Chrome extension "Vendoo Crosslist Extension v3". The exact Mercari mechanism is not stated in help docs. | **Official Depop API** since Jul 2026: "Vendoo now runs on an official Depop API integration". All users had to reconnect. | [Chrome Web Store](https://chromewebstore.google.com/detail/vendoo-crosslist-extensio/mnampbajndaipakjhcbbaihllmghlcdf) [Snippet]; [Vendoo blog, 20-21 Jul 2026](https://blog.vendoo.co/new-depop-api-integration) [Primary] |
| Crosslist | Extension. Requires "your computer to be awake (not in sleep mode), Chrome open, and the Crosslist extension active" | Cloud ("through our servers, even when your computer is off"). Crosslist claims "private API partnerships with Depop and Facebook Marketplace" | [Crosslist autodelist docs](https://docs.crosslist.com/knowledge-base/sales/autodelist) [Primary, undated, (c) 2026]; [Crosslist blog, updated 29 Oct 2026](https://crosslist.com/blog/are-cross-listing-apps-safe) [Primary] |
| Nifty | Two options: Chrome extension ("recommended if you have a computer"), or **username + password** ("if you don't have a computer"). "We do not store your Mercari password": credentials are used once to establish a session, then discarded. "Mercari connections last about 1 month." | Redirect flow: "You'll be redirected to Depop — log in and grant Nifty permission." "Depop connections last 12 months." | [Nifty Mercari docs](https://docs.nifty.ai/connections/connecting-mercari) [Primary]; [Nifty Depop docs](https://docs.nifty.ai/connections/connecting-depop.md) [Primary] |
| List Perfectly | Extension "helps move your data into each form so you can review and publish". "We never ask for your marketplace passwords or user IDs." "List Perfectly is NOT a bot." | Same extension. No evidence of API use found. | [LP FAQ](https://listperfectly.com/faq/) [Primary] |
| PrimeLister | Crosslisting: "runs in the browser and uses a Chrome Extension". Separate Mercari Bot: "runs in the cloud; no browser extension is needed." | Depop Bot: "runs in the cloud, so it works while the phone and computer are off." Connection method not stated. | [PrimeLister llms-full.txt](https://www.primelister.com/llms-full.txt) [Primary]. A search summary of its docs said the extension passes marketplace cookies to its cloud via a My-Shops page [Snippet, **not confirmed** on fetch] |
| Closo | "Poshmark, Vinted, Depop, and Mercari run through the Closo Chrome extension". "Closo Cloud" (Unlimited plan only) is "a dedicated server-side browser pinned to your account". | Same | [Closo help](https://help.closo.co/a/how-the-crosslister-works) [Primary]. Contradicts Closo's own blog comparison calling it cloud-based with no extensions — [Closo blog](https://closo.co/blogs/closo-comparison/best-cross-listing-software-2025-full-comparison-pricing-guide) [Snippet] |
| Flyp | Chrome extension "Crosslister by Flyp". Homepage does not state the method. | Same (third-party sources). | [Flyp homepage](https://www.joinflyp.com/) [Primary, silent on method]; [Chrome Web Store](https://chrome.google.com/webstore/detail/flyp-crosslister/kbflhgfmfbghhjafnjbgpiopcdjeajio) [Snippet]; [Nifty article, updated 7 Oct 2026](https://nifty.ai/post/mercari-cross-listing) [Competitor]: "Flyp runs as a Chrome extension" |
| SellerAider | Chrome extension "Crosslister - SellerAider" covering Depop, eBay, Mercari, Poshmark, Vinted. | Same. | [Chrome Web Store](https://chromewebstore.google.com/detail/crosslister-selleraider/hoadkegncldcimofoogeljainpjpblpk) [Snippet]; [extscope](https://extscope.org/zh/extension/hoadkegncldcimofoogeljainpjpblpk) [Snippet, aggregator] |
| OneShop | Mobile app. Mechanism unverified. | Same. Sources say it crosslists to Poshmark, eBay, Mercari, Depop. | [App Store](https://apps.apple.com/us/app/id1577487407) [Primary, does not name the marketplaces]; [Vendoo blog](https://blog.vendoo.co/oneshop-pricing) [Competitor, Snippet] |
| FlowLister | Extension fills the form in the user's logged-in session. Can run unattended, but only on the founder's own account. | "Depop is manual." FlowLister says it is not an approved partner. | [FlowLister](https://flowlister.com/how-crosslisting-works/) [Primary] |
| Flipsail | Claims cloud operation with the laptop closed. Method undisclosed. | Same | [Flipsail blog, updated 2 Nov 2026](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Primary for its own product] |
| Lista (iPhone) | "post it to eBay, Mercari, Poshmark, Depop, and Grailed instantly". Method undisclosed. | Same | [App Store](https://apps.apple.com/app/id1634103692) [Primary] |
| Reeva | **Nothing found** in two targeted searches. | Nothing found. | See Gaps |

- Extension-era description, now partly stale: Vendoo marketing still says it "works from your own Depop account, in your browser" — [Vendoo marketing](https://marketing.vendoo.co/boost-depop-sales-with-vendoo) [Snippet]. This may predate the Jul 2026 API switch.
- Crosslist's taxonomy of connection methods: official APIs are "the clearest form of permission a marketplace can give", extensions are used "where no official API exists", and server-side login "carries the most risk" — [Crosslist, updated 29 Oct 2026](https://crosslist.com/blog/are-cross-listing-apps-safe) [Primary, self-interested].

### Inferences
- Nifty's Depop page (redirect, grant permission, 12-month connection) closely matches Depop's documented OAuth flow, so Nifty is probably a Selling API partner. Nifty does not say so.
- Nifty's password route for Mercari means a server-side login producing a session token held by Nifty for about a month. This is cloud automation with stored session state, even though the password itself is reportedly discarded.
- Vendoo's Depop reconnect flow (log in to Depop in another tab of the same browser, then click Connect) is not a textbook OAuth redirect as described. The transport cannot be confirmed from the blog alone.
- The practical split is: **Depop has a sanctioned route for a small startup if Depop grants access; Mercari has no sanctioned automation route.**

### Gaps
- No tool publishes low-level detail of its Mercari traffic (form-fill DOM automation vs replaying Mercari's private web API from the extension).
- Whether List Perfectly, Flyp, SellerAider, PrimeLister or OneShop have Depop API access is unconfirmed. Depop publishes no partner list that I could find.
- Reeva: no product of that name surfaced. The name may be misremembered, very new, or not indexed.
- Flyp's official help docs could not be located. One third-party claim that Flyp "uses OAuth login" is unverified and looks doubtful for Mercari — [yespress.io](https://yespress.io/flyp) [Snippet].

## Which tools auto-delist on Mercari and Depop, and how does sold detection work?

### Takeaway
Nearly all advertise it. Mechanically, **Mercari detection is almost always a periodic scan from a running browser extension (10-15 minutes while the computer is on)**, or server-side polling with a stored session in the cloud tools. **Depop can now be server-side, and in principle event-driven via webhooks, for API partners.** No source described email parsing as the mechanism for any of these tools. No independent reliability measurements exist.

### Cited Findings
- **Vendoo:** "Every ten minutes, Vendoo will 'scan' your connected marketplaces for sales." Requires Vendoo "actively running in an open browser tab" and "Your computer must be turned on and connected to the marketplaces", and this applies to mobile app users too. The feature is still labelled BETA. Multi-quantity items are only delisted at the last unit. Covers eBay, Poshmark, Mercari, Depop, Whatnot (the FAQ adds Etsy) — [Vendoo help, dateModified 7 Oct 2026](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist) [Primary].
- **Vendoo on Depop after the API move:** "Vendoo now syncs your Depop items automatically every 30 minutes, in the background", and Sale Detection is "always on" — [Vendoo blog, Jul 2026](https://blog.vendoo.co/new-depop-api-integration) [Primary]. This sits awkwardly with the help article's browser-tab requirement. Vendoo does not reconcile the two.
- **Crosslist:** Cloud for Depop, eBay, Etsy, Shopify, WooCommerce and Facebook (US). Extension for Grailed, Mercari, OfferUp, Poshmark, Vinted, Whatnot. "Crosslist usually detects sales within 15 minutes." Requires a Gold or Diamond plan — [Crosslist docs](https://docs.crosslist.com/knowledge-base/sales/autodelist) [Primary]. Gold is $39.99/mo — [Flipsail, Oct 2026 pricing](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Competitor].
- **Nifty:** "Detects the sale (within 15 minutes)". "The 15-minute window can't be shortened." The page does not say what must be open. Mercari is handled specially ("Mercari only allows a quantity of 1"). A cancelled sale requires a manual relist. Sale detection is included only in Bundle Plus/Pro and Crosslisting Plus/Pro — [Nifty docs](https://docs.nifty.ai/auto-delisting/auto-delisting.md) [Primary]. Runs without Nifty open — [QuickSync, 5 Nov 2026](https://quicksync.pro/blog/best-crosslisting-apps/) [third party].
- **List Perfectly:** "Auto Delist runs through the List Perfectly Extension on your device". Detection happens "When the extension is active and you're browsing supported marketplaces while signed in". Only works with listing quantity 1. Requires Pro Plus — [LP FAQ](https://listperfectly.com/faq/) [Primary]. Pro Plus is $99+/mo — [Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Competitor]. Best on devices that do not sleep — [LP auto delist guide](https://listperfectly.com/selling/list-perfectly-pro-plus-auto-delist/) [Snippet].
- **PrimeLister:** "detects sales and delists copies on Poshmark (US, CA), eBay, Mercari, Depop, Etsy, Shopify and Whatnot". Copies must be merged into one inventory row. A store with a connection error "cannot detect sales or delist copies". Auto Sync marks sold items once a day — [PrimeLister docs](https://docs.primelister.com/features/cross-lister-tool/auto-delisting) [Primary]. Mercari bundles are not supported — same docs [Snippet].
- **FlowLister:** "Mercari and Depop are checked only by the extension while Chrome is open", and "Mercari and Depop fail more often than Poshmark does" — [FlowLister](https://flowlister.com/how-crosslisting-works/) [Primary].
- **Flipsail:** Self-reported cloud detection every 5-10 minutes on most marketplaces, eBay within seconds, free tier every 4-12 hours. Mercari and Depop are not itemised in the fetched summary — [Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Primary for own product].
- **Flyp:** Includes "Auto-Delist sold items" — [Flyp](https://www.joinflyp.com/) [Primary]. Delists "when you're logged in and active in Flyp" — [Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Competitor]. A sold item is removed after orders refresh, and only with the tool open — [Nifty Flyp review](https://nifty.ai/post/flyp-review) [Competitor, Snippet].
- **SellerAider:** Auto-delist only on Pro ($29.99) — [Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Competitor]. No primary doc found.
- **Closo:** "Mark it sold on one, it delists on the others" — [Closo help](https://help.closo.co/a/how-the-crosslister-works) [Primary]. This wording does not establish automatic detection.
- **OneShop:** Auto-delist is advertised and App Store reviewers describe posts being removed on sale. Rated 3.3/5 from 471 ratings — [App Store](https://apps.apple.com/us/app/id1577487407) [Primary]. Users report "constantly glitchy" features — [Nifty](https://nifty.ai/post/mercari-cross-listing) [Competitor].
- **Lista:** Mentions "automatic sales detection" (v2.3.32) and "No double-selling" with no mechanism — [App Store](https://apps.apple.com/app/id1634103692) [Primary].
- **Reliability reports:** "some users report glitches in delisting" on Vendoo — [Nifty](https://nifty.ai/post/mercari-cross-listing) [Competitor]. A double sale while a laptop slept on Flyp — [Closo blog](https://closo.co/blogs/platform-specific-guides/the-honest-truth-real-flyp-reviews-and-how-to-automate-your-crosslisting-in-2026) [Competitor, Anecdote, Snippet].
- **Seller liability for missed delists:** Depop's terms make sellers responsible for removing items that sell elsewhere and accepting responsibility if an item sells on both — [Depop ToS](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service) [Snippet]; [List Perfectly, 12 Mar 2026](https://listperfectly.com/selling/depop-terms-of-service-update-2026/). Under that article's reading, a double-sold item must be refunded.

### Inferences
- The floor for Mercari today is about 10-15 minutes, and that is while something is actively checking. The window for a double sale is real, and it widens to hours or longer whenever the desktop sleeps in extension-based tools.
- The Depop webhooks page names sales as a webhook event type. A partner could plausibly get near-real-time Depop sale detection, which beats the 15-30 minute vendor figures. The changelog excerpt did not show a named "sold" event, so check the reference before designing around it.
- Marketplace connection expiry (Nifty: about 1 month for Mercari) is a silent failure mode for auto-delist: an expired session means no detection until the user reconnects.

### Gaps
- No independent, quantified delist-reliability data (miss rate, latency distributions) was found. All speed figures are vendor claims.
- Reddit reports could not be read. User sentiment here is limited to App Store reviews and competitor blogs.
- Whether any tool uses Mercari sale-notification emails was not found in any source. It may simply not be disclosed.

## Does any tool work fully from a mobile app without a desktop browser extension?

### Takeaway
**Yes for some, but only by moving automation to the vendor's servers, or (for Depop) by using the API.** Nifty documents this most clearly: a password-derived session for Mercari, a permission redirect for Depop, no computer needed. Extension-based tools (List Perfectly, Crosslist for Mercari, Flyp, FlowLister) do not. Vendoo's mobile app exists but its docs still tie sale detection to a running computer.

### Cited Findings
- **Nifty:** The password connection is offered explicitly "if you don't have a computer" — [Nifty docs](https://docs.nifty.ai/connections/connecting-mercari) [Primary]. "Automation runs in the cloud", with no extension or special browser, and it works on mobile — [Nifty, 7 Oct 2026](https://nifty.ai/post/mercari-cross-listing) [Vendor's own]. The Nifty docs sitemap has no mobile-app page, so "mobile" may mean mobile web — [Nifty sitemap](https://docs.nifty.ai/sitemap.md) [Primary].
- **PrimeLister:** Mercari and Depop Bots run in the cloud with no extension. Its crosslister still uses the Chrome extension, and the FAQ offers only a mobile browser for web access — [PrimeLister](https://www.primelister.com/llms-full.txt) [Primary].
- **Crosslist:** Depop is server-side, Mercari needs Chrome on desktop — [Crosslist docs](https://docs.crosslist.com/knowledge-base/sales/autodelist) [Primary]. An older page says crosslisting requires a computer with Chrome and "you cannot import, post or cross list listings using your mobile device" — [crosslist.com](https://crosslist.com/?p=14720) [Snippet, possibly dated].
- **List Perfectly:** Drafts work on any mobile browser, but crosslisting requires "a device that supports browser extensions" — [LP FAQ](https://listperfectly.com/faq/) [Primary].
- **Vendoo:** Its site says the app can create listings, crosslist, delist and relist — [Vendoo](https://vendoo.co/everything-you-need-to-know-about-vendoo-for-online-sellers) [Snippet]. App Store reviewers say importing existing Mercari and Poshmark listings needed the desktop Chrome extension — [App Store](https://apps.apple.com/app/id1612168777) [Anecdote, Snippet].
- **Mobile-native apps claiming Mercari and Depop:** Lista (iPhone, 4.6/5 from 144 ratings, publisher Luis Galvan). One 2025 reviewer said only Mercari and Depop posted for them and Depop "just flags most listings right away" — [App Store](https://apps.apple.com/app/id1634103692) [Primary listing; Anecdote]. Crosslisting (iOS) advertises automatic delisting from all marketplaces and captcha auto-solving — [App Store listing](https://apps.apple.com/cd/app/crosslisting/id1622734136) [Snippet]. OneShop — [App Store](https://apps.apple.com/us/app/id1577487407) [Primary, method not stated].
- **Closo:** Its cloud option is a "dedicated server-side browser", Unlimited plan only — [Closo help](https://help.closo.co/a/how-the-crosslister-works) [Primary].

### Inferences
- Native mobile apps cannot run Chrome extensions, so a mobile-only Mercari integration needs one of three designs:
  1. A server holding the user's session (Nifty-style).
  2. An on-device embedded WebView logged in as the user.
  3. Replaying private endpoints from the device.
- No source confirms that any of these tools uses the WebView approach. It is the most relevant unverified pattern for Velista, because it keeps traffic and cookies on the user's device, which matters for the legal point in the next-but-one section.
- Velista being mobile-first is what pushes it towards the highest-risk category for Mercari.

### Gaps
- How Lista, OneShop and Crosslisting actually reach Mercari (server vs on-device) is undisclosed.
- Whether Apple or Google reviewers object to apps automating third-party logins in WebViews was not researched.

## Have Mercari or Depop banned, suspended or warned users or tools? Any legal action?

### Takeaway
**I found no documented lawsuit, cease-and-desist letter, or public ban of a named crosslisting tool by Mercari or Depop.** That is an absence of evidence, and Reddit could not be checked. What exists is policy language against automation, Mercari throttling acknowledged in Vendoo's docs, one 2023 blogger's email from Mercari saying third-party services are prohibited, and a close analogue at Vinted in Sept 2026.

### Cited Findings
- **Mercari stated position (dated, single source):** "I wrote to Mercari and asked if services such as Vendoo are allowed." "The company replied that third-party services are prohibited." — [From Pennies to Plenty, 13 Jun 2023, updated 22 Jun 2023](https://www.frompenniestoplenty.com/blog/vendoo-review) [Anecdote, older].
- **Mercari throttling:** Vendoo documents a temporary "Mercari listing maximum" block, which it says marketplaces use to counter "bots and fraudulent or suspicious activity". Triggers are listing many items at once, listing too quickly, or a new account. There is no fixed threshold, and the fix is to wait a few hours or a day — [Vendoo help, 9 Jul 2026](https://help.vendoo.co/en/articles/6812636-i-can-t-list-on-mercari) [Primary].
- **Vendor admission of ban risk:** "It is possible. A marketplace that decides your activity is automated can remove listings, limit features". FlowLister says it has not seen a FlowLister seller banned, on a small sample, and states "crosslisting to Poshmark, Mercari or Depop breaks those marketplaces' terms of service" — [FlowLister](https://flowlister.com/how-crosslisting-works/) [Primary vendor statement].
- **Mercari enforcement of duplicates:** Prohibited Conduct bans "Excessive reposting of previously listed items" and "Creating multiple listings of the same item" — [Mercari Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/) [Primary]. Auto-relist features can therefore trip policy independently of any automation clause.
- **Mercari account limits:** Mercari says being flagged for Prohibited Conduct indicates possible ToS violation — [Mercari help 162](https://www.mercari.com/us/help_center/article/162/) [Snippet].
- **Vinted analogue (not Mercari or Depop):** "Existing users only. New accounts cannot connect Vinted since September 23, 2026." Crosslist attributes this to Vinted stepping up detection of automated activity, and some users received temporary 24-hour suspensions — [Sell The Flip, 31 Oct 2026](https://selltheflip.com/blog/best-crosslisting-app-for-vinted) [Competitor, second-hand].
- **Depop:** Suspension guides from vendors list prohibited items, abuse, off-platform sales and failed identity checks as causes, and none cite Depop enforcement against crosslisters — [Vendoo](https://blog.vendoo.co/depop-account-suspended-what-you-need-to-know) [Snippet]; [Nifty](https://nifty.ai/post/depop-account-suspended) [Snippet].
- **Community anecdote:** A Lista reviewer said Depop "just flags most listings right away" (2025) — [App Store](https://apps.apple.com/app/id1634103692) [Anecdote]. Cause not established.
- **Search outcome:** Targeted searches for "cease and desist", "lawsuit" and account-closure reports tied to crosslisters returned no incident. An account-suspension guide says multi-account login from one device and bulk operations from one IP are flags, with lifts in 24-72h — [IPFoxy](https://www.ipfoxy.com/blog/ideas-inspiration/5001) [Snippet, proxy vendor, unverified].
- **Tools still openly selling Mercari and Depop bots** in late 2026 (Nifty, PrimeLister, Sidekick) — [PrimeLister](https://www.primelister.com/llms-full.txt) [Primary]; [Sidekick](https://poshsidekick.com/best-depop-bots/) [Snippet]. PrimeLister describes "built-in captcha solving and realistic timing intervals to mimic human behavior" for its Poshmark Bot — same source.

### Inferences
- Enforcement looks like quiet friction (rate limits, temporary blocks, session challenges) rather than legal action, so far.
- The Vinted event shows a marketplace can tighten suddenly and take out a whole tool category with little notice. A Mercari-dependent product carries that platform risk even with no history of enforcement.
- eBay closed its Depop purchase on 30 Jul 2026 — [eBay press release](https://ebay.q4cdn.com/610426115/files/doc_news/eBay-Completes-Acquisition-of-Depop-2026.pdf) [Snippet]. No change to third-party tooling has been announced, per vendor blogs — [List Perfectly](https://listperfectly.com/tips/did-ebay-buy-depop-heres-what-we-know-so-far/) [Snippet, interested party]. Depop's API terms and partner intake could change under new ownership. This is speculation.

### Gaps
- r/Mercari, r/Depop, r/Flipping: **not accessible**. A human should search these directly, because that is where account-closure reports would live.
- A figure of 5,000+ Depop accounts suspended in a 2024 bot purge appeared in a blog summary. I could not trace or verify it, so treat it as unusable.
- No court docket search was possible. "No lawsuit found" reflects web search only.

## What are the legal and ToS risks to a startup automating on behalf of users?

### Takeaway
ToS risk on Mercari is clear; statutory risk is genuinely unsettled. **Mercari's terms prohibit automated means "not provided by us", and its safety guidance says never to share an account or password with third-party websites.** Depop bans bots and third-party software generally while expressly permitting third-party cross-listing, and it offers an API. The Aug 2026 Ninth Circuit Perplexity ruling helps **on-device** agents and specifically turned on Perplexity's servers not talking to Amazon's. It gives much less comfort to a Velista backend holding cookies, and *Power Ventures* remains a warning once a platform revokes access.

### Cited Findings

**Mercari terms**
- ToS page is "Effective November 5, 2026" (one day before this research). It bars reverse engineering, attempts "to disable or circumvent any security or other technological measure", and activity creating "an excessive burden on the Services". It has mandatory arbitration and a class waiver, and "We may refuse service to anyone and may terminate or suspend your Account". The fetched ToS body had no literal bot clause; that sits in the Prohibited Conduct policy, which the ToS incorporates — [Mercari ToS](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/) [Primary].
- Prohibited Conduct: users may not "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data", or engage in "Selling or otherwise transferring the access granted under these Terms" — [Mercari Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/) [Primary; page date not confirmed, wording stitched from a fetch and a search snippet].
- "Never share your Mercari account or password with anyone, including third-party websites." — [Mercari Safety Guidelines](https://mercari.com/us/help_center/article/321) [Primary]. "Account sharing is strictly prohibited" — [Mercari security page](https://about.mercari.com/en/security/secure) [Snippet; this may be the Japanese-group security page, check it applies to the US].

**Depop terms**
- Users may not "mine data, scrape or crawl the Service, including any internal software capabilities used to offer our Service (e.g. an application programming interface), or use any bots or other third party software on the Service". Sellers may "simultaneously list your items for sale on other platforms and/or marketplaces via third party cross-listing platforms, as long as you fully comply with our Terms of Service" — [Depop ToS, help-centre copy](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service) [Snippet; direct fetch returned 403, version date unconfirmed].
- List Perfectly's reading (12 Mar 2026): the updated terms acknowledge crosslisting, and prohibit scraping, crawling, interfering with systems and "unauthorized bots or automated access" — [List Perfectly](https://listperfectly.com/selling/depop-terms-of-service-update-2026/) [secondary, interested party].

**Case law**
- *Amazon v. Perplexity*, district court, Mar 2026: Judge Chesney found Comet accessed accounts "with the Amazon user's permission, but without authorization by Amazon" and granted a preliminary injunction — [CNBC](https://www.cnbc.com/2026/03/10/amazon-wins-court-order-to-block-perplexitys-ai-shopping-agent.html) and [GeekWire](https://www.geekwire.com/2026/judge-blocks-perplexitys-ai-bot-from-shopping-on-amazon-in-early-test-of-agentic-commerce/) [Snippet].
- Ninth Circuit, No. 26-1444, 4 Aug 2026 (Judge M. Smith), vacated it: "it is the user—not Perplexity—who 'accesses' Amazon's computers for CFAA purposes", and "At no point do Perplexity's servers directly communicate with Amazon's servers." The holding also covers California's CDAFA and is expressly limited to the current record. Platforms are pointed to "terms of service restrictions and technological measures" — [Jones Day, Sep 2026](https://www.jonesday.com/en/insights/2026/09/ninth-circuit-vacates-cfaa-injunction-against-perplexitys-comet-ai-agent) [law-firm summary].
- Follow-on: rehearing reportedly denied 10 Sep 2026, and an amended complaint of 21 Sep 2026 reportedly targets the iOS Comet app for sending user cookies to Perplexity's cloud. Tort and ToS theories were not resolved — search summary of coverage including [Pearl Cohen](https://www.pearlcohen.com/ninth-circuit-vacates-injunction-against-perplexitys-ai-shopping-agent/) and [nohacks](https://nohacks.co/blog/amazon-perplexity-cfaa-agent-visitor-rights) [Snippet; the individual source was not pinned, verify before quoting].
- *Facebook v. Power Ventures*, 844 F.3d 1058 (9th Cir. 2016): users' consent stopped being a basis for access once Facebook sent a cease-and-desist; authorization comes from the computer owner; evading an IP block showed knowledge. Damages of almost $80,000 were limited to the post-letter period — [Goldman casebook excerpt](https://blog.ericgoldman.org/archives/2017/09/catching-up-on-ninth-circuit-cfaa-jurisprudence-internet-law-casebook-excerpt.htm); [EFF](https://www.eff.org/deeplinks/2016/08/do-over-please-eff-and-aclu-ask-ninth-circuit-revisit-two-dangerous-cfaa-rulings) [Snippet, secondary; the opinion itself was not read].

**Vendor views on credentials**
- Server-side login "carries the most risk" — [Crosslist](https://crosslist.com/blog/are-cross-listing-apps-safe) [Primary, self-interested]. Sharing login credentials is listed there among the things that do cause problems.
- Nifty addresses this by discarding the Mercari password, but the session persists about a month — [Nifty](https://docs.nifty.ai/connections/connecting-mercari) [Primary].

### Inferences (not legal advice; needs counsel)
Risk ladder for Mercari, lowest to highest:
1. Manual-assisted posting by the user.
2. On-device automation in the user's own browser or WebView, where traffic originates from the user. *Perplexity* reasoning is most favourable here, but this is still a ToS breach for the user.
3. Server-side automation with stored cookies, which is outside *Perplexity*'s reasoning and is the theory Amazon is reportedly now pressing.
4. Storing passwords, which contradicts Mercari's explicit guidance and carries breach liability.
5. Continuing after a C&D or IP block, which is *Power Ventures* territory.

Other consequences:
- Bypassing captchas or rate limits engages Mercari's "circumvent any security or other technological measure" language.
- The user bears account loss, while the startup faces contract-interference type claims if it knowingly induces a ToS breach. No source tested this for crosslisters. Tort and interference claims were left open in *Perplexity*.
- Stored session cookies are effectively credentials, so a breach would expose user accounts with payout balances. That points to encryption, minimal retention, clear disclosure, and likely state breach-notification duties. These were not researched in detail.

### Gaps
- No counsel opinion specific to crosslisters was found. CFAA, CDAFA, tort and privacy exposure need a lawyer.
- Non-US law (Depop is UK-origin) was not covered.
- App Store and Play policy implications were not covered.
- The dated text of Depop's current ToS should be read in a normal browser.

## What alternatives does a small startup have?

### Takeaway
A workable path exists in layers: **apply for Depop's Selling API now (OAuth + webhooks gives legitimate list, delist and sold detection)**, and use **assisted or manual flows for Mercari**, with reminders rather than background automation. No white-label or unified Mercari/Depop API was found. Partnering with a crosslister would have to be negotiated directly, as none advertises it.

### Cited Findings
- **Depop Selling API:** Exactly the fit for third-party tools, with OAuth "for third-party applications (such as cross-listing tools)". Requires contacting Depop first — [Depop auth docs](https://partnerapi.depop.com/api-docs/concepts/authentication/) [Primary]. Whether a small startup would be accepted is unknown, and the "your first listing" guide exists for onboarded partners — [Depop docs](https://partnerapi.depop.com/api-docs/getting-started/your-first-listing/) [Snippet]. FlowLister is an example of a small vendor without access — [FlowLister](https://flowlister.com/how-crosslisting-works/) [Primary].
- **Depop CSV bulk upload (official):** "Bulk listing" in the web selling hub, using a Google Sheet template exported as CSV. Listings land in drafts minutes later, with an email on completion — [Depop blog](https://blog.depop.com/articles/bulk-listing-on-depop) [Snippet]; [Depop June 2025 release](https://www.depop.com/blog/depop-product-release-june-2025/) [Snippet, older]. Listing on web is also supported — [Depop help](https://depophelp.zendesk.com/hc/en-gb/articles/8608273715217-Listing-on-web) [Snippet]. It is one-way (no delist) and web-only.
- **Mercari importer (official, sanctioned onboarding):** Paste an eBay or Depop store, user or item URL and Mercari's AI extracts listing details, which the seller reviews before posting. It is a "one time extraction", and a sale elsewhere does not sync to Mercari — [Value Added Resource, 1-7 Apr 2024](https://www.valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop/) [older, current status unverified]; [Vendoo blog](https://blog.vendoo.co/mercari-import-listing) [Snippet]. No delist capability: sellers remain responsible for removing the Mercari listing.
- **Mercari CSV bulk upload:** No official tool found. Third-party Chrome extensions fill in for it — [Closo](https://closo.co/blogs/platform-specific-guides/mercari-bulk-lister) [Snippet].
- **Deep link and share-sheet prefill:** No official documentation for prefilling a sell form on either marketplace was found. Depop and Mercari consumer flows are simply in-app ("tap Sell"). A device test is needed to find out if any such URL scheme exists. Copy-to-clipboard plus opening the app, with photos saved to the camera roll, needs no marketplace support at all.
- **White-label or unified API:** None found. Listelf (formerly Crosslist Magic) has an API playground URL suggesting interest in API access, but the page now returns 404 — [Listelf](https://www.crosslistmagic.com/api-playground) (redirect, then 404). Vendoo, Nifty, Closo and Lista show consumer workflows only in search results. Any such API would inherit the same ToS problem on Mercari.
- **Scraping APIs for Depop** (Parse.bot, Retailed, ScrapeBadger) exist for reading data — [ScrapeBadger](https://scrapebadger.com/blog/best-depop-scraper-apis-in-2026-compared-and-ranked) [Snippet]. Depop's ToS forbids scraping, so they are not a compliant route.
- **Hand-off to an existing crosslister:** Tools accept imports (for example Crosslist bulk import — [crosslist.com](https://crosslist.com/marketplaces/depop/) [Snippet]). No documented inbound API from a third-party listing generator was found.
- **Pricing benchmark, Oct-Nov 2026:** Vendoo $14.99-$59.99; Crosslist $29.99-$44.99; Flyp $9 after 100 free days; List Perfectly $29-$99+; PrimeLister $49.99 plus add-ons; Nifty $39.99+; SellerAider $12.99-$29.99; Flipsail $15-$30 — [Flipsail](https://www.flipsail.io/blog/best-cross-listing-tools-2026) [Competitor, checked Oct 2026]. Auto-delist is the premium gate at several of these.

### Inferences
Suggested option ordering for Velista, for the report writer to weigh:
1. **Depop:** apply to the Selling API immediately. Use the CSV or manual route while waiting.
2. **Mercari:** start with an assisted post (generated copy, photos to the camera roll, open the app). For delist, push a notification when a sale is detected elsewhere and deep-link to the Mercari listing, so the user taps delete. That preserves the "auto-delist" promise only partly.
3. **If true Mercari auto-delist is a must-have:** the least-bad design is on-device (user-consented WebView session, no cookies leaving the phone, conservative pacing, no captcha bypass). It still violates Prohibited Conduct, so the user must be told, and it needs counsel sign-off.
4. **Avoid:** server-side password or cookie storage, captcha solving, proxy rotation, and any evasion after a block.
5. **Partnership:** a cold outreach to Vendoo or Crosslist is possible but would be a business development project with no public precedent found.

Detecting Mercari sales without touching Mercari: the user could forward or connect Mercari "item sold" emails. This is a read of the user's own inbox rather than Mercari automation. No crosslister was found documenting this, so it is an untested idea, and it needs the mail-access permissions review that Gmail and others require.

### Gaps
- Depop's acceptance criteria, partner fees, timelines and any contractual terms for the API are not public. A direct email to business@depop.com is the only way to learn them. Post-eBay intake is unknown.
- Whether Mercari US runs any private partner program is unknown. No evidence of one was found. A direct inquiry is worthwhile.
- Mercari importer availability and Depop CSV limits in late 2026 are unconfirmed.
- Real deep-link behaviour needs on-device testing.
