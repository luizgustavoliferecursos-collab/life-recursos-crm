import { NextRequest, NextResponse } from "next/server";
import { signUploadToken } from "../../../lib/session";

// O middleware ja exigiu sessao valida pra chegar aqui e anexou x-user-id.
// Este token de curta duracao e o que permite ao navegador chamar
// /api/documentos/processar DIRETO no Render (sem passar pelo proxy
// same-origin, que tem limite de 4.5MB de corpo - pequeno demais pra PDF
// escaneado) sem expor o segredo interno de servidor para servidor.
export async function POST(request: NextRequest) {
  const secret = process.env.BACKEND_SHARED_SECRET || "";
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({error: "Nao autenticado."}, {status: 401});
  }
  // Sem o segredo configurado ainda (transicao), o backend tambem nao exige
  // token nenhum - devolve um token vazio, que so seria usado nesse cenario.
  const token = secret ? await signUploadToken(userId, secret) : "";
  return NextResponse.json({token});
}
