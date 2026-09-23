import { createHash } from "crypto";
import { NextResponse } from "next/server";

function sessionValue() {
  const password = process.env.APP_LOGIN_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) return null;
  return createHash("sha256").update(password + ":" + secret).digest("hex");
}

export async function POST(request: Request) {
  const expectedUser = process.env.APP_LOGIN_USER;
  const expectedPassword = process.env.APP_LOGIN_PASSWORD;
  const token = sessionValue();

  if (!expectedUser || !expectedPassword || !token) {
    return NextResponse.json({error: "Login ainda não configurado na Vercel."}, {status: 503});
  }

  const body = await request.json().catch(() => ({}));
  if (body.username !== expectedUser || body.password !== expectedPassword) {
    return NextResponse.json({error: "Usuário ou senha inválidos."}, {status: 401});
  }

  // "Lembrar de mim" estende a sessão para 30 dias; sem marcar, mantém as 12h atuais.
  const maxAge = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;

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
