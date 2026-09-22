# LIFE Recursos API

Esta API reaproveita o mesmo fluxo já validado: Claude → Google Drive → Supabase.

Para uploads novos, o Google Drive usa OAuth da conta proprietária. A Service Account
continua disponível como alternativa, mas contas de serviço não possuem cota própria
para criar arquivos em pastas do Meu Drive.

## O que foi acrescentado

- upload manual de PDF, JPG e PNG;
- conversão de imagem para PDF antes da leitura;
- retorno estruturado para o frontend;
- consulta de funcionários e documentos;
- definição de cargo pelo CRM;
- proteção opcional por token entre frontend e backend.

## Preparação no Windows

1. Faça uma cópia de `.env.example` com o nome `.env`.
2. Confira os caminhos das chaves e os IDs das pastas.
   O cliente OAuth deve estar em `C:\json chaves\google_oauth_client.json`.
3. Defina `LIFE_BACKEND_TOKEN` com um valor longo e secreto.
4. Instale as dependências somente quando estiver pronto para testar:
   `python -m pip install -r requirements.txt`
5. Inicie a API: `uvicorn app:app --reload --host 127.0.0.1 --port 8000`

Na primeira operação que acessar o Drive, o navegador abrirá a autorização do Google.
Depois da aprovação, `google_oauth_token.json` será criado automaticamente e reutilizado.

Nenhuma chave deve ser enviada para o frontend ou colocada no repositório.
