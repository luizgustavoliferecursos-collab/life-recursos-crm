import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import unicodedata
from datetime import date, timedelta
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
# Dias de validade por tipo de documento. Tipos fora daqui ficam "nao_aplicavel"
# (contrato, folha de ponto, documento generico nao tem vencimento automatico).
DOCUMENT_VALIDITY_DAYS = {
    "ASO": 365,                    # exame ocupacional, renovacao anual
    "CertificadoEPI": 365,         # ficha/termo de entrega de EPI, revisado anualmente
    "CertificadoQualificacao": 730,  # curso de vigilante e similares, reciclagem a cada 2 anos
}
VENCENDO_EM_DIAS = 30  # janela de alerta "vencendo" antes do vencimento
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

def compute_data_validade(doc_type: str, data_emissao: str | None, ano: Any) -> date | None:
    days = DOCUMENT_VALIDITY_DAYS.get(doc_type)
    if not days:
        return None
    base = None
    if data_emissao:
        try:
            base = date.fromisoformat(str(data_emissao)[:10])
        except ValueError:
            base = None
    if base is None and ano:
        try:
            base = date(int(ano), 1, 1)
        except (TypeError, ValueError):
            base = None
    if base is None:
        return None
    return base + timedelta(days=days)

def compute_status_validade(data_validade: Any) -> str:
    if not data_validade:
        return "nao_aplicavel"
    if isinstance(data_validade, str):
        try:
            data_validade = date.fromisoformat(data_validade[:10])
        except ValueError:
            return "nao_aplicavel"
    today = date.today()
    if data_validade < today:
        return "vencido"
    if data_validade <= today + timedelta(days=VENCENDO_EM_DIAS):
        return "vencendo"
    return "valido"

def compute_status_lancamento(row: dict[str, Any]) -> str:
    # Igual ao status_validade de documentos: "atrasado" e sempre recalculado na
    # leitura a partir do vencimento, nunca fica desatualizado sem job/cron.
    status = row.get("status") or "pendente"
    if status == "pago":
        return "pago"
    vencimento = row.get("vencimento")
    if vencimento:
        if isinstance(vencimento, str):
            try:
                vencimento = date.fromisoformat(vencimento[:10])
            except ValueError:
                vencimento = None
        if vencimento and vencimento < date.today():
            return "atrasado"
    return "pendente"

def with_live_status_financeiro(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        row["status_calculado"] = compute_status_lancamento(row)
    return rows

def month_bounds(mes: str) -> tuple[date, date]:
    ano, mes_num = (int(part) for part in mes.split("-"))
    inicio = date(ano, mes_num, 1)
    fim = date(ano + 1, 1, 1) if mes_num == 12 else date(ano, mes_num + 1, 1)
    return inicio, fim

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
  "condominio": "...",
  "data_emissao": "2026-01-15"
}

Regras:
- tipo_documento: nome curto e padronizado (Contrato, ASO, CertificadoEPI, FolhaDePonto, CertificadoQualificacao). Se incerto, use Documento.
- nome_funcionario: nome completo como aparece no documento, com capitalizacao normal. Se nao houver confianca, use null.
- ano: ano principal do documento; se desconhecido, use null.
- condominio: nome do condominio/local de trabalho se constar; se nao, use null.
- data_emissao: data de emissao/realizacao do documento (formato YYYY-MM-DD), a data mais relevante para calcular validade (ex.: data do exame no ASO, data de assinatura do termo de EPI, data de conclusao do curso). Se nao houver data explicita no documento, use null.
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

VALID_STATUS_CONDOMINIO = ["ativo", "inativo"]

class CondominioCreate(BaseModel):
    nome: str = Field(min_length=1)
    cnpj: str | None = None
    endereco: str | None = None
    cidade: str | None = None
    sindico_nome: str | None = None
    sindico_telefone: str | None = None
    sindico_email: str | None = None
    administradora: str | None = None
    status: str | None = None

    @field_validator("cnpj")
    @classmethod
    def valida_cnpj(cls, value: str | None) -> str | None:
        digits = only_digits(value)
        if digits and len(digits) != 14:
            raise ValueError("CNPJ deve ter 14 digitos.")
        return digits

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_CONDOMINIO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_CONDOMINIO)}")
        return value

class CondominioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1)
    cnpj: str | None = None
    endereco: str | None = None
    cidade: str | None = None
    sindico_nome: str | None = None
    sindico_telefone: str | None = None
    sindico_email: str | None = None
    administradora: str | None = None
    status: str | None = None

    @field_validator("cnpj")
    @classmethod
    def valida_cnpj(cls, value: str | None) -> str | None:
        digits = only_digits(value)
        if digits and len(digits) != 14:
            raise ValueError("CNPJ deve ter 14 digitos.")
        return digits

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_CONDOMINIO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_CONDOMINIO)}")
        return value

VALID_PAPEIS = ["admin", "rh", "financeiro", "operacional", "sindico"]
PBKDF2_ITERATIONS = 100_000

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, hash_hex = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False

def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key != "senha_hash"}

class LoginRequest(BaseModel):
    login: str = Field(min_length=1)
    senha: str = Field(min_length=1)

class UsuarioCreate(BaseModel):
    nome: str = Field(min_length=1)
    login: str = Field(min_length=1)
    senha: str = Field(min_length=6)
    papel: str
    condominio_id: str | None = None
    ativo: bool = True

    @field_validator("papel")
    @classmethod
    def valida_papel(cls, value: str) -> str:
        if value not in VALID_PAPEIS:
            raise ValueError(f"Papel invalido. Use um de: {', '.join(VALID_PAPEIS)}")
        return value

class UsuarioUpdate(BaseModel):
    nome: str | None = None
    papel: str | None = None
    condominio_id: str | None = None
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6)

    @field_validator("papel")
    @classmethod
    def valida_papel(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_PAPEIS:
            raise ValueError(f"Papel invalido. Use um de: {', '.join(VALID_PAPEIS)}")
        return value

VALID_STATUS_CONTRATO = ["ativo", "encerrado"]
VALID_STATUS_POSTO = ["ativo", "inativo"]
VALID_STATUS_ESCALA = ["previsto", "confirmado", "falta", "substituido"]
TURNOS_PADRAO = ["12x36 Diurno", "12x36 Noturno", "6x1 Diurno", "6x1 Noturno", "Comercial"]

class ContratoCreate(BaseModel):
    condominio_id: str
    objeto: str | None = None
    valor_mensal: float | None = None
    indice_reajuste: str | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    data_renovacao: date | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_CONTRATO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_CONTRATO)}")
        return value

class ContratoUpdate(BaseModel):
    objeto: str | None = None
    valor_mensal: float | None = None
    indice_reajuste: str | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    data_renovacao: date | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_CONTRATO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_CONTRATO)}")
        return value

class PostoCreate(BaseModel):
    condominio_id: str
    nome: str = Field(min_length=1)
    cargo: str
    turno: str | None = None
    carga_horaria_semanal: float | None = None
    status: str | None = None

    @field_validator("cargo")
    @classmethod
    def valida_cargo(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError(f"Cargo invalido. Use um de: {', '.join(VALID_ROLES)}")
        return value

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_POSTO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_POSTO)}")
        return value

class PostoUpdate(BaseModel):
    nome: str | None = None
    cargo: str | None = None
    turno: str | None = None
    carga_horaria_semanal: float | None = None
    status: str | None = None

    @field_validator("cargo")
    @classmethod
    def valida_cargo(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_ROLES:
            raise ValueError(f"Cargo invalido. Use um de: {', '.join(VALID_ROLES)}")
        return value

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_POSTO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_POSTO)}")
        return value

class EscalaAtribuir(BaseModel):
    posto_id: str
    data: date
    funcionario_id: str | None = None

class EscalaFalta(BaseModel):
    motivo: str | None = None

class EscalaSubstituir(BaseModel):
    substituto_id: str

VALID_TIPO_LANCAMENTO = ["receita", "despesa"]
VALID_STATUS_LANCAMENTO = ["pendente", "pago", "atrasado"]
VALID_ORIGEM_LANCAMENTO = ["contrato", "folha", "outro"]

