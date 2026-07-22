#!/usr/bin/env node
/**
 * Script para registrar/gerenciar webhooks do Pluggy
 * Uso:
 *   node webhook-manager.js register   - Registra um novo webhook
 *   node webhook-manager.js list       - Lista webhooks existentes
 *   node webhook-manager.js delete <id> - Deleta um webhook
 */

require('dotenv').config();
const axios = require('axios');

const PLUGGY_BASE = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_WEBHOOK_SECRET = process.env.PLUGGY_WEBHOOK_SECRET;
const PLUGGY_WEBHOOK_URL = process.env.PLUGGY_WEBHOOK_URL;

async function getPluggyApiKey() {
    const res = await axios.post(`${PLUGGY_BASE}/auth`, {
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET
    });
    return res.data.apiKey;
}

function pluggyHeaders(apiKey) {
    return { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };
}

async function registerWebhook() {
    console.log('🔗 Registrando webhook do Pluggy...\n');
    
    if (!PLUGGY_WEBHOOK_URL || !PLUGGY_WEBHOOK_SECRET) {
        console.error('❌ Erro: PLUGGY_WEBHOOK_URL e PLUGGY_WEBHOOK_SECRET são obrigatórios');
        console.log('Adicione ao .env:');
        console.log('  PLUGGY_WEBHOOK_URL=https://sua-app.railway.app');
        console.log('  PLUGGY_WEBHOOK_SECRET=seu-secret-seguro');
        process.exit(1);
    }

    try {
        const apiKey = await getPluggyApiKey();
        const webhookUrl = `${PLUGGY_WEBHOOK_URL}/api/pluggy/webhook`;

        console.log(`📍 URL: ${webhookUrl}`);
        console.log(`🔐 Secret: ${PLUGGY_WEBHOOK_SECRET.substring(0, 8)}...`);
        console.log('📋 Eventos: item/updated, transactions/created, item/created, item/error\n');

        const response = await axios.post(
            `${PLUGGY_BASE}/webhooks`,
            {
                url: webhookUrl,
                events: ['item/updated', 'transactions/created', 'item/created', 'item/error']
            },
            { headers: pluggyHeaders(apiKey) }
        );

        console.log('✅ Webhook registrado com sucesso!\n');
        console.log('ID:', response.data.id);
        console.log('URL:', response.data.url);
        console.log('Status:', response.data.status || 'active');
        console.log('Eventos:', response.data.events.join(', '));
        console.log('\nGuarde este ID para futuras referências.');
    } catch (err) {
        console.error('❌ Erro:', err.response?.data?.message || err.message);
        process.exit(1);
    }
}

async function listWebhooks() {
    console.log('📋 Listando webhooks...\n');
    try {
        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/webhooks`,
            { headers: pluggyHeaders(apiKey) }
        );

        const webhooks = response.data.results || response.data;
        if (!webhooks || webhooks.length === 0) {
            console.log('Nenhum webhook registrado.');
            return;
        }

        webhooks.forEach((wh, i) => {
            console.log(`\n${i + 1}. ${wh.id}`);
            console.log(`   URL: ${wh.url}`);
            console.log(`   Status: ${wh.status || 'active'}`);
            console.log(`   Eventos: ${(wh.events || []).join(', ')}`);
            console.log(`   Criado: ${wh.createdAt}`);
        });
    } catch (err) {
        console.error('❌ Erro:', err.response?.data?.message || err.message);
        process.exit(1);
    }
}

async function deleteWebhook(webhookId) {
    if (!webhookId) {
        console.error('❌ ID do webhook é obrigatório');
        process.exit(1);
    }

    console.log(`🗑️  Deletando webhook ${webhookId}...\n`);
    try {
        const apiKey = await getPluggyApiKey();
        await axios.delete(
            `${PLUGGY_BASE}/webhooks/${webhookId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        console.log('✅ Webhook deletado com sucesso!');
    } catch (err) {
        console.error('❌ Erro:', err.response?.data?.message || err.message);
        process.exit(1);
    }
}

// CLI
const command = process.argv[2];

if (command === 'register') {
    registerWebhook();
} else if (command === 'list') {
    listWebhooks();
} else if (command === 'delete') {
    deleteWebhook(process.argv[3]);
} else {
    console.log(`
🔗 Webhook Manager - Pluggy

Uso:
  npm run webhook:register   - Registra um novo webhook
  npm run webhook:list       - Lista webhooks existentes
  npm run webhook:delete ID  - Deleta um webhook

Exemplo:
  node webhook-manager.js register
  node webhook-manager.js list
  node webhook-manager.js delete webhook-id-123
    `);
}
