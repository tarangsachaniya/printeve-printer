import { NextResponse } from "next/server";
import { reportClientError } from "@/lib/log-error";

// Deliberately unauthenticated — client-side errors can happen before login.
// Cheap same-origin check since this is otherwise an open, internet-facing sink.
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (isSameOrigin(request)) {
    const body = await request.json().catch(() => null);
    if (body?.message && typeof body.message === "string") {
      reportClientError({
        message: body.message,
        stack: typeof body.stack === "string" ? body.stack : undefined,
        digest: typeof body.digest === "string" ? body.digest : undefined,
        path: typeof body.path === "string" ? body.path : undefined,
        status: typeof body.status === "number" ? body.status : undefined,
      });
    }
  }

  // Best-effort telemetry — never surface failure back to the caller.
  return NextResponse.json({ ok: true });
}
