export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

export function checkEnv(): { ok: boolean; missing: string[] } {
  const required = ['DATABASE_URL', 'REDIS_URL', 'OPENAI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
}
