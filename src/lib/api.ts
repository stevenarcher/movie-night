import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function ok(data: unknown) {
  return json(data, { status: 200 });
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Authentication required") {
  return json({ error: message }, { status: 401 });
}

export function conflict(message: string) {
  return json({ error: message }, { status: 409 });
}

export function serverError(message = "Internal server error") {
  return json({ error: message }, { status: 500 });
}