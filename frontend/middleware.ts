import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./app/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const cookie = secret ? request.cookies.get("life_auth")?.value : undefined;
  const session = secret ? await verifySession(cookie, secret) : null;

  if (!session) {
    // Uma rota de API (ex.: /api/proxy/*) precisa de um 401 em JSON, nao de um
    // redirect: o fetch do cliente seguiria o redirect ate a pagina HTML de
    // login e trataria isso como sucesso (response.ok=true, corpo vazio).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({error: "Nao autenticado."}, {status: 401});
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Repassa a identidade ja verificada pro proxy do backend (frontend/app/api/proxy),
  // que injeta isso como headers pro Python conseguir atribuir a auditoria a um
  // usuario real, sem precisar reverificar o cookie assinado em outro lugar.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.sub);
  requestHeaders.set("x-user-nome", encodeURIComponent(session.nome));
  requestHeaders.set("x-user-papel", session.papel);
  return NextResponse.next({request: {headers: requestHeaders}});
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
