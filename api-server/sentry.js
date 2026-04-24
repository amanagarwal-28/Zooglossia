const Sentry = require("@sentry/node");

function initSentry() {
    const dsn = process.env.SENTRY_DSN_API;
    if (!dsn) return;

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.2,
    });
}

module.exports = { Sentry, initSentry };
