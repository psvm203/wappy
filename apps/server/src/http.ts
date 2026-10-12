import type { IncomingMessage, ServerResponse } from "node:http";
import { isRecord, type Output, type Route } from "@wappy/api";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readBody(req: IncomingMessage): Promise<unknown> {
  if (
    req.headers["content-type"]?.split(";")[0]?.trim() !== "application/json"
  ) {
    throw new HttpError(415, "JSON 형식으로 요청해 주세요.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new HttpError(413, "요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "올바른 JSON이 아닙니다.");
  }
}

export function field(body: unknown, key: string): string {
  if (
    !isRecord(body) ||
    typeof body[key] !== "string" ||
    !body[key].trim() ||
    body[key].length > 128
  ) {
    throw new HttpError(400, "입력값을 확인해 주세요.");
  }
  return body[key].trim();
}

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function reply<R extends Route>(
  res: ServerResponse,
  _route: R,
  body: Output<R>,
  status = 200,
) {
  json(res, status, body);
}
