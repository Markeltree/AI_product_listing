import { TITLE_MAX } from '../../config/constants.js';
import { sanitizeTags } from '../../validators/listing.sanitizer.js';
import { clean, splitList } from '../../utils/text.js';

// Template generator: used when no AI key is configured or the AI call fails.
// It only uses facts the seller entered, so it never invents materials or sizes.
export function templateContent(listing) {
  const p = listing.product || {};
  const media = (listing.media || []).filter((m) => m.kind === 'image');
  const name = clean(p.name, 100) || 'Handmade item';
  const type = clean(p.type, 60);
  const materials = splitList(p.materials);
  const colors = splitList(p.colors);
  const keywords = splitList(p.keywords);
  const handmade = p.whoMade === 'i_did' ? 'Handmade' : '';

  const titleParts = [name];
  if (materials[0]) titleParts.push(materials[0]);
  if (colors[0]) titleParts.push(colors[0]);
  if (type && !name.toLowerCase().includes(type.toLowerCase())) titleParts.push(type);
  if (handmade) titleParts.push(handmade);
  const title = titleParts.join(', ').slice(0, TITLE_MAX);

  const typeIsNew = type && !name.toLowerCase().includes(type.toLowerCase());
  const intro = [
    `Introducing ${name}${p.brand ? ` from ${clean(p.brand, 60)}` : ''}${typeIsNew ? `, a ${type.toLowerCase()}` : ''}.`,
    p.audience ? `Designed with ${clean(p.audience, 120)} in mind.` : '',
    p.notes ? clean(p.notes, 500) : '',
  ].filter(Boolean).join(' ');

  const details = [];
  if (materials.length) details.push(`- Materials: ${materials.join(', ')}`);
  if (colors.length) details.push(`- Colors: ${colors.join(', ')}`);
  if (p.dimensions) details.push(`- Dimensions: ${clean(p.dimensions, 120)}`);
  if (p.whoMade === 'i_did') details.push('- Made by hand by the shop owner');

  const description = [intro, details.length ? details.join('\n') : '', 'Ask us a question anytime. We are happy to help you choose the right piece.']
    .filter(Boolean)
    .join('\n\n');

  const tagSource = [...keywords, type, name, ...materials, ...colors].map((t) => clean(t, 40)).filter(Boolean);
  const tags = sanitizeTags(tagSource);

  const attributes = [];
  if (materials.length) attributes.push({ name: 'Materials', value: materials.join(', ') });
  if (colors.length) attributes.push({ name: 'Color', value: colors[0] });
  if (p.dimensions) attributes.push({ name: 'Dimensions', value: clean(p.dimensions, 120) });
  if (p.brand) attributes.push({ name: 'Brand', value: clean(p.brand, 60) });

  return {
    title,
    description,
    tags,
    category: type || name,
    attributes,
    altTexts: media.map((m, i) => `${name}${colors[0] ? `, ${colors[0]}` : ''} photo ${i + 1}`),
    suggestedPrice: null,
    pricingNote: 'Set your price from your costs and what comparable listings charge.',
  };
}
