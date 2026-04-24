const logger = require("../logger");

module.exports = function errorHandler(err, req, res, _next) {
    logger.error("unhandled error", {
        message: err.message,
        stack: err.stack,
        requestId: req.id,
        url: req.url,
        method: req.method,
    });
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
};
