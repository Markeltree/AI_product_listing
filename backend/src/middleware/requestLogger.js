import { randomUUID } from "node:crypto";
import { log, runWithRequestId } from "../utils/logger.js";
export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  const started = Date.now();
  let errorMessage;
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body?.error) errorMessage = body.error;
    return json(body);
  };
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () =>
    runWithRequestId(requestId, () => {
      const details = {
        status: res.statusCode,
        ms: Date.now() - started,
        error: errorMessage,
      };
      const line = `${req.method} ${req.originalUrl.split("?")[0]}`;
      if (res.statusCode >= 500) log.error("api", line, details);
      else if (res.statusCode >= 400) log.warn("api", line, details);
      else log.info("api", line, { status: details.status, ms: details.ms });
    }),
  );
  runWithRequestId(requestId, next);
}
