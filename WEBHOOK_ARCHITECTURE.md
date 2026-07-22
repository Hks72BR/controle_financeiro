# 🔄 Arquitetura e Fluxo do Webhook Pluggy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PLUGGY DASHBOARD                            │
│                                                                      │
│  User conecta conta bancária → Pluggy detecta nova transação        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Envia evento via HTTPS
                         │ POST /api/pluggy/webhook
                         │ Header: X-Pluggy-Signature
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVIDOR (Node.js)                             │
│                                                                      │
│  1. POST /api/pluggy/webhook (Express middleware)                   │
│  2. Valida assinatura HMAC-SHA256 com PLUGGY_WEBHOOK_SECRET         │
│  3. Se válido → Processa evento                                     │
│  4. Se inválido → Retorna erro 401                                  │
│                                                                      │
│  Handler rotas:                                                     │
│  • handleTransactionReceived()  → Importa transações para Firestore │
│  • handleItemStatusChanged()    → Atualiza status de conexão        │
│  • handleAccountCreated()       → Registra nova conta               │
│  • handleItemError()            → Registra erro de conexão          │
│                                                                      │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    FIRESTORE     LOGS       CACHE (Redis - opcional)
    
    Coleções:
    • pluggy_transactions (transações importadas)
    • pluggy_items (bancos conectados)
    • pluggy_accounts (contas descobertas)
    • webhook_logs (histórico de webhooks)
    • alerts (erros e alertas)
```

---

## 📊 Fluxo de Dados Completo

### 1️⃣ Usuário conecta conta bancária

```
User → Pluggy Widget (frontend) → Pluggy API
                                    ↓
                           Banco de dados do Pluggy
```

### 2️⃣ Pluggy detecta novas transações

```
Pluggy monitora → Encontra transação nova
                       ↓
                 Envia webhook (POST)
                       ↓
                 X-Pluggy-Signature (HMAC-SHA256)
```

### 3️⃣ Servidor recebe webhook

```
POST /api/pluggy/webhook
Header: X-Pluggy-Signature: sha256hash...
Body: {
  "type": "TRANSACTION_RECEIVED",
  "timestamp": "2024-01-16T10:30:00Z",
  "data": {
    "itemId": "item-123",
    "accountId": "account-456",
    "transactions": [...]
  }
}
```

### 4️⃣ Servidor valida e processa

```
┌─────────────────────────────────┐
│ 1. Validar assinatura          │
│    HMAC-SHA256(body, secret)   │
├─────────────────────────────────┤
│ 2. Verificar tipo de evento     │
├─────────────────────────────────┤
│ 3. Chamar handler apropriado    │
├─────────────────────────────────┤
│ 4. Importar para Firestore      │
├─────────────────────────────────┤
│ 5. Registrar em webhook_logs    │
├─────────────────────────────────┤
│ 6. Retornar sucesso (HTTP 200)  │
└─────────────────────────────────┘
```

### 5️⃣ App.js sincroniza em tempo real

```
app.js observa Firestore
       ↓
Evento: pluggy_transactions → syncedToApp: false
       ↓
Renderiza nova transação na UI
       ↓
Marca como: syncedToApp: true
```

---

## 🔐 Validação de Segurança

```javascript
// Cliente (Pluggy) cria assinatura:
Payload = JSON.stringify({ type, timestamp, data })
Signature = HMAC-SHA256(Payload, PLUGGY_WEBHOOK_SECRET)

// Servidor valida:
RecebidoSignature = X-Pluggy-Signature header
ComputadoSignature = HMAC-SHA256(Payload, PLUGGY_WEBHOOK_SECRET)
Válido? RecebidoSignature === ComputadoSignature
```

---

## 📁 Estrutura de Arquivos

```
controle-financeiro/
│
├── server.js (modificado)
│   ├── POST /api/pluggy/webhook → valida + processa eventos
│   ├── POST /api/pluggy/register-webhook → registra na Pluggy
│   ├── GET /api/pluggy/webhooks → lista webhooks
│   └── DELETE /api/pluggy/webhooks/:id → remove webhook
│
├── webhook-manager.js
│   ├── npm run webhook:register
│   ├── npm run webhook:list
│   └── npm run webhook:delete
│
├── webhook-firestore-integration.js
│   ├── handleTransactionReceivedWithFirestore()
│   ├── handleItemStatusChangedWithFirestore()
│   ├── handleAccountCreatedWithFirestore()
│   ├── handleItemErrorWithFirestore()
│   └── Funções auxiliares (getUnsyncedTransactions, etc)
│
├── webhook-test-examples.js
│   └── Exemplos de eventos para testar
│
├── WEBHOOK_PLUGGY_SETUP.md
│   └── Guia detalhado de configuração
│
├── WEBHOOK_IMPLEMENTATION_CHECKLIST.md
│   └── Checklist de implementação
│
└── .env (modificado)
    ├── PLUGGY_WEBHOOK_SECRET
    └── PLUGGY_WEBHOOK_URL
