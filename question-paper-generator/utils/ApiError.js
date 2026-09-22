export default class ApiError extends Error {
  constructor(statusCode, message, errorCode = 'INVALID_REQUEST') {
    super(message); this.name = 'ApiError'; this.statusCode = statusCode; this.errorCode = errorCode;
  }
  static badRequest(message, code) { return new ApiError(400, message, code); }
}
