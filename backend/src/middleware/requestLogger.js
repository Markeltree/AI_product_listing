// One line per API request: method, path, status, time, and the error message for failures.
// Example: [api] POST /api/listings 400 12ms - Photos must be JPG, PNG, WEBP or GIF.
export function requestLogger(req, res, next) {
  const started = Date.now();
  let errorMessage = '';
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body?.error) errorMessage = body.error;
    return json(body);
  };
  res.on('finish', () => {
    const line = `[api] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`;
    if (res.statusCode >= 400) console.warn(errorMessage ? `${line} - ${errorMessage}` : line);
    else console.log(line);
  });
  next();
}
