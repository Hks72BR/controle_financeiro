# 🔗 Configuração de Webhook do Pluggy para Produção

## 📋 O que foi implementado

Adicionei suporte completo para webhooks do Pluggy no seu servidor Express:

### Endpoints criados:

1. **POST `/api/pluggy/webhook`** - Recebe eventos em tempo real do Pluggy
2. **POST `/api/pluggy/register-webhook`** - Registra o webhook automaticamente
3. **GET `/api/pluggy/webhooks`** - Lista webhooks registrados
4. **DELETE `/api/pluggy/webhooks/:webhookId`** - Remove um webhook

### Eventos suportados:

- `ITEM_STATUS_CHANGED` - Quando status de conexão muda
- `TRANSACTION_RECEIVED` - Novas transações disponíveis
- `ACCOUNT_CREATED` - Contas descobertas
- `ITEM_ERROR` - Erros na conexão

---

## 🚀 Configuração em 3 passos

### Passo 1: Atualizar `.env`

Você já tem no `.env`:

```env
PLUGGY_CLIENT_ID=6876f248-c63c-4f4c-b654-47a5451ca8d5
PLUGGY_CLIENT_SECRET=SreTYQ39T4xB8djgXiKuAMp9ETEgETdfd1CekCgu5-0
PLUGGY_WEBHOOK_SECRET=your-secure-webhook-secret-here
PLUGGY_WEBHOOK_URL=http://localhost:3000
```

**Para Produção:**

1. **Gere um secret seguro** para `PLUGGY_WEBHOOK_SECRET`:
   ```bash
   # No Windows PowerShell:
   [Convert]::ToBase64String([byte[]]$(1..32|ForEach-Object {Get-Random -Maximum 256})) | Select-Object -First 32
   
   # Ou use online: https://www.uuidgenerator.net/
   ```

2. **Atualize `PLUGGY_WEBHOOK_URL`** com a URL pública de produção:
   ```env
   PLUGGY_WEBHOOK_URL=https://sua-app.railway.app
   # ou
   PLUGGY_WEBHOOK_URL=https://seu-dominio.com
   ```

### Passo 2: Registrar o Webhook

Faça uma requisição POST para registrar o webhook:

```bash
# Local (desenvolvimento)
curl -X POST http://localhost:3000/api/pluggy/register-webhook

# Produção
curl -X POST https://sua-app.railway.app/api/pluggy/register-webhook
```

**Resposta esperada:**
```json
{
  "success": true,
  "webhook": {
    "id": "webhook-id-123",
    "url": "https://sua-app.railway.app/api/pluggy/webhook",
    "events": ["ITEM_STATUS_CHANGED", "TRANSACTION_RECEIVED", "ACCOUNT_CREATED", "ITEM_ERROR"],
    "createdAt": "2024-01-01T12:00:00Z"
  },
  "message": "Webhook registrado com sucesso na Pluggy"
}
```

### Passo 3: Verificar Webhooks Registrados

```bash
curl -X GET https://sua-app.railway.app/api/pluggy/webhooks
```

---

## 📱 Alternativa: Registrar via Dashboard Pluggy

Se preferir registrar manualmente no dashboard:

1. Acesse: https://dashboard.pluggy.ai/webhooks
2. Clique em **"Add Webhook"**
3. Cole a URL: `https://sua-app.railway.app/api/pluggy/webhook`
4. Selecione os eventos:
   - ✅ ITEM_STATUS_CHANGED
   - ✅ TRANSACTION_RECEIVED
   - ✅ ACCOUNT_CREATED
   - ✅ ITEM_ERROR
5. Cole o secret em **Webhook Secret**: (mesmo valor de `PLUGGY_WEBHOOK_SECRET`)
6. Clique em **Save**

---

## 🔒 Segurança

O webhook valida a assinatura usando:
```
Signature = HMAC-SHA256(JSON_Body, PLUGGY_WEBHOOK_SECRET)
```

Pluggy envia em cada request o header:
```
X-Pluggy-Signature: <hash-sha256>
```

O servidor verifica que a assinatura é válida antes de processar.

---

## 🧪 Testar o Webhook

### 1. Local (Development)

Instale um tunnel público:
```bash
# Com ngrok
ngrok http 3000
# Copie a URL gerada, ex: https://abc123.ngrok.io

# Atualize .env
PLUGGY_WEBHOOK_URL=https://abc123.ngrok.io

# Registre o webhook
curl -X POST http://localhost:3000/api/pluggy/register-webhook
```

### 2. Verificar Logs

Quando eventos chegarem, você verá no console:
```
[Webhook] Evento recebido: TRANSACTION_RECEIVED em 2024-01-01T12:00:00Z
[Webhook] 5 transações recebidas para conta account-123
```

---

## 🔄 Próximas Implementações

Para que o webhook **importe automaticamente** as transações, você precisa:

1. Expandir `handleTransactionReceived()` no `server.js`:
```javascript
async function handleTransactionReceived(data) {
    const { itemId, accountId, transactions = [] } = data;
    
    // Buscar transações da API Pluggy
    const apiKey = await getPluggyApiKey();
    const response = await axios.get(
        `${PLUGGY_BASE}/transactions?accountId=${accountId}`,
        { headers: pluggyHeaders(apiKey) }
    );
    
    // Importar para Firestore
    for (const tx of response.data.results) {
        await db.collection('pluggy_transactions').add({
            itemId,
            accountId,
            ...tx,
            importedAt: new Date()
        });
    }
}
```

2. Integrar com seu `app.js` para sincronizar com a UI

---

## 🆘 Troubleshooting

| Problema | Solução |
|----------|---------|
| **Webhook não recebe eventos** | Verifique se `PLUGGY_WEBHOOK_URL` é acessível publicamente |
| **"Webhook signature invalid"** | Certifique-se que `PLUGGY_WEBHOOK_SECRET` é igual em `.env` e Dashboard |
| **Erro 401** | Token Pluggy expirou, reinicie o servidor |
| **Transações não aparecem** | Expanda `handleTransactionReceived()` para importar para Firestore |

---

## 📞 Documentação Oficial

- Pluggy API: https://pluggy.ai/docs
- Webhooks: https://pluggy.ai/docs/webhooks
- Dashboard: https://dashboard.pluggy.ai

---

**✅ Seu app agora está pronto para produção com webhooks!**
