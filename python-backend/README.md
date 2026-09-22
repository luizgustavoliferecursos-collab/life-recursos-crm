# LIFE Recursos API

Backend FastAPI do LIFE Recursos CRM.

## Endpoints

- `GET /health`
- `GET /api/dashboard`
- `GET /api/drive/status`
- `GET /api/funcionarios`
- `GET /api/documentos`
- `GET /api/condominios`
- `POST /api/documentos/processar`

O endpoint de processamento aceita múltiplos arquivos PDF, JPG e PNG. Imagens são convertidas em PDF em memória antes da leitura pela IA. O fluxo preserva a automação validada: Claude identifica o documento, o funcionário é consultado/criado no Supabase, o arquivo é organizado no Google Drive e o registro é gravado em `documentos`.

Credenciais nunca ficam no repositório. Em hospedagem, use variáveis secretas. Para Google OAuth, salve o conteúdo JSON diretamente em variável secreta ou em Base64; nenhum caminho `C:\...` é necessário.

O backend evita nova gravação quando encontra o mesmo nome final de documento para o mesmo funcionário/tipo/ano.
