// Express 4 does not catch rejected promises from async handlers. This forwards them to the error handler,
// so a failed database call returns a 500 instead of leaving the request hanging.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