class LancamentoCreate(BaseModel):
    tipo: str
    condominio_id: str | None = None
    funcionario_id: str | None = None
    categoria: str | None = None
    descricao: str | None = None
    valor: float
    vencimento: date | None = None
    data_pagamento: date | None = None
    status: str | None = None
    origem: str | None = None

    @field_validator("tipo")
    @classmethod
    def valida_tipo(cls, value: str) -> str:
        if value not in VALID_TIPO_LANCAMENTO:
            raise ValueError(f"Tipo invalido. Use um de: {', '.join(VALID_TIPO_LANCAMENTO)}")
        return value

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_LANCAMENTO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_LANCAMENTO)}")
        return value

    @field_validator("origem")
    @classmethod
    def valida_origem(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_ORIGEM_LANCAMENTO:
            raise ValueError(f"Origem invalida. Use uma de: {', '.join(VALID_ORIGEM_LANCAMENTO)}")
        return value

class LancamentoUpdate(BaseModel):
    condominio_id: str | None = None
    funcionario_id: str | None = None
    categoria: str | None = None
    descricao: str | None = None
    valor: float | None = None
    vencimento: date | None = None
    data_pagamento: date | None = None
    status: str | None = None
    origem: str | None = None

    @field_validator("status")
    @classmethod
    def valida_status(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_STATUS_LANCAMENTO:
            raise ValueError(f"Status invalido. Use um de: {', '.join(VALID_STATUS_LANCAMENTO)}")
        return value

    @field_validator("origem")
    @classmethod
    def valida_origem(cls, value: str | None) -> str | None:
        if value is not None and value not in VALID_ORIGEM_LANCAMENTO:
            raise ValueError(f"Origem invalida. Use uma de: {', '.join(VALID_ORIGEM_LANCAMENTO)}")
        return value

class LancamentoPagar(BaseModel):
    data_pagamento: date | None = None

class GerarMensalidades(BaseModel):
    mes: str = Field(pattern=r"^\d{4}-\d{2}$")

class EpiCreate(BaseModel):
    funcionario_id: str
    item: str = Field(min_length=1)
    data_entrega: date | None = None
    data_validade: date | None = None
    termo_assinado_url: str | None = None
    observacao: str | None = None

class EpiUpdate(BaseModel):
    item: str | None = None
    data_entrega: date | None = None
    data_validade: date | None = None
    termo_assinado_url: str | None = None
    observacao: str | None = None

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
    data_validade = compute_data_validade(doc_type, info.get("data_emissao"), year)
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

    doc_record: dict[str, Any] = {
        "funcionario_id": employee["id"],
        "tipo_documento": doc_type,
        "ano": year,
        "arquivo_nome": target_name,
        "arquivo_drive_url": drive_url,
        "origem": "automacao",
    }
    if data_validade:
        doc_record["data_validade"] = data_validade.isoformat()
    try:
        db.table("documentos").insert(doc_record).execute()
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
        "data_validade": data_validade.isoformat() if data_validade else None,
        "status_validade": compute_status_validade(data_validade),
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

def with_live_status(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # status_validade e sempre recalculado na leitura a partir de data_validade,
    # para nao ficar desatualizado (um documento "valido" vira "vencendo" e depois
    # "vencido" so pelo passar do tempo, sem precisar de nenhum job/cron).
    for row in rows:
        row["status_validade"] = compute_status_validade(row.get("data_validade"))
    return rows

@app.get("/api/documentos")
def documents(limit: int = 100):
    try:
        limit = max(1, min(limit, 500))
        result = get_supabase().table("documentos").select("*,funcionarios(nome,cargo,condominio)").order("id", desc=True).limit(limit).execute()
        return {"items": with_live_status(result.data or [])}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar documentos: {exc}")

@app.get("/api/condominios")
def condominiums():
    try:
        result = get_supabase().table("condominios").select("*").order("nome").execute()
        return {"items": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar condominios: {exc}")

@app.post("/api/condominios", status_code=201)
def create_condominium(payload: CondominioCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("status", "ativo")
    try:
        result = db.table("condominios").insert(data).execute()
        return result.data[0]
    except Exception as exc:
        message = str(exc)
        if "condominios_nome_key" in message or "duplicate key" in message.lower():
            raise HTTPException(status_code=409, detail="Ja existe um condominio com este nome.")
        raise HTTPException(status_code=503, detail=f"Erro ao criar condominio: {exc}")

@app.put("/api/condominios/{condominio_id}")
def update_condominium(condominio_id: str, payload: CondominioUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("condominios").select("id").eq("id", condominio_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Condominio nao encontrado.")
    try:
        result = db.table("condominios").update(data).eq("id", condominio_id).execute()
        return result.data[0]
    except Exception as exc:
        message = str(exc)
        if "condominios_nome_key" in message or "duplicate key" in message.lower():
            raise HTTPException(status_code=409, detail="Ja existe um condominio com este nome.")
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar condominio: {exc}")

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    db = get_supabase()
    result = db.table("usuarios").select("*").eq("login", payload.login).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos.")
    user = result.data[0]
    if not user.get("ativo", True):
        raise HTTPException(status_code=403, detail="Usuario desativado.")
    if not verify_password(payload.senha, user.get("senha_hash", "")):
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos.")
    return public_user(user)

@app.get("/api/usuarios")
def list_users():
    try:
        result = get_supabase().table("usuarios").select("*").order("nome").execute()
        return {"items": [public_user(row) for row in (result.data or [])]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar usuarios: {exc}")

@app.post("/api/usuarios", status_code=201)
def create_user(payload: UsuarioCreate):
    db = get_supabase()
    data = payload.model_dump(exclude={"senha"}, exclude_none=True, mode="json")
    data["senha_hash"] = hash_password(payload.senha)
    try:
        result = db.table("usuarios").insert(data).execute()
        return public_user(result.data[0])
    except Exception as exc:
        message = str(exc)
        if "usuarios_login_key" in message or "duplicate key" in message.lower():
            raise HTTPException(status_code=409, detail="Ja existe um usuario com este login.")
        raise HTTPException(status_code=503, detail=f"Erro ao criar usuario: {exc}")

@app.put("/api/usuarios/{usuario_id}")
def update_user(usuario_id: str, payload: UsuarioUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude={"senha"}, exclude_unset=True, mode="json")
    if payload.senha:
        data["senha_hash"] = hash_password(payload.senha)
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("usuarios").select("id").eq("id", usuario_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    try:
        result = db.table("usuarios").update(data).eq("id", usuario_id).execute()
        return public_user(result.data[0])
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar usuario: {exc}")

@app.get("/api/contratos")
def list_contratos(condominio_id: str | None = None):
    try:
        query = get_supabase().table("contratos_condominio").select("*,condominios(nome)").order("data_fim")
        if condominio_id:
            query = query.eq("condominio_id", condominio_id)
        result = query.execute()
        return {"items": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar contratos: {exc}")

@app.post("/api/contratos", status_code=201)
def create_contrato(payload: ContratoCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("status", "ativo")
    try:
        result = db.table("contratos_condominio").insert(data).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao criar contrato: {exc}")

@app.put("/api/contratos/{contrato_id}")
def update_contrato(contrato_id: str, payload: ContratoUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("contratos_condominio").select("id").eq("id", contrato_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado.")
    try:
        result = db.table("contratos_condominio").update(data).eq("id", contrato_id).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar contrato: {exc}")

@app.get("/api/postos-trabalho")
def list_postos(condominio_id: str | None = None):
    try:
        query = get_supabase().table("postos_trabalho").select("*,condominios(nome)").order("nome")
        if condominio_id:
            query = query.eq("condominio_id", condominio_id)
        result = query.execute()
        return {"items": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar postos de trabalho: {exc}")

@app.post("/api/postos-trabalho", status_code=201)
def create_posto(payload: PostoCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("status", "ativo")
    try:
        result = db.table("postos_trabalho").insert(data).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao criar posto de trabalho: {exc}")

@app.put("/api/postos-trabalho/{posto_id}")
def update_posto(posto_id: str, payload: PostoUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("postos_trabalho").select("id").eq("id", posto_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Posto de trabalho nao encontrado.")
    try:
        result = db.table("postos_trabalho").update(data).eq("id", posto_id).execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar posto de trabalho: {exc}")

@app.get("/api/escalas")
def list_escalas(data: str | None = None, condominio_id: str | None = None):
    db = get_supabase()
    alvo = data or date.today().isoformat()
    try:
        postos_query = db.table("postos_trabalho").select("*,condominios(nome)").eq("status", "ativo").order("nome")
        if condominio_id:
            postos_query = postos_query.eq("condominio_id", condominio_id)
        postos = postos_query.execute().data or []
        posto_ids = [p["id"] for p in postos]
        escalas_do_dia = []
        if posto_ids:
            escalas_do_dia = (
                db.table("escalas")
                .select("*,funcionario:funcionarios!escalas_funcionario_id_fkey(nome),substituto:funcionarios!escalas_substituto_id_fkey(nome)")
                .eq("data", alvo)
                .in_("posto_id", posto_ids)
                .execute()
                .data
                or []
            )
        escala_por_posto = {row["posto_id"]: row for row in escalas_do_dia}
        items = []
        for posto in postos:
            escala = escala_por_posto.get(posto["id"])
            items.append({"posto": posto, "escala": escala})
        return {"data": alvo, "items": items}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar escalas: {exc}")

@app.post("/api/escalas")
def set_escala(payload: EscalaAtribuir):
    db = get_supabase()
    data = {
        "posto_id": payload.posto_id,
        "data": payload.data.isoformat(),
        "funcionario_id": payload.funcionario_id,
        "status": "previsto",
        "substituto_id": None,
    }
    try:
        result = db.table("escalas").upsert(data, on_conflict="posto_id,data").execute()
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao definir escala: {exc}")

@app.post("/api/escalas/{escala_id}/falta")
def marcar_falta(escala_id: str, payload: EscalaFalta):
    db = get_supabase()
    existing = db.table("escalas").select("id").eq("id", escala_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Escala nao encontrada.")
    try:
        result = (
            db.table("escalas")
            .update({"status": "falta", "observacao": payload.motivo})
            .eq("id", escala_id)
            .execute()
        )
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao marcar falta: {exc}")

@app.post("/api/escalas/{escala_id}/substituir")
def substituir_escala(escala_id: str, payload: EscalaSubstituir):
    db = get_supabase()
    existing = db.table("escalas").select("id").eq("id", escala_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Escala nao encontrada.")
    try:
        result = (
            db.table("escalas")
            .update({"status": "substituido", "substituto_id": payload.substituto_id})
            .eq("id", escala_id)
            .execute()
        )
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao substituir: {exc}")

@app.get("/api/financeiro")
def list_financeiro(tipo: str | None = None, status: str | None = None, condominio_id: str | None = None):
    try:
        query = (
            get_supabase()
            .table("financeiro_lancamentos")
            .select("*,condominios(nome),funcionarios(nome)")
            .order("vencimento")
        )
        if tipo:
            query = query.eq("tipo", tipo)
        if condominio_id:
            query = query.eq("condominio_id", condominio_id)
        rows = with_live_status_financeiro(query.execute().data or [])
        if status:
            rows = [row for row in rows if row["status_calculado"] == status]
        return {"items": rows}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar financeiro: {exc}")

@app.post("/api/financeiro", status_code=201)
def create_financeiro(payload: LancamentoCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("status", "pendente")
    data.setdefault("origem", "outro")
    try:
        result = db.table("financeiro_lancamentos").insert(data).execute()
        return with_live_status_financeiro(result.data)[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao criar lancamento: {exc}")

@app.put("/api/financeiro/{lancamento_id}")
def update_financeiro(lancamento_id: str, payload: LancamentoUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("financeiro_lancamentos").select("id").eq("id", lancamento_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado.")
    try:
        result = db.table("financeiro_lancamentos").update(data).eq("id", lancamento_id).execute()
        return with_live_status_financeiro(result.data)[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar lancamento: {exc}")

@app.post("/api/financeiro/{lancamento_id}/pagar")
def pagar_financeiro(lancamento_id: str, payload: LancamentoPagar):
    db = get_supabase()
    existing = db.table("financeiro_lancamentos").select("id").eq("id", lancamento_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado.")
    data = {
        "status": "pago",
        "data_pagamento": (payload.data_pagamento or date.today()).isoformat(),
    }
    try:
        result = db.table("financeiro_lancamentos").update(data).eq("id", lancamento_id).execute()
        return with_live_status_financeiro(result.data)[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao marcar pagamento: {exc}")

@app.post("/api/financeiro/gerar-mensalidades")
def gerar_mensalidades(payload: GerarMensalidades):
    db = get_supabase()
    inicio, fim = month_bounds(payload.mes)
    contratos = db.table("contratos_condominio").select("*").eq("status", "ativo").execute().data or []
    criados = 0
    ja_existentes = 0
    ignorados = 0
    for contrato in contratos:
        if not contrato.get("valor_mensal") or not contrato.get("condominio_id"):
            ignorados += 1
            continue
        existing = (
            db.table("financeiro_lancamentos")
            .select("id")
            .eq("condominio_id", contrato["condominio_id"])
            .eq("origem", "contrato")
            .gte("vencimento", inicio.isoformat())
            .lt("vencimento", fim.isoformat())
            .limit(1)
            .execute()
        )
        if existing.data:
            ja_existentes += 1
            continue
        db.table("financeiro_lancamentos").insert({
            "condominio_id": contrato["condominio_id"],
            "tipo": "receita",
            "categoria": "Mensalidade",
            "descricao": contrato.get("objeto") or "Mensalidade do contrato",
            "valor": contrato["valor_mensal"],
            "vencimento": date(inicio.year, inicio.month, 10).isoformat(),
            "status": "pendente",
            "origem": "contrato",
        }).execute()
        criados += 1
    return {"criados": criados, "ja_existentes": ja_existentes, "ignorados_sem_valor": ignorados}

@app.get("/api/epis")
def list_epis(funcionario_id: str | None = None):
    try:
        query = get_supabase().table("epis_entregues").select("*,funcionarios(nome)").order("data_entrega", desc=True)
        if funcionario_id:
            query = query.eq("funcionario_id", funcionario_id)
        rows = with_live_status(query.execute().data or [])
        return {"items": rows}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao consultar EPIs: {exc}")

@app.post("/api/epis", status_code=201)
def create_epi(payload: EpiCreate):
    db = get_supabase()
    data = payload.model_dump(exclude_none=True, mode="json")
    data.setdefault("data_entrega", date.today().isoformat())
    try:
        result = db.table("epis_entregues").insert(data).execute()
        return with_live_status(result.data)[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao registrar EPI: {exc}")

@app.put("/api/epis/{epi_id}")
def update_epi(epi_id: str, payload: EpiUpdate):
    db = get_supabase()
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    existing = db.table("epis_entregues").select("id").eq("id", epi_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Registro de EPI nao encontrado.")
    try:
        result = db.table("epis_entregues").update(data).eq("id", epi_id).execute()
        return with_live_status(result.data)[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao atualizar EPI: {exc}")

@app.get("/api/notificacoes")
def notificacoes():
    # Central de alertas: agrega, em uma unica lista ordenada por urgencia, tudo
    # que precisa de atencao (documentos, EPIs, contratos, financeiro). Nao envia
    # email/WhatsApp (precisaria de um provedor externo configurado) - e o
    # equivalente "in-app" enquanto isso nao existe.
    db = get_supabase()
    alertas = []
    hoje = date.today()
    limite = hoje + timedelta(days=VENCENDO_EM_DIAS)

    docs = with_live_status(
        db.table("documentos").select("tipo_documento,data_validade,funcionarios(nome)").execute().data or []
    )
    for row in docs:
        if row["status_validade"] not in ("vencido", "vencendo"):
            continue
        nome_func = (row.get("funcionarios") or {}).get("nome") or "Funcionario desconhecido"
        alertas.append({
            "tipo": "documento",
            "urgencia": row["status_validade"],
            "titulo": f"{row.get('tipo_documento') or 'Documento'} de {nome_func}",
            "detalhe": f"Vence em {row.get('data_validade')}" if row.get("data_validade") else "Vencido",
            "data": row.get("data_validade"),
        })

    epis = with_live_status(
        db.table("epis_entregues").select("item,data_validade,funcionarios(nome)").execute().data or []
    )
    for row in epis:
        if row["status_validade"] not in ("vencido", "vencendo"):
            continue
        nome_func = (row.get("funcionarios") or {}).get("nome") or "Funcionario desconhecido"
        alertas.append({
            "tipo": "epi",
            "urgencia": row["status_validade"],
            "titulo": f"{row.get('item')} de {nome_func}",
            "detalhe": f"Vence em {row.get('data_validade')}" if row.get("data_validade") else "Vencido",
            "data": row.get("data_validade"),
        })

    contratos = (
        db.table("contratos_condominio")
        .select("objeto,data_fim,data_renovacao,condominios(nome)")
        .eq("status", "ativo")
        .execute()
        .data
        or []
    )
    for row in contratos:
        alvo = row.get("data_renovacao") or row.get("data_fim")
        if not alvo:
            continue
        try:
            alvo_data = date.fromisoformat(str(alvo)[:10])
        except ValueError:
            continue
        if alvo_data > limite:
            continue
        nome_cond = (row.get("condominios") or {}).get("nome") or "Condominio desconhecido"
        alertas.append({
            "tipo": "contrato",
            "urgencia": "vencido" if alvo_data < hoje else "vencendo",
            "titulo": f"Contrato com {nome_cond}",
            "detalhe": (row.get("objeto") or "Renovacao/vigencia") + f" — {alvo_data.isoformat()}",
            "data": alvo_data.isoformat(),
        })

    financeiro = with_live_status_financeiro(
        db.table("financeiro_lancamentos")
        .select("tipo,valor,status,vencimento,categoria,condominios(nome),funcionarios(nome)")
        .execute()
        .data
        or []
    )
    for row in financeiro:
        if row["status_calculado"] != "atrasado":
            continue
        quem = (row.get("condominios") or {}).get("nome") or (row.get("funcionarios") or {}).get("nome") or "—"
        alertas.append({
            "tipo": "financeiro",
            "urgencia": "vencido",
            "titulo": f"{'Receita' if row['tipo'] == 'receita' else 'Despesa'} atrasada — {quem}",
            "detalhe": f"{row.get('categoria') or 'Lancamento'}: R$ {row.get('valor')}",
            "data": row.get("vencimento"),
        })

    ordem_urgencia = {"vencido": 0, "vencendo": 1}
    alertas.sort(key=lambda a: (ordem_urgencia.get(a["urgencia"], 2), a.get("data") or ""))
    return {
        "total": len(alertas),
        "vencidos": sum(1 for a in alertas if a["urgencia"] == "vencido"),
        "vencendo": sum(1 for a in alertas if a["urgencia"] == "vencendo"),
        "items": alertas,
    }

@app.get("/api/relatorios")
def relatorios():
    db = get_supabase()
    hoje = date.today()

    inicio_mes, fim_mes = month_bounds(hoje.strftime("%Y-%m"))
    condominios_rows = db.table("condominios").select("id,nome").eq("status", "ativo").execute().data or []
    contratos_rows = db.table("contratos_condominio").select("condominio_id,valor_mensal").eq("status", "ativo").execute().data or []
    lancamentos_mes = (
        db.table("financeiro_lancamentos")
        .select("condominio_id,tipo,valor,vencimento")
        .gte("vencimento", inicio_mes.isoformat())
        .lt("vencimento", fim_mes.isoformat())
        .execute()
        .data
        or []
    )

    previsto_por_cond: dict[str, float] = {}
    for contrato in contratos_rows:
        cid = contrato.get("condominio_id")
        if cid:
            previsto_por_cond[cid] = previsto_por_cond.get(cid, 0) + float(contrato.get("valor_mensal") or 0)
    faturado_por_cond: dict[str, float] = {}
    for lancamento in lancamentos_mes:
        if lancamento.get("tipo") != "receita":
            continue
        cid = lancamento.get("condominio_id")
        if cid:
            faturado_por_cond[cid] = faturado_por_cond.get(cid, 0) + float(lancamento.get("valor") or 0)

    faturamento = [
        {
            "condominio_id": row["id"],
            "condominio": row["nome"],
            "previsto_mensal": previsto_por_cond.get(row["id"], 0),
            "faturado_mes": faturado_por_cond.get(row["id"], 0),
        }
        for row in condominios_rows
    ]
    faturamento.sort(key=lambda row: -row["previsto_mensal"])

    limite_turnover = hoje - timedelta(days=90)
    funcionarios_rows = db.table("funcionarios").select("status,data_desligamento").execute().data or []
    ativos = sum(1 for row in funcionarios_rows if row.get("status") != "inativo")
    desligados_periodo = 0
    for row in funcionarios_rows:
        if row.get("status") != "inativo" or not row.get("data_desligamento"):
            continue
        try:
            desligado_em = date.fromisoformat(str(row["data_desligamento"])[:10])
        except ValueError:
            continue
        if desligado_em >= limite_turnover:
            desligados_periodo += 1
    base_turnover = ativos + desligados_periodo
    turnover_pct = round((desligados_periodo / base_turnover * 100), 1) if base_turnover else 0.0

    limite_absenteismo = hoje - timedelta(days=30)
    escalas_periodo = (
        db.table("escalas")
        .select("status")
        .gte("data", limite_absenteismo.isoformat())
        .lte("data", hoje.isoformat())
        .execute()
        .data
        or []
    )
    total_escalas = len(escalas_periodo)
    faltas = sum(1 for row in escalas_periodo if row.get("status") == "falta")
    absenteismo_pct = round((faltas / total_escalas * 100), 1) if total_escalas else 0.0

    return {
        "faturamento_por_condominio": faturamento,
        "turnover": {"desligados_periodo": desligados_periodo, "ativos": ativos, "taxa_pct": turnover_pct},
        "absenteismo": {"faltas_periodo": faltas, "total_escalas_periodo": total_escalas, "taxa_pct": absenteismo_pct},
    }

@app.get("/api/dashboard")
def dashboard():
    try:
        db = get_supabase()
        employees_rows = db.table("funcionarios").select("id,nome,cargo,condominio").execute().data or []
        docs_rows = db.table("documentos").select("*,funcionarios(nome,cargo,condominio)").order("id", desc=True).limit(8).execute().data or []
        with_live_status(docs_rows)
        all_docs = with_live_status(
            db.table("documentos").select("id,tipo_documento,ano,data_validade,funcionarios(nome,cargo,condominio)").execute().data or []
        )
        vencendo_ou_vencido = [row for row in all_docs if row["status_validade"] in ("vencendo", "vencido")]
        vencendo_ou_vencido.sort(key=lambda row: row.get("data_validade") or "")
        condominiums_count = len(db.table("condominios").select("id").execute().data or [])
        pending = [row for row in employees_rows if row.get("cargo") == "Pendente"]

        lancamentos = with_live_status_financeiro(
            db.table("financeiro_lancamentos").select("tipo,valor,status,vencimento").execute().data or []
        )
        a_receber = sum(
            float(row["valor"] or 0) for row in lancamentos
            if row["tipo"] == "receita" and row["status_calculado"] in ("pendente", "atrasado")
        )
        a_pagar = sum(
            float(row["valor"] or 0) for row in lancamentos
            if row["tipo"] == "despesa" and row["status_calculado"] in ("pendente", "atrasado")
        )
        vencido_receita = sum(
            float(row["valor"] or 0) for row in lancamentos
            if row["tipo"] == "receita" and row["status_calculado"] == "atrasado"
        )
        vencido_despesa = sum(
            float(row["valor"] or 0) for row in lancamentos
            if row["tipo"] == "despesa" and row["status_calculado"] == "atrasado"
        )

        return {
            "funcionarios": len(employees_rows),
            "documentos": len(all_docs),
            "condominios": condominiums_count,
            "aguardando_cargo": len(pending),
            "vencidos": sum(1 for row in all_docs if row["status_validade"] == "vencido"),
            "vencendo": sum(1 for row in all_docs if row["status_validade"] == "vencendo"),
            "recentes": docs_rows,
            "pendencias": pending[:10],
            "vencimentos": vencendo_ou_vencido[:10],
            "financeiro": {
                "a_receber": a_receber,
                "a_pagar": a_pagar,
                "vencido_receita": vencido_receita,
                "vencido_despesa": vencido_despesa,
            },
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
