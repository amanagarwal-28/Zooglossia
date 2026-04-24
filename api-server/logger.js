const { createLogger, format, transports } = require("winston");

const isProd = process.env.NODE_ENV === "production";

const logger = createLogger({
    level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
    format: isProd
        ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
        : format.combine(format.colorize(), format.timestamp({ format: "HH:mm:ss" }), format.printf(
            ({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                return `${timestamp} ${level}: ${message}${metaStr}`;
            }
          )),
    transports: [new transports.Console()],
});

module.exports = logger;
