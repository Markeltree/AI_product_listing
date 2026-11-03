// An error whose message is safe to show to the user. `details` are merged into the JSON response.
export class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'That listing could not be found.') => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);
