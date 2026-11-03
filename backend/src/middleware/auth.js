import { store } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/errors.js';
import { readSessionToken, tokenFromRequest } from '../utils/session.js';

// Loads the signed-in user into req.user, or responds 401.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const userId = readSessionToken(tokenFromRequest(req));
  if (!userId) throw new HttpError(401, 'Please sign in to continue.');
  const user = await store.findUserById(userId);
  if (!user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  req.user = user;
  next();
});
