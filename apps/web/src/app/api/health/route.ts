import { NextResponse } from 'next/server';
import { checkPostgres } from '@/lib/db/postgres';
import { checkEnv } from '@/lib/utils/env';

export async function GET() {
  const env = checkEnv();
  const pg = await checkPostgres();

  const status = env.ok && pg.ok ? 200 : 503;

  return NextResponse.json(
    {
      ok: env.ok && pg.ok,
      env: { ok: env.ok, missing: env.missing },
      postgres: pg,
    },
    { status }
  );
}
