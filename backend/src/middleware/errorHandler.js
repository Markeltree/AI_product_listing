import multer from 'multer';
import { HttpError } from '../utils/errors.js';

export function apiNotFound(_req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// Last middleware (Express needs all four arguments). HttpError messages are written for users; anything else is logged and hidden.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'One of your files is too large.'
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Too many files for one upload. Use up to 5 photos, 1 video and 1 voice note.'
        : err.message;
    return res.status(400).json({ error: message });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.details });
  // Errors from libraries (for example express.json on a bad body) carry a 4xx status.
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error('[server error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
