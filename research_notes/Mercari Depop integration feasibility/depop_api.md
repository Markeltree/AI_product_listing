# Depop official seller/listing API and access model (as of 6 Nov 2026)

Evidence notes. Depop's docs carry no per-page dates except the changelog (latest entry October 2026) and the terms (published 22/04/2026). All partnerapi.depop.com pages, and the OpenAPI spec (`Seller API 1.0.0`, 6,721 lines), were read on 2026-11-06.

## Does Depop have an official Selling/Partner API, and is it public or gated?

### Takeaway
Yes. The "Selling API" is real, actively developed and has public docs at partnerapi.depop.com, but access is private: you must email Depop and be onboarded. The documentation is open; credentials are not.

### Cited Findings
- Docs root is partnerapi.depop.com/api-docs/. It states: "This API is currently private and is not available to the general public." Interested parties are told to contact Depop and "we'll get back to you with the next steps." — [Selling API overview](https://partnerapi.depop.com/api-docs/)
- The contact address is hidden by Cloudflare email obfuscation in the page. Decoding the `data-cfemail` value in the page HTML gives business@depop.com. Treat as verified from page source, but it was not displayed as plain text to the fetcher. — [Selling API overview](https://partnerapi.depop.com/api-docs/)
- The OpenAPI spec describes itself as an "Externally facing API to allow enterprise partners to automate listing on Depop." Spec is publicly downloadable. — [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- Production base URL is `https://partnerapi.depop.com`; staging is `https://partnerapi-staging.depop.com`; paths are under `/api/v1`. — [Reference](https://partnerapi.depop.com/api-docs/reference/)
- Development is active: the changelog has entries for every month from May 2025 to October 2026. "Public API documentation" expansion is logged in June 2025. — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)
- The API is positioned as "making it easy for high-volume sellers and partners to thrive," with "dedicated account management, Slack collaboration, and ongoing support." — [Why Depop?](https://partnerapi.depop.com/api-docs/why-depop/)
- Third-party directory API Evangelist describes it as an enterprise partner API for approved partners. This is an unofficial profile, not Depop documentation. — [api-evangelist/depop](https://github.com/api-evangelist/depop)

### Inferences
- The gate is relationship-based (email, then onboarding), not a self-serve developer portal. No public application form was found.

### Gaps
- No published statement of how many partners are live or what share of applicants are accepted.

## Who can get access and how: process, requirements, cost, timeline? Can a third-party SaaS get access?

### Takeaway
A third-party multi-seller tool is an explicitly documented partner type: OAuth exists "for third-party applications (such as cross-listing tools)." Access is free by default under the published terms. No volume threshold, country requirement, acceptance criteria or timeline is published, so whether an early-stage startup would be accepted is unknown until Depop is asked.

### Cited Findings
- Two partner types are documented. API keys are "for direct partners building an integration to manage their own shop(s)." OAuth 2.0 is "for third-party applications (such as cross-listing tools) that will be used by multiple sellers." — [Authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/)
- Neither mode can be self-configured; you contact Depop first. — [Authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/)
- The OAuth guide's prerequisite is "A Testing OAuth Client configured" with `client_id`, `client_secret` and `redirect_uri`, obtained by contacting Depop. — [Your first OAuth connection](https://partnerapi.depop.com/api-docs/getting-started/your-first-oauth-connection/)
- Direct partners start with a "Testing API key," also obtained by email. The guide does not describe moving to production. — [Your first listing](https://partnerapi.depop.com/api-docs/getting-started/your-first-listing/)
- Terms apply to any "partner organisation," bound by accessing the API or signing an Order Form. Published 22/04/2026; contracting party is Depop Limited (company no. 08316342). — [API Access Service Terms](https://partnerapi.depop.com/api-docs/terms/)
- Cost: "Unless otherwise specified in an Order Form, Depop shall provide access to the API free of charge during the Term, provided You remain within the Rate Limits" (cl. 5.1). Depop may introduce fees on at least 60 days' written notice, and you may terminate before they start (cl. 5.3). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Onboarding checks (Schedule 1, anti-fraud) include proof of bank account ownership, proof of identity, proof of employment with the registering company, phone number and magic-link email verification. Sellers on your platform must have accounts in good standing (cl. 3.2(g)). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Termination: Depop may terminate for convenience on 30 days' notice (cl. 4.3(c)); either party on 90 days (cl. 4.1); immediately for unlawful use, security risk or repeated rate-limit breaches (cl. 4.3(a)-(b)). Data collected via the API must be deleted on termination (cl. 4.4). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Terms clauses relevant to Velista's product (Schedule 2): no using the API to collect Depop content for "analytics, machine learning, training artificial intelligence models, licensing, or content removal" without written authorisation (item 12); no automated systems or browser extensions to access or scrape the platform without written authorisation (item 11); pricing suggestions may not be used outside the applicable Listing or shared with third parties (item 13); no commercialising or transferring API access (item 9); no reverse engineering, internal or legacy API access, spam, or off-platform diversion (items 1, 7, 8, 10 collectively). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Depop marks may not be used without prior written consent (cl. 7.5). Partners must avoid greenwashing and must not supply inventory consisting primarily of low-quality or excess stock (Sch. 3). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Data: parties are independent controllers under UK GDPR (cl. 12.1); suspected breaches must be reported within 24 hours; deletion is required on termination or when a user stops listing with Depop, whichever is first (Sch. 4). Governing law is England and Wales. — [Terms](https://partnerapi.depop.com/api-docs/terms/)

### Inferences
- Velista's model (many sellers authorising one app) maps to the documented OAuth route, not API keys. Nothing in the docs excludes a small company, but "enterprise partners" and "high-volume sellers and partners" wording suggests Depop may prioritise scale. This is inference.
- Velista's AI runs on the seller's own photos, video and voice, which item 12 does not obviously touch. Any step that feeds Depop-sourced content (listings, sold comps, Pricing Inspiration) into model training or analytics would need written permission. Legal review is warranted; this is not legal advice.
- Depop's 30-day convenience termination makes the integration revocable, so Velista should not make Depop a single point of dependency.

### Gaps
- No published seller-volume minimum, country requirement for partners, approval criteria, review steps or typical timeline. Could not be verified from any source; only Depop can answer.
- Whether a production OAuth client requires a further review or demo is not documented.
- No account from a small startup describing its application experience was found.

## Which capabilities exist? Authentication? Rate limits?

### Takeaway
The API covers the whole of Velista's core flow: create, update, delete, quantity, orders and near-real-time sale webhooks. Auth for third parties is OAuth 2.0 Authorization Code + PKCE. Limits are generous for a startup. Notable shortfalls: no video in the listing schema, and the taxonomy is not served through the API.

### Cited Findings
**Listings**
- Create: `POST /api/v1/products/` and `PUT /api/v1/products/by-sku/{sku}/` (creates if SKU is new). Read, update (PUT/PATCH) and delete exist by SKU, product ID and slug. — [Reference](https://partnerapi.depop.com/api-docs/reference/)
- `DELETE` is idempotent, and `fail_if_active_offers` returns 409 if offers are active. Mark-as-sold sets quantity to 0; restock via PUT with new quantity. — [Reference](https://partnerapi.depop.com/api-docs/reference/)
- Legacy non-`/by-sku/` endpoints are deprecated (Nov 2025). Restocking of sold-out or deleted listings was added May 2025; multi-quantity June 2025; editing SKU September 2026; changing size July 2026, though adding a size to a listing that had none is unsupported. — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)
- Required create fields: `address` (`country_code`, `state`), `description` (max 1000 chars, up to 5 hashtags), `price_currency`, `price_amount` (min 1.00), `quantity`, `pictures` (1 to 8), `department`, `product_type`, `condition`, `brand_name`, `attributes`. Shipping is either `national_shipping_cost` or `depop_shipping`. `size_set_id`/`size_id` are mandatory where the product type has a size set. — [Reference](https://partnerapi.depop.com/api-docs/reference/)
- Images: JPEG, PNG (July 2025) and WebP (October 2025); transparency is lost. Depop-hosted picture URLs must belong to the requesting user or the request returns 422; external URLs are unaffected. — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)
- Video: the string "video" appears zero times in the 6,721-line OpenAPI spec (verified by text search). — [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- Taxonomy is "not yet" served via the Selling API. Partners download it from `https://api.depop.com/api/v3/attributes/`, which has bot-detection. — [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/)

**Orders and sold status**
- `GET /api/v1/orders/`, `GET /api/v1/orders/{purchase_id}/`, mark-as-shipped per parcel, and refund. — [Reference](https://partnerapi.depop.com/api-docs/reference/)

**Webhooks**
- Events: `v1:order.new`, `v1:order.refund`, `v1:order.update`, `v1:product.create`, `v1:product.like`, `v1:product.unlike`, `v1:product.update`, plus wildcards. Signed with `X-Depop-Signature`; max 10 configurations; delivery is best-effort, so Depop advises periodic reconciliation through the orders and products endpoints. — [Webhooks](https://partnerapi.depop.com/api-docs/concepts/webhooks/)
- `v1:product.create` and `v1:product.update` fire whether the change came through the API or the Depop app or website (added Sept and Aug 2026). Webhook configs became self-serve in August 2026. — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)

**Other**
- Offers (auto-send, auto-negotiate, manual), boosting, discounts, insights, Depop Managed Shipping, seller addresses. Pricing Inspiration (`POST /api/v1/pricing/inspiration/`) added May 2026. — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)
- Staging has simulated purchase and like endpoints. — [Reference](https://partnerapi.depop.com/api-docs/reference/)

**Authentication**
- OAuth: Authorization Code with PKCE (S256 required). Authorize URL `https://www.depop.com/settings/oauth/apps/`; `redirect_uri` must exactly match a registered URI; authorization code is single-use and lasts 10 minutes. — [Your first OAuth connection](https://partnerapi.depop.com/api-docs/getting-started/your-first-oauth-connection/)
- Token endpoint `POST https://partnerapi.depop.com/api/v1/oauth2/access-token/`. Access token lasts 1 hour, refresh token 1 year. Refresh requires `client_secret`. — [Using OAuth Refresh Tokens](https://partnerapi.depop.com/api-docs/how-to-guides/using-oauth-refresh-tokens/)
- Scopes in the spec: `products_read`, `products_write`, `orders_read`, `orders_write`, `shop_read`, `offers_read`, `offers_write`. — [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- API keys: one per shop, static long-lived bearer tokens, `pak_` prefix, with access to all scopes. — [Authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/)
- Doc inconsistency: the overview page still mentions only "simple API Keys" while the authentication page documents both modes. — [Overview](https://partnerapi.depop.com/api-docs/); [Authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/)

**Rate limits**
- Per shop or connected seller: 200 requests per 10s for listing create/full update; 600 per 5 min for live insights; 6,000 per minute for everything else. — [Rate-limits](https://partnerapi.depop.com/api-docs/concepts/rate-limits/)
- Per application (cross-listers only): 30,000 requests per minute across all sellers and endpoints; this does not grow as sellers connect. — [Rate-limits](https://partnerapi.depop.com/api-docs/concepts/rate-limits/)
- 429 responses return `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. — [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- Terms state defaults of 20 rps (creates/updates) and 100 rps (other), changeable on reasonable notice or by Order Form. Excess use can mean suspension. — [Terms](https://partnerapi.depop.com/api-docs/terms/)

### Inferences
- Auto-delist on Depop when an item sells elsewhere: call DELETE or mark-as-sold. Detecting a Depop sale: `v1:order.new`, plus periodic reconciliation because delivery is best-effort. Both map onto Velista's existing cross-delist sync.
- Video captured in Velista would have to be used only as an input (for example, extracting up to 8 stills), since the spec has no video field. Depop's consumer app may support video, but that was not checked, and the API does not expose it.
- Velista needs a mapping layer for department, product type and size sets. Because the taxonomy source has bot-detection, it would have to be obtained as a periodic manual or partner-assisted export; ask Depop whether a supported feed exists. Do not plan to automate around the bot-detection.
- `brand_name` and `condition` are mandatory, so Velista's AI output must always produce them.

### Gaps
- Webhook retry behaviour is not documented on the concept page. Whether every in-app sale reliably triggers `v1:order.new` is implied ("when a new order is placed for one of your listings") but delivery is best-effort.
- Multi-seller webhook routing under OAuth (one configuration across all connected sellers, or per seller, given the max of 10) is not clear from the pages read. This matters for scale and should be asked of Depop.
- Rotation behaviour of refresh tokens was not confirmed.

## Which countries/markets does it cover? Any category restrictions?

### Takeaway
No page lists the countries a listing can be created in. The evidence points to UK, US and Australia as Depop's lead markets, and Depop-shipping providers exist for all three; Pricing Inspiration is UK/US only. Confirm with Depop, especially for Australia.

### Cited Findings
- Depop's lead markets are "US, Australia, and UK," with 43.5M+ registered users. — [Why Depop?](https://partnerapi.depop.com/api-docs/why-depop/)
- Pricing Inspiration is "available only for UK and US items" and does not support luxury brands. The spec's error example reads "Country 'AU' is not supported. Supported countries: GB, US" on that endpoint only. — [Pricing Inspiration](https://partnerapi.depop.com/api-docs/concepts/pricing-inspiration/); [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- Common shipping providers named: USPS (US), MY_HERMES/EVRI (UK), SENDLE (Australia). If none is available for an address, use manual shipping. — [Managing Shipping](https://partnerapi.depop.com/api-docs/how-to-guides/managing-shipping/)
- Size data supports US, GB and EU sizing, with "IT" representing Europe in `size_set_by_region`. — [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/)
- `address.country_code` is a free string in the spec with GB and US examples, with no enum. — [openapi.yaml](https://partnerapi.depop.com/api-docs/openapi.yaml)
- Departments: womenswear, menswear, kidswear, everything-else. Each taxonomy item has a `status` field whose meaning is unexplained. — [Reference](https://partnerapi.depop.com/api-docs/reference/); [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/)
- The terms impose no partner geographic limit; personal-data transfers outside the UK are covered by an IDTA (Sch. 4). — [Terms](https://partnerapi.depop.com/api-docs/terms/)
- Help-centre sources: Depop Protection for sellers is described as unavailable outside the UK, US or Australia, and a search-result reading of the current ToS lists protection and shipping labels only for UK and US. These conflict on Australia. — [Depop Protection](https://depophelp.zendesk.com/hc/en-gb/articles/360001845367-Depop-Protection-for-sellers); [Terms of Service](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service) (ToS page returned 403 to direct fetch; read only via search excerpt)
- Depop's fees page in the API docs says Depop charges UK/US buyers a fee and sellers pay a transaction fee and any boosting fee. — [Fees](https://partnerapi.depop.com/api-docs/concepts/fees/)

### Inferences
- The UK and US are the safest launch markets. Australia is plausible but its feature parity is unverified.
- Category scope is fashion-led with an "everything-else" department. Prohibited-item rules likely come from Depop's general policies, which were not read in full.

### Gaps
- No authoritative list of API-supported listing countries was found.
- Depop's prohibited-items policy was not retrieved. API docs state no explicit category restrictions.

## Which official partners/integrations exist?

### Takeaway
Depop publishes no partner directory that I could find. Vendoo is the clearest confirmed move onto the official API (July 2026), and Nifty's flow looks like OAuth. Status for List Perfectly, Crosslist and others is unverified, and most of the evidence is vendor-sourced.

### Cited Findings
- Vendoo (published 20 July 2026, updated 21 July): connection "now runs on the official Depop API" instead of the extension-based legacy method. Listing, delisting, import, sync, Sale Detection, sharing and offers no longer need the extension. Sync runs every 30 minutes. Price Suggestions appear in its Depop form. Sellers must reconnect; the legacy method is being retired, with no date given. — [Vendoo blog](https://blog.vendoo.co/new-depop-api-integration)
- Nifty: the seller is redirected to Depop, logs in and "grant[s] Nifty permission," then returns. Its docs say "Depop connections last 12 months." — [Nifty docs](https://docs.nifty.ai/connections/connecting-depop). A search excerpt of the same page instead reported about 1 month and extension or magic-link options, plus a footer saying Nifty uses the Depop API but is not endorsed or certified by Depop Limited; the fetched page did not show these. The 12-month figure matches Depop's 1-year refresh token. — [Using OAuth Refresh Tokens](https://partnerapi.depop.com/api-docs/how-to-guides/using-oauth-refresh-tokens/)
- List Perfectly's March 12, 2026 post covers Depop's ToS on crosslisting but does not say how it connects. — [List Perfectly](https://listperfectly.com/?p=11465)
- Crosslist, FLUF, ExportYourStore, Voolist and Shopfront all advertise Depop support, but none of the pages retrieved confirms the official API. Shopfront calls Depop's categories "undocumented," which is contradicted by Depop's Taxonomy page. — [Crosslist](https://crosslist.com/marketplaces/depop); [FLUF](https://fluf.io/crosslisting/shopify-to-depop/); [ExportYourStore](https://apps.shopify.com/exportyourstore); [Shopfront](https://shopfront.app/depop-crosslisting/); [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/)
- Depop names brands and charities using the platform (Dr Martens, DKNY, Cancer Research UK, Salvation Army AU and others) but does not name tech partners. — [Why Depop?](https://partnerapi.depop.com/api-docs/why-depop/)
- Depop's Terms of Service (effective 29 March 2026, per search excerpt) say sellers may list on other marketplaces "via third party cross-listing platforms," provided they comply with the ToS and remove sold items promptly. List Perfectly's post corroborates this. — [Terms of Service](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148); [List Perfectly](https://listperfectly.com/?p=11465)

### Inferences
- Vendoo's migration is evidence that cross-listers are being moved to OAuth and that Depop is formalising the channel. The retirement of its legacy method, together with the terms' ban on extensions and scraping without authorisation, suggests extension-based integration is a poor option for a new entrant. Vendoo is an established vendor, so its access does not prove a startup would get the same.
- The ToS carve-out covers sellers using cross-listing platforms, and Velista's own delist behaviour should meet the "remove sold items promptly" duty.

### Gaps
- No official Depop list of approved partners. A Shopify first-party Depop app was not found.
- The current ToS wording on bots and third-party software could not be confirmed: direct fetch returned 403, and only an unofficial GitHub quote of a possibly older version was seen.

## Company status: ownership change and effect on API access or roadmap

### Takeaway
eBay bought Depop from Etsy; the sale closed 30 July 2026. eBay says Depop keeps its own brand and platform and that it will accelerate Depop's roadmap. The API kept shipping after closing, and no statement about API policy under eBay was found.

### Cited Findings
- Sale agreement signed 15 February 2026 (supplemented 21 May, amended 12 July 2026); closed 30 July 2026. — [Etsy 10-Q, Q3 2026](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000092/etsy-20260930.htm)
- Consideration: $1.4B total, being $1.2B purchase price plus $200.0M net adjustments and interest. Etsy booked an $839.7M gain. This reconciles press reports citing either $1.2B or $1.4B. — [Etsy 10-Q](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000092/etsy-20260930.htm); [The Industry](https://www.theindustry.fashion/ebay-completes-1-2bn-acquisition-of-depop/); [FashionUnited](https://fashionunited.uk/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073089533)
- The UK CMA decided on 15 July not to refer the deal to Phase 2. This comes from a search summary of press coverage; neither the CMA primary source nor the specific article was read, so treat as unconfirmed. — [FashionUnited (coverage of closing)](https://fashionunited.uk/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073089533)
- eBay says Depop will run as a complementary business "retaining its distinct brand, platform, customer experience, and culture." Peter Semple remains CEO. eBay plans to combine its capabilities (shipping, personalization, compliance, trusted services) and accelerate Depop's existing product roadmap. — [Depop newsroom, 30 July 2026](https://news.depop.com/ebay-completes-acquisition-of-depop/)
- API changes after close include self-serve webhooks and `v1:product.update` (Aug 2026), `v1:product.create` and SKU editing (Sept 2026), and a sort-order change (Oct 2026). — [Changelog](https://partnerapi.depop.com/api-docs/changelog/)
- Depop's API site is stale on ownership: it still says "Joined Etsy Inc. in 2021," and no fetched API doc page mentions eBay. — [Why Depop?](https://partnerapi.depop.com/api-docs/why-depop/)

### Inferences
- Near-term API continuity looks good: same entity, same docs and continued releases. Longer-term risk remains: eBay could change terms (30-day notice for material changes, cl. 14.5) or align Depop with its own developer programme, but no source says so.
- An ownership change may slow or reshape partner onboarding. That is speculation; no evidence either way.

### Gaps
- No public statement found on API policy, partner onboarding or eBay Developer Program alignment after the acquisition.
- The EcommerceBytes piece "eBay to Operate Depop as It Seeks Synergies" (Aug 2026) appeared in search, but the fetched URL returned only a site closing notice, so it was not used.
- Transition services arrangements with Etsy were not found in the 10-Q passages reviewed.
