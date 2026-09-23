import base64
import hashlib
import io
import json
import os
import re
import unicodedata
from datetime import date
from typing import Any

import anthropic
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from PIL import Image
from pydantic import BaseModel, Field, field_validator
from supabase import create_client

APP_NAME = "LIFE Recursos API"
DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]
VALID_MIME_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
VALID_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
VALID_ROLES = ["ASG", "Diarista", "Guardiao", "Portaria", "Seguranca", "Staff"]
VALID_CARGOS = VALID_ROLES + ["Pendente"]
VALID_TIPOS_CONTRATO = ["CLT", "Terceirizado", "Autonomo"]
FOLDER_TO_ROLE = {
    "ASG": "ASG",
    "Diarista": "Diarista",
    "Guardião": "Guardiao",
    "Guardiao": "Guardiao",
    "Portaria": "Portaria",
    "Segurança": "Seguranca",
    "Seguranca": "Seguranca",
    "Staff": "Staff",
}

app = FastAPI(title=APP_NAME, version="1.0.0")

def env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default

def required(name: str) -> str:
    value = env(name)
    if not value:
        raise RuntimeError(f"Variavel obrigatoria ausente: {name}")
    return value

def allowed_origins() -> list[str]:
    raw = env("ALLOWED_ORIGINS", "") or ""
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]

origins = allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)

def decode_json_secret(direct_name: str, b64_name: str) -> dict[str, Any] | None:
    raw = env(direct_name)
    if raw:
        return json.loads(raw)
    raw_b64 = env(b64_name)
    if raw_b64:
        return json.loads(base64.b64decode(raw_b64).decode("utf-8"))
    return None

def get_supabase():
    return create_client(required("SUPABASE_URL"), required("SUPABASE_KEY"))

def get_anthropic():
    return anthropic.Anthropic(api_key=required("ANTHROPIC_API_KEY"))

def get_drive():
    mode = (env("GOOGLE_AUTH_MODE", "oauth") or "oauth").lower()

    if mode == "service_account":
        info = decode_json_secret("GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON_B64")
        if not info:
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_JSON_B64 ausente")
        creds = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPE)
    else:
        token_info = decode_json_secret("GOOGLE_OAUTH_TOKEN_JSON", "GOOGLE_OAUTH_TOKEN_JSON_B64")
        if not token_info:
            raise RuntimeError("GOOGLE_OAUTH_TOKEN_JSON ou GOOGLE_OAUTH_TOKEN_JSON_B64 ausente")

        client_info = decode_json_secret("GOOGLE_OAUTH_CLIENT_JSON", "GOOGLE_OAUTH_CLIENT_JSON_B64") or {}
        client_data = client_info.get("installed") or client_info.get("web") or client_info

        if token_info.get("client_id") and token_info.get("client_secret"):
            creds = Credentials.from_authorized_user_info(token_info, scopes=DRIVE_SCOPE)
        else:
            creds = Credentials(
                token=token_info.get("token"),
                refresh_token=token_info.get("refresh_token"),
                token_uri=token_info.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=client_data.get("client_id"),
                client_secret=client_data.get("client_secret"),
                scopes=DRIVE_SCOPE,
            )

        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleAuthRequest())

    return build("drive", "v3", credentials=creds, cache_discovery=False)

def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("ASCII")
    return re.sub(r"\s+", " ", text).strip()

def safe_filename_piece(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "", normalize_text(text).replace(" ", "")) or "Documento"

