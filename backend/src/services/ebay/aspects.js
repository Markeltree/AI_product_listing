// Fills eBay item specifics (aspects) for a category from what Velista already knows about the
// product. Required aspects that are still missing are asked of the AI, limited to eBay's allowed values.
import { askAiJson } from '../ai/index.js';

const norm = (s) => String(s || '').trim().toLowerCase();
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((x) => String(x).trim()).filter(Boolean);

// What we know, keyed by a lowercase aspect name.
function knownFacts(listing) {
  const p = listing.product || {};
  const d = listing.analysis?.detected || {};
  const facts = new Map();
  const put = (names, value) => {
    const values = list(value);
    if (!values.length) return;
    for (const n of names) if (!facts.has(n)) facts.set(n, values);
  };
  for (const a of listing.content?.attributes || []) put([norm(a.name)], a.value);
  put(['brand'], p.brand || d.brand);
  put(['color', 'main color', 'colour'], p.colors || d.colors);
  put(['material', 'main material', 'materials'], p.materials || d.materials);
  put(['type', 'product type', 'product'], p.type || d.productType);
  put(['style'], d.style);
  put(['handmade'], p.whoMade === 'i_did' || p.whoMade === 'collective' ? 'Yes' : null);
  return facts;
}

// Keeps only values eBay accepts for a SELECTION_ONLY aspect (case-insensitive), in eBay's spelling.
function allowed(aspect, values) {
  if (aspect.mode !== 'SELECTION_ONLY' || !aspect.values.length) return values;
  const byLower = new Map(aspect.values.map((v) => [norm(v), v]));
  return values.map((v) => byLower.get(norm(v))).filter(Boolean);
}

const limit = (aspect, values) => (aspect.multi ? values.slice(0, 30) : values.slice(0, 1)).map((v) => v.slice(0, 65));

async function askAi(listing, missing) {
  const p = listing.product || {};
  const prompt = `Fill in eBay item specifics for this product. Use only facts stated below or clearly implied by the product type.
Product: ${JSON.stringify({
    title: listing.content?.title, type: p.type, materials: p.materials, colors: p.colors, brand: p.brand,
    dimensions: p.dimensions, description: String(listing.content?.description || '').slice(0, 1500),
    detected: listing.analysis?.detected || {},
  })}

Item specifics to fill (when "allowed" is given, the value must be one of those exactly):
${JSON.stringify(missing.map((a) => ({ name: a.name, allowed: a.values.slice(0, 60), multiple: a.multi })))}

If a value is unknown, use "Unbranded" for Brand and "Does Not Apply" otherwise (only when it is allowed).
Return a JSON object mapping each name to an array of strings.`;
  try {
    return (await askAiJson(prompt)) || {};
  } catch {
    return {};
  }
}

// Returns { aspects: { Name: [values] }, missing: [names still empty that eBay requires] }.
export async function buildAspects(listing, categoryAspects) {
  const facts = knownFacts(listing);
  const aspects = {};
  const missing = [];

  for (const aspect of categoryAspects) {
    const values = limit(aspect, allowed(aspect, facts.get(norm(aspect.name)) || []));
    if (values.length) aspects[aspect.name] = values;
    else if (aspect.required) missing.push(aspect);
  }

  if (missing.length) {
    const answers = await askAi(listing, missing);
    const answerFor = (name) => Object.entries(answers).find(([k]) => norm(k) === norm(name))?.[1];
    for (const aspect of [...missing]) {
      let values = limit(aspect, allowed(aspect, list(answerFor(aspect.name))));
      if (!values.length) {
        const fallback = norm(aspect.name) === 'brand' ? 'Unbranded' : 'Does Not Apply';
        values = limit(aspect, allowed(aspect, [fallback]));
      }
      if (values.length) {
        aspects[aspect.name] = values;
        missing.splice(missing.indexOf(aspect), 1);
      }
    }
  }
  return { aspects, missing: missing.map((a) => a.name) };
}
