import { NextResponse } from 'next/server';

export function jsonError(error: string, code: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error, code }, { status, headers });
}

/** Body size-limited JSON reader. Lautata hai {ok:true,value} ya {ok:false,response}. */
export async function readJson(
  req: Request,
  maxBytes = 20_000
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return { ok: false, response: jsonError('Request too large.', 'TOO_LARGE', 413) };
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, response: jsonError('Request too large.', 'TOO_LARGE', 413) };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body.', 'BAD_REQUEST', 400) };
  }
}
