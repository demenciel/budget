import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleKeyManagementRequest } from '@/lib/api-http';
import type { Database } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleKeyManagementRequest(
    request,
    env.DB as unknown as Database,
    await getChatGPTUser(),
  );
}

export async function POST(request: Request) {
  return handleKeyManagementRequest(
    request,
    env.DB as unknown as Database,
    await getChatGPTUser(),
  );
}

export async function DELETE(request: Request) {
  return handleKeyManagementRequest(
    request,
    env.DB as unknown as Database,
    await getChatGPTUser(),
  );
}