```

---

## 🔄 Estados de Sincronização

```
Pluggy
  ↓
TRANSACTION_RECEIVED
  ↓
pluggy_transactions {
  pluggyId: "tx-123",
  itemId: "item-123",
  accountId: "acc-123",
  date: "2024-01-16",
  description: "WALMART",
  amount: -154.32,
  syncedToApp: false  ← App.js observa isto
  importedAt: Date,
  syncedAt: null
}
  ↓
app.js detecta syncedToApp: false
  ↓
Renderiza na UI
  ↓
markTransactionsAsSynced()
  ↓
syncedToApp: true, syncedAt: Date
```

---

## 🚀 Endpoints da API

| Método | Path | Função |
|--------|------|--------|
| POST | `/api/pluggy/webhook` | Recebe eventos do Pluggy |
| POST | `/api/pluggy/register-webhook` | Registra o webhook |
| GET | `/api/pluggy/webhooks` | Lista webhooks |
| DELETE | `/api/pluggy/webhooks/:id` | Remove webhook |
| GET | `/api/pluggy/items` | Lista items (bancos) |
| GET | `/api/pluggy/accounts?itemId=X` | Lista contas |
| GET | `/api/pluggy/transactions?accountId=X` | Lista transações |

---

## 📊 Coleções do Firestore

```
firestore/
├── transactions (original)
│   └── Transações criadas manualmente
│
├── pluggy_transactions (nova)
│   ├── pluggyId: "tx-123"
│   ├── itemId: "item-123"
│   ├── accountId: "acc-123"
│   ├── date: "2024-01-16"
│   ├── description: "..."
│   ├── amount: -154.32
│   ├── syncedToApp: false/true
│   ├── importedAt: Date
│   └── syncedAt: Date
│
├── pluggy_items (nova)
│   ├── itemId: "item-123"
│   ├── connectorName: "Itau"
│   ├── status: "CONNECTED"
│   ├── isActive: true
│   └── lastStatusChange: Date
│
├── pluggy_accounts (nova)
│   ├── itemId: "item-123"
│   ├── accountId: "acc-123"
│   ├── name: "Conta Corrente"
│   ├── type: "CHECKING"
│   ├── balance: 4500.00
│   └── currency: "BRL"
│
├── webhook_logs (nova)
│   ├── type: "TRANSACTION_RECEIVED"
│   ├── itemId: "item-123"
│   ├── transactionsImported: 5
│   ├── timestamp: Date
│   └── status: "success"
│
└── alerts (nova)
    ├── type: "PLUGGY_CONNECTION_ERROR"
    ├── itemId: "item-123"
    ├── error: "..."
    ├── severity: "HIGH"
    ├── timestamp: Date
    └── resolved: false
```

---

## ⏱️ Timing

```
Transação ocorre no banco
          ↓
    Pluggy detecta (até 24h, geralmente minutos)
          ↓
Pluggy envia webhook (HTTPS POST)
          ↓
Servidor valida (< 1ms)
          ↓
Handler processa (< 100ms)
          ↓
Firestore escreve (< 500ms)
          ↓
App.js observa mudança (real-time com onSnapshot)
          ↓
UI atualiza (< 100ms)
          ↓
Total: até 1 segundo
```

---

## ✅ Monitoramento

Verifique os logs:

```bash
# Ver logs do servidor
npm start

# Ver logs no Firestore
# Acesse Firebase Console → Firestore → webhook_logs

# Listar webhooks registrados
npm run webhook:list

# Testar webhook
node webhook-test-examples.js
```

---

## 🔍 Exemplo de Request/Response

### Request (Pluggy → Seu Servidor)

```http
POST /api/pluggy/webhook HTTP/1.1
Host: seu-app.railway.app
Content-Type: application/json
X-Pluggy-Signature: abcdef123456...

{
  "type": "TRANSACTION_RECEIVED",
  "timestamp": "2024-01-16T10:30:00Z",
  "data": {
    "itemId": "item-123",
    "accountId": "account-456",
    "transactions": [
      {
        "id": "tx-789",
        "date": "2024-01-16",
        "description": "WALMART SUPERMERCADO",
        "amount": -154.32,
        "balance": 2500.00,
        "type": "DEBIT"
      }
    ]
  }
}
```

### Response (Seu Servidor → Pluggy)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "type": "TRANSACTION_RECEIVED",
  "timestamp": "2024-01-16T10:30:00Z"
}
```

---

Fim da documentação arquitetural.
