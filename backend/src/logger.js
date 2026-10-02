const level = process.env.LOG_LEVEL || 'info';
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
function log(lv, ...args) {
  if (levels[lv] > levels[level]) return;
  const ts = new Date().toISOString();
  if (lv === 'error') console.error(`[${ts}][${lv}]`, ...args);
  else console.log(`[${ts}][${lv}]`, ...args);
}
export const logger = {
  error: (...a) => log('error', ...a),
  warn: (...a) => log('warn', ...a),
  info: (...a) => log('info', ...a),
  debug: (...a) => log('debug', ...a),
};
