export default class ApiResponse {
  constructor(message, data = {}) { this.success = true; this.message = message; this.data = data; }
  static success(res, message, data = {}, statusCode = 200) { return res.status(statusCode).json(new ApiResponse(message, data)); }
}
