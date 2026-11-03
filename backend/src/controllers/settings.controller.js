import { LANGUAGES, MIN_PRICE, TONES, WHEN_MADE, WHO_MADE } from '../config/constants.js';
import { getUserSettings, updateUserSettings } from '../services/settings.service.js';

// Choices the settings form can offer.
const OPTIONS = { tones: TONES, languages: LANGUAGES, whoMade: WHO_MADE, whenMade: WHEN_MADE, minPrice: MIN_PRICE };

export async function get(req, res) {
  res.json({ settings: await getUserSettings(req.user.id), options: OPTIONS });
}

export async function update(req, res) {
  res.json({ settings: await updateUserSettings(req.user.id, req.body) });
}
