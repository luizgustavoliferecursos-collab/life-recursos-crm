import { NextRequest, NextResponse } from "next/server";

// Proxy same-origin pro backend do Render: o middleware ja garantiu que so
// chega aqui quem tem sessao valida (life_auth) e ja anexou x-user-* nos
// headers do request. Este proxy so repassa isso adiante, mais o segredo
// interno que o Python passou a exigir - sem isso, ate agora qualquer um que
// soubesse a URL do Render acessava a API direto, sem login nenhum.
const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const SHARED_SECRET = process.env.BACKEND_SHARED_SECRET || "";

async function proxy(request: NextRequest, path: string[]) {
  if (!API) {
    return NextResponse.json({error: "Backend não configurado."}, {status: 503});
  }

  const targetUrl = `${API}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (SHARED_SECRET) headers.set("x-internal-secret", SHARED_SECRET);
  for (const name of ["x-user-id", "x-user-nome", "x-user-papel"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  const respContentType = backendResponse.headers.get("content-type");
  if (respContentType) responseHeaders.set("content-type", respContentType);
  const body = await backendResponse.arrayBuffer();
  return new NextResponse(body, {status: backendResponse.status, headers: responseHeaders});
}

type RouteContext = {params: Promise<{path: string[]}>};

export async function GET(request: NextRequest, {params}: RouteContext) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, {params}: RouteContext) {
  return proxy(request, (await params).path);
}
export async function PUT(request: NextRequest, {params}: RouteContext) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: NextRequest, {params}: RouteContext) {
  return proxy(request, (await params).path);
}
