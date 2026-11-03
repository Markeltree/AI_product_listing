import * as authService from '../services/auth.service.js';
import { createSessionToken } from '../utils/session.js';
import { readLogin, validateSignup } from '../validators/auth.validator.js';

// The app stores the returned token and sends it as a Bearer header.
function sendSession(res, status, user) {
  res.status(status).json({ user: authService.publicUser(user), token: createSessionToken(user.id) });
}

export async function signup(req, res) {
  const user = await authService.signup(validateSignup(req.body));
  sendSession(res, 201, user);
}

export async function login(req, res) {
  const user = await authService.login(readLogin(req.body));
  sendSession(res, 200, user);
}

// Tokens are stateless; the app signs out by deleting its copy.
export function logout(_req, res) {
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: authService.publicUser(req.user) });
}