def image_to_pdf(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as image:
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")
        output = io.BytesIO()
        image.save(output, format="PDF", resolution=150.0)
        return output.getvalue()

def identify_document(client: anthropic.Anthropic, pdf_bytes: bytes) -> dict[str, Any]:
    encoded = base64.standard_b64encode(pdf_bytes).decode("utf-8")
    prompt = """Analise este documento escaneado de um funcionario de uma empresa.

Responda APENAS com JSON valido, sem markdown e sem texto adicional:
{
  "tipo_documento": "...",
  "nome_funcionario": "...",
  "ano": 2026,
  "condominio": "..."
}

Regras:
- tipo_documento: nome curto e padronizado (Contrato, ASO, CertificadoEPI, FolhaDePonto, CertificadoQualificacao). Se incerto, use Documento.
- nome_funcionario: nome completo como aparece no documento, com capitalizacao normal. Se nao houver confianca, use null.
- ano: ano principal do documento; se desconhecido, use null.
- condominio: nome do condominio/local de trabalho se constar; se nao, use null.
"""
    response = client.messages.create(
        model=env("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": encoded,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = response.content[0].text.strip()
    text = re.sub(r"^\`\`\`(?:json)?|\`\`\`$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)

def find_subfolder(drive, name: str, parent_id: str) -> str | None:
    escaped = name.replace("\\", "\\\\").replace("'", "\\'")
    query = (
        f"'{parent_id}' in parents and trashed = false and "
        f"mimeType = 'application/vnd.google-apps.folder' and name = '{escaped}'"
    )
    result = drive.files().list(q=query, fields="files(id,name)", pageSize=20).execute()
    files = result.get("files", [])
    return files[0]["id"] if files else None

def get_or_create_subfolder(drive, name: str, parent_id: str) -> str:
    existing = find_subfolder(drive, name, parent_id)
    if existing:
        return existing
    folder = drive.files().create(
        body={
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        },
        fields="id",
    ).execute()
    return folder["id"]

def role_folder_id(drive, role: str) -> str:
    root = required("DRIVE_EMPLOYEES_FOLDER_ID")
    for folder_name, normalized_role in FOLDER_TO_ROLE.items():
        if normalized_role == role:
            found = find_subfolder(drive, folder_name, root)
            if found:
                return found
    raise RuntimeError(f"Pasta do cargo '{role}' nao encontrada no Google Drive")

def destination_folder_id(drive, employee: dict[str, Any]) -> str:
    if employee.get("cargo") == "Pendente":
        root = required("DRIVE_PENDING_FOLDER_ID")
        return get_or_create_subfolder(drive, employee["nome"], root)
    return get_or_create_subfolder(drive, employee["nome"], role_folder_id(drive, employee["cargo"]))

def employee_match_key(name: str) -> str:
    # Remove acentos, normaliza espacos e ignora maiusculas/minusculas,
    # para "Ézio Castro" e "ezio  castro" apontarem para o mesmo funcionario.
    return normalize_text(name or "").casefold()

def find_employee_by_name(db, name: str) -> dict[str, Any] | None:
    target = employee_match_key(name)
    if not target:
        return None
    page_size = 1000
    start = 0
    while True:
        result = (
            db.table("funcionarios")
            .select("*")
            .order("id")
            .range(start, start + page_size - 1)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            if employee_match_key(row.get("nome", "")) == target:
                return row
        if len(rows) < page_size:
            return None
        start += page_size

def get_or_create_employee(db, name: str, condominium: str | None):
    employee = find_employee_by_name(db, name)
    if employee:
        if condominium and not employee.get("condominio"):
            db.table("funcionarios").update({"condominio": condominium}).eq("id", employee["id"]).execute()
            employee["condominio"] = condominium
        return employee

    created = db.table("funcionarios").insert({
        "nome": name,
        "cargo": "Pendente",
        "condominio": condominium,
    }).execute()
    return created.data[0]

def only_digits(value: str | None) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None

class FuncionarioCreate(BaseModel):
    nome: str = Field(min_length=1)
    cargo: str = "Pendente"
    condominio: str | None = None
    cpf: str | None = None
    rg: str | None = None
    data_nascimento: date | None = None
    telefone: str | None = None
    endereco: str | None = None
    contato_emergencia_nome: str | None = None
    contato_emergencia_telefone: str | None = None
    banco: str | None = None
    agencia: str | None = None
    conta: str | None = None
    chave_pix: str | None = None
    tipo_contrato: str | None = None
    salario_base: float | None = None
    data_admissao: date | None = None

    @field_validator("cargo")
    @classmethod
    def valida_cargo(cls, value: str) -> str:
        if value not in VALID_CARGOS:
            raise ValueError(f"Cargo invalido. Use um de: {', '.join(VALID_CARGOS)}")
        return value

    @field_validator("tipo_contrato")
    @classmethod
    def valida_tipo_contrato(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_TIPOS_CONTRATO:
            raise ValueError(f"Tipo de contrato invalido. Use um de: {', '.join(VALID_TIPOS_CONTRATO)}")
        return value

    @field_validator("cpf")
    @classmethod
    def valida_cpf(cls, value: str | None) -> str | None:
        digits = only_digits(value)
        if digits and len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos.")
        return digits

class FuncionarioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1)
    cargo: str | None = None
    condominio: str | None = None
    cpf: str | None = None
    rg: str | None = None
    data_nascimento: date | None = None
    telefone: str | None = None
    endereco: str | None = None
    contato_emergencia_nome: str | None = None
    contato_emergencia_telefone: str | None = None
    banco: str | None = None
    agencia: str | None = None
    conta: str | None = None
    chave_pix: str | None = None
    tipo_contrato: str | None = None
    salario_base: float | None = None
    data_admissao: date | None = None

    @field_validator("cargo")
    @classmethod
    def valida_cargo(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_CARGOS:
            raise ValueError(f"Cargo invalido. Use um de: {', '.join(VALID_CARGOS)}")
        return value

    @field_validator("tipo_contrato")
    @classmethod
    def valida_tipo_contrato(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_TIPOS_CONTRATO:
            raise ValueError(f"Tipo de contrato invalido. Use um de: {', '.join(VALID_TIPOS_CONTRATO)}")
        return value

    @field_validator("cpf")
    @classmethod
    def valida_cpf(cls, value: str | None) -> str | None:
        digits = only_digits(value)
        if digits and len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos.")
        return digits

class FuncionarioDesligar(BaseModel):
    motivo: str | None = None
    data_desligamento: date | None = None

def document_already_registered(db, employee_id: Any, doc_type: str, year: Any, file_name: str):
    query = db.table("documentos").select("id,arquivo_nome,arquivo_drive_url").eq("funcionario_id", employee_id).eq("tipo_documento", doc_type)
    if year is None:
        query = query.is_("ano", "null")
    else:
        query = query.eq("ano", year)
    result = query.limit(10).execute()
    for row in result.data or []:
        if row.get("arquivo_nome") == file_name:
            return row
    return None

def upload_pdf_to_drive(drive, data: bytes, file_name: str, folder_id: str) -> dict[str, Any]:
    media = MediaIoBaseUpload(io.BytesIO(data), mimetype="application/pdf", resumable=True)
    return drive.files().create(
        body={"name": file_name, "parents": [folder_id]},
        media_body=media,
        fields="id,name,webViewLink",
    ).execute()

def process_one(upload: UploadFile) -> dict[str, Any]:
    extension = os.path.splitext(upload.filename or "")[1].lower()
    if upload.content_type not in VALID_MIME_TYPES and extension not in VALID_EXTENSIONS:
        raise ValueError("Formato nao suportado. Envie PDF, JPG ou PNG.")

    max_mb = int(env("MAX_UPLOAD_MB", "30") or "30")
    raw = upload.file.read(max_mb * 1024 * 1024 + 1)
    if len(raw) > max_mb * 1024 * 1024:
        raise ValueError(f"Arquivo excede o limite de {max_mb} MB.")
    if not raw:
        raise ValueError("Arquivo vazio.")

    pdf_bytes = raw if extension == ".pdf" or upload.content_type == "application/pdf" else image_to_pdf(raw)
    checksum = hashlib.sha256(pdf_bytes).hexdigest()

    ai = get_anthropic()
    db = get_supabase()
    drive = get_drive()

    info = identify_document(ai, pdf_bytes)
    employee_name = info.get("nome_funcionario")
    if not employee_name:
        raise ValueError("A IA nao conseguiu identificar o funcionario com confianca.")

    doc_type = info.get("tipo_documento") or "Documento"
    year = info.get("ano")
    condominium = info.get("condominio")
    employee = get_or_create_employee(db, employee_name, condominium)

    target_name = f"{safe_filename_piece(doc_type)}_{safe_filename_piece(employee['nome'])}_{year or 'SemAno'}.pdf"
    existing = document_already_registered(db, employee["id"], doc_type, year, target_name)
    if existing:
        return {
            "status": "duplicado",
            "mensagem": "Documento ja cadastrado; nenhuma nova gravacao foi feita.",
            "funcionario": employee["nome"],
            "documento": doc_type,
            "condominio": employee.get("condominio"),
            "cargo": employee.get("cargo"),
            "ano": year,
            "arquivo_nome": existing.get("arquivo_nome"),
            "arquivo_drive_url": existing.get("arquivo_drive_url"),
            "checksum": checksum,
        }

    folder_id = destination_folder_id(drive, employee)
    uploaded = upload_pdf_to_drive(drive, pdf_bytes, target_name, folder_id)
    drive_url = uploaded.get("webViewLink") or f"https://drive.google.com/file/d/{uploaded['id']}/view"

    try:
        db.table("documentos").insert({
            "funcionario_id": employee["id"],
            "tipo_documento": doc_type,
            "ano": year,
            "arquivo_nome": target_name,
            "arquivo_drive_url": drive_url,
            "origem": "automacao",
        }).execute()
    except Exception:
        try:
            drive.files().delete(fileId=uploaded["id"]).execute()
        finally:
            raise

    return {
        "status": "sucesso",
        "funcionario": employee["nome"],
        "documento": doc_type,
        "condominio": employee.get("condominio"),
        "cargo": employee.get("cargo"),
        "ano": year,
        "arquivo_nome": target_name,
        "arquivo_drive_url": drive_url,
        "checksum": checksum,
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": APP_NAME,
        "configured": {
            "anthropic": bool(env("ANTHROPIC_API_KEY")),
            "supabase": bool(env("SUPABASE_URL") and env("SUPABASE_KEY")),
            "google": bool(
                env("GOOGLE_OAUTH_TOKEN_JSON")
                or env("GOOGLE_OAUTH_TOKEN_JSON_B64")
                or env("GOOGLE_SERVICE_ACCOUNT_JSON")
                or env("GOOGLE_SERVICE_ACCOUNT_JSON_B64")
            ),
            "drive_folders": bool(
                env("DRIVE_EMPLOYEES_FOLDER_ID") and env("DRIVE_PENDING_FOLDER_ID")
            ),
            "cors": bool(origins),
        },
    }

@app.get("/api/drive/status")
def drive_status():
    try:
        drive = get_drive()
        folders = {}
        for key, env_name in {
            "inbox": "DRIVE_INBOX_FOLDER_ID",
            "funcionarios": "DRIVE_EMPLOYEES_FOLDER_ID",
            "aguardando_cargo": "DRIVE_PENDING_FOLDER_ID",
        }.items():
            folder_id = env(env_name)
            if not folder_id:
                folders[key] = {"ok": False, "motivo": "nao configurado"}
                continue
            meta = drive.files().get(fileId=folder_id, fields="id,name,trashed").execute()
            folders[key] = {"ok": not meta.get("trashed", False), "nome": meta.get("name")}
        return {"status": "ok", "folders": folders}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Google Drive indisponivel: {exc}")

@app.get("/api/funcionarios")
def employees():
    try:
        result = get_supabase().table("funcionarios").select("*").order("nome").execute()
        return {"items": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar funcionarios: {exc}")

@app.post("/api/funcionarios", status_code=201)
def create_employee(payload: FuncionarioCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("status", "ativo")
    try:
        result = db.table("funcionarios").insert(data).execute()
        return result.data[0]
    except Exception as exc:
        message = str(exc)
        if "funcionarios_cpf_key" in message:
            raise HTTPException(status_code=409, detail="Ja existe um funcionario cadastrado com este CPF.")
        raise HTTPException(status_code=503, detail=f"Erro ao criar funcionario: {exc}")

@app.put("/api/funcionarios/{funcionario_id}")
def update_employee(funcionario_id: str, payload: FuncionarioUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    try:
        existing = db.table("funcionarios").select("id").eq("id", funcionario_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Funcionario nao encontrado.")
        result = db.table("funcionarios").update(data).eq("id", funcionario_id).execute()
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "funcionarios_cpf_key" in message:
            raise HTTPException(status_code=409, detail="Ja existe um funcionario cadastrado com este CPF.")
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar funcionario: {exc}")

@app.post("/api/funcionarios/{funcionario_id}/desligar")
def deactivate_employee(funcionario_id: str, payload: FuncionarioDesligar):
    db = get_supabase()
    existing = db.table("funcionarios").select("id").eq("id", funcionario_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Funcionario nao encontrado.")
    data = {
        "status": "inativo",
        "data_desligamento": (payload.data_desligamento or date.today()).isoformat(),
        "motivo_desligamento": payload.motivo,
    }
    try:
        result = db.table("funcionarios").update(data).eq("id", funcionario_id).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao desligar funcionario: {exc}")

@app.post("/api/funcionarios/{funcionario_id}/reativar")
def reactivate_employee(funcionario_id: str):
    db = get_supabase()
    existing = db.table("funcionarios").select("id").eq("id", funcionario_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Funcionario nao encontrado.")
    data = {"status": "ativo", "data_desligamento": None, "motivo_desligamento": None}
    try:
        result = db.table("funcionarios").update(data).eq("id", funcionario_id).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao reativar funcionario: {exc}")

@app.get("/api/documentos")
def documents(limit: int = 100):
    try:
        limit = max(1, min(limit, 500))
        result = get_supabase().table("documentos").select("*,funcionarios(nome,cargo,condominio)").order("id", desc=True).limit(limit).execute()
        return {"items": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar documentos: {exc}")

@app.get("/api/condominios")
def condominiums():
    try:
        result = get_supabase().table("funcionarios").select("condominio").execute()
        names = sorted({row.get("condominio").strip() for row in (result.data or []) if row.get("condominio") and row.get("condominio").strip()})
        return {"items": [{"nome": name} for name in names]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar condominios: {exc}")

@app.get("/api/dashboard")
def dashboard():
    try:
        db = get_supabase()
        employees_rows = db.table("funcionarios").select("id,nome,cargo,condominio").execute().data or []
        docs_rows = db.table("documentos").select("*,funcionarios(nome,cargo,condominio)").order("id", desc=True).limit(8).execute().data or []
        condominiums = {row.get("condominio").strip() for row in employees_rows if row.get("condominio") and row.get("condominio").strip()}
        pending = [row for row in employees_rows if row.get("cargo") == "Pendente"]
        return {
            "funcionarios": len(employees_rows),
            "documentos": len((db.table("documentos").select("id").execute().data or [])),
            "condominios": len(condominiums),
            "aguardando_cargo": len(pending),
            "recentes": docs_rows,
            "pendencias": pending[:10],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao montar dashboard: {exc}")

@app.post("/api/documentos/processar")
def process_documents(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    results = []
    for upload in files:
        try:
            result = process_one(upload)
            result["arquivo_original"] = upload.filename
            results.append(result)
        except Exception as exc:
            results.append({
                "status": "erro",
                "arquivo_original": upload.filename,
                "mensagem": str(exc),
            })
        finally:
            upload.file.close()

    return {
        "total": len(results),
        "sucessos": sum(1 for item in results if item["status"] == "sucesso"),
        "duplicados": sum(1 for item in results if item["status"] == "duplicado"),
        "erros": sum(1 for item in results if item["status"] == "erro"),
        "resultados": results,
    }
