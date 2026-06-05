const prefix = '[IMPORT]';

function logInfo(...args: any[]): void {
  console.info(prefix, ...args);
}

function logWarn(...args: any[]): void {
  console.warn(prefix, ...args);
}

function logError(...args: any[]): void {
  console.error(prefix, ...args);
}

export const logger = {
  info: logInfo,
  warn: logWarn,
  error: logError,
};

export default logger;
