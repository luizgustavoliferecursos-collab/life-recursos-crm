import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "../../../lib/session";

export async function GET(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const cookie = request.cookies.get("life_auth")?.value;
  const session = secret ? await verifySession(cookie, secret) : null;
  if (!session) {
    return NextResponse.json({error: "Não autenticado."}, {status: 401});
  }
  return NextResponse.json({
    nome: session.nome,
    papel: session.papel,
    condominio_id: session.condominio_id,
  });
}
