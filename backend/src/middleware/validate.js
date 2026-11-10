import { badRequest, notFound } from "../utils/errors.js";

const PARTS = ["params", "query", "body"];

export function validate(schemas) {
  return (req, _res, next) => {
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join(".");
        // A malformed id in the URL is the same as an id that does not exist.
        if (part === "params") return next(notFound(issue.message));
        const message =
          issue.code === "invalid_type" && issue.input === undefined
            ? `${field || "A field"} is required.`
            : issue.code === "invalid_type"
              ? `${field || "A field"} has the wrong type.`
              : issue.message;
        return next(badRequest(message, field ? { field } : {}));
      }
      req[part] = result.data;
    }
    next();
  };
}
