// The page a shop owner sees after connecting through an invite link (no Velista app involved).
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function connectDone(req, res) {
  const market = req.query.ebay ? "eBay" : "Etsy";
  const outcome = String(req.query.etsy || req.query.ebay || "");
  const ok = outcome === "connected";
  const title = ok
    ? `Your ${market} shop is connected`
    : `${market} was not connected`;
  const body = ok
    ? `Thank you. Velista can now create and update listings in your ${market} shop. You can close this page.${req.query.warning ? `<br><br><em>${esc(req.query.warning)}</em>` : ""}`
    : `${esc(req.query.message || "The connection did not finish.")}<br><br>Please ask the Velista team for a new link.`;
  res.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'",
  );
  res.type("html")
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Velista</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f4f0;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#1d1b18}
main{max-width:440px;margin:24px;padding:32px;background:#fff;border:1px solid #e9e4da;border-radius:20px;text-align:center}
.mark{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;font-size:28px;color:#fff;background:${ok ? "#2f8f5b" : "#c2412d"}}
h1{font-size:21px;margin:0 0 10px}p{margin:0;color:#57524a}</style></head>
<body><main><div class="mark">${ok ? "✓" : "!"}</div><h1>${esc(title)}</h1><p>${body}</p></main></body></html>`);
}
