import { NextResponse } from "next/server";
import { signSession } from "../../../lib/session";

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !API) {
    return NextResponse.json({error: "Login ainda não configurado na Vercel."}, {status: 503});
  }

  const body = await request.json().catch(() => ({}));
  const login = body.username;
  const senha = body.password;
  if (!login || !senha) {
    return NextResponse.json({error: "Informe usuário e senha."}, {status: 400});
  }

  let usuario: any;
  try {
    const backendResponse = await fetch(API + "/api/auth/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({login, senha}),
    });
    const payload = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json({error: payload.detail || "Usuário ou senha inválidos."}, {status: backendResponse.status});
    }
    usuario = payload;
  } catch {
    return NextResponse.json({error: "Não foi possível validar o login (backend indisponível)."}, {status: 503});
  }

  // "Lembrar de mim" estende a sessão para 30 dias; sem marcar, mantém 12h.
  const maxAge = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const token = await signSession(
    {sub: usuario.id, nome: usuario.nome, papel: usuario.papel, condominio_id: usuario.condominio_id ?? null, exp},
    secret
  );

  const response = NextResponse.json({ok: true});
  response.cookies.set("life_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
