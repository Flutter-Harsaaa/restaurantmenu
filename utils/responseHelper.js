// utils/responseHelper.js
class ResponseHelper {
  static success(res, data, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      status: statusCode,
      message,
      data
    });
  }

  static error(res, message = "Error", statusCode = 400, data = null) {
    return res.status(statusCode).json({
      success: false,
      status: statusCode,
      message,
      data
    });
  }
}

module.exports = ResponseHelper;
