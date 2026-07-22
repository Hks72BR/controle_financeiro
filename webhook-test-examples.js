/**
 * EXEMPLO DE TESTE - Webhook do Pluggy
 * 
 * Este arquivo mostra como testar o webhook localmente e
 * como estruturar a resposta esperada do Pluggy
 */

// ==================== EXEMPLO 1: Simular evento TRANSACTION_RECEIVED ====================
const transactionReceivedEvent = {
    type: "TRANSACTION_RECEIVED",
    timestamp: new Date().toISOString(),
    data: {
        itemId: "item-123456",
        accountId: "account-123456",
        transactions: [
            {
                id: "tx-001",
                date: "2024-01-15",
                description: "WALMART SUPERMERCADO",
                amount: -154.32,
                balance: 2500.00,
                type: "DEBIT"
            },
            {
                id: "tx-002",
                date: "2024-01-16",
                description: "DEPOSITO SALARIO",
                amount: 2899.58,
                balance: 4399.58,
                type: "CREDIT"
            }
        ]
    }
};

// ==================== EXEMPLO 2: Simular evento ITEM_STATUS_CHANGED ====================
const itemStatusChangedEvent = {
    type: "ITEM_STATUS_CHANGED",
    timestamp: new Date().toISOString(),
    data: {
        itemId: "item-123456",
        status: "CONNECTED",
        connectorName: "Itau",
        accounts: [
            {
                id: "account-123456",
                name: "Conta Corrente",
                type: "CHECKING",
                balance: 4399.58,
                currency: "BRL"
            }
        ]
    }
};

// ==================== EXEMPLO 3: Simular evento ITEM_ERROR ====================
const itemErrorEvent = {
    type: "ITEM_ERROR",
    timestamp: new Date().toISOString(),
    data: {
        itemId: "item-123456",
        status: "ERROR",
        error: "Invalid credentials",
        connectorName: "Itau"
    }
};

// ==================== TESTE COM CURL ====================
/*

1. Gere a assinatura HMAC-SHA256:

// Node.js
const crypto = require('crypto');
const secret = process.env.PLUGGY_WEBHOOK_SECRET;
const payload = JSON.stringify(transactionReceivedEvent);
const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
console.log(signature);

2. Teste o webhook:

curl -X POST http://localhost:3000/api/pluggy/webhook \
  -H "Content-Type: application/json" \
  -H "X-Pluggy-Signature: <SIGNATURE_AQUI>" \
  -d '{
    "type": "TRANSACTION_RECEIVED",
    "timestamp": "2024-01-16T10:30:00Z",
    "data": {
      "itemId": "item-123",
      "accountId": "account-123",
      "transactions": []
    }
  }'

*/

// ==================== TESTE EM NODE.JS ====================

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

async function testWebhook() {
    const event = transactionReceivedEvent;
    const secret = process.env.PLUGGY_WEBHOOK_SECRET || 'test-secret';
    const payload = JSON.stringify(event);
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    console.log('🧪 Testando Webhook...\n');
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('\nSignature:', signature);

    try {
        const response = await axios.post(
            'http://localhost:3000/api/pluggy/webhook',
            event,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Pluggy-Signature': signature
                }
            }
        );

        console.log('\n✅ Webhook recebido com sucesso!');
        console.log('Response:', response.data);
    } catch (err) {
        console.error('❌ Erro:', err.response?.data || err.message);
    }
}

// Descomente para testar:
// testWebhook();

// ==================== ESTRUTURA DE RESPOSTA ====================
/*

Exemplo de resposta do servidor para um webhook válido:

{
  "success": true,
  "type": "TRANSACTION_RECEIVED",
  "timestamp": "2024-01-16T10:30:00Z"
}

Exemplo de erro (assinatura inválida):

{
  "error": "Webhook signature invalid"
}

*/

module.exports = {
    transactionReceivedEvent,
    itemStatusChangedEvent,
    itemErrorEvent
};
