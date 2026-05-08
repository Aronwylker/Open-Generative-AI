// Proxy for muapi.ai API to avoid browser CORS restrictions.
// Browser hits /api/v1/<path> on this same origin; this server handler
// forwards the request to https://api.muapi.ai/api/v1/<path> and streams
// the response back. The user's API key (x-api-key header) is forwarded
// transparently and never leaves the user's session.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://api.muapi.ai/api/v1';

async function proxy(request, ctx) {
  const params = await ctx.params;
  const segments = Array.isArray(params?.path) ? params.path : [];
  const search = new URL(request.url).search || '';
  const target = UPSTREAM + '/' + segments.join('/') + search;

  const headers = new Headers();
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) headers.set('x-api-key', apiKey);
  const ct = request.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(target, init);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Upstream fetch failed', message: String(err && err.message || err) }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }

  const respHeaders = new Headers();
  const contentType = upstreamRes.headers.get('content-type');
  if (contentType) respHeaders.set('content-type', contentType);
  const contentLength = upstreamRes.headers.get('content-length');
  if (contentLength) respHeaders.set('content-length', contentLength);

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,x-api-key,authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
