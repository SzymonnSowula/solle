export function logger(name: string) {
  return {
    info: (msg: string, ...args: unknown[]) => console.log(`[${name}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[${name}] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[${name}] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`[${name}] ${msg}`, ...args);
      }
    },
  };
}
