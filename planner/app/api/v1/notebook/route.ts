import { env } from 'cloudflare:workers';
import { handleApiRequest } from '@/lib/api-http';
import type { Database } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleApiRequest(request, env.DB as unknown as Database);
}

export async function POST(request: Request) {
  return handleApiRequest(request, env.DB as unknown as Database);
}
