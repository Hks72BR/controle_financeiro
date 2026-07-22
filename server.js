// ==================== SERVER.JS ====================
// Backend Express — Proxy Pluggy Open Finance + Gemini AI Chat
// Família Coelho · Uso Pessoal

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// ==================== PLUGGY CONFIG ====================
const PLUGGY_BASE = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_WEBHOOK_SECRET = process.env.PLUGGY_WEBHOOK_SECRET;
const PLUGGY_WEBHOOK_URL = process.env.PLUGGY_WEBHOOK_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cache do token Pluggy (expira em ~2h)
let pluggyTokenCache = { token: null, expiresAt: 0 };

// ==================== HELPERS ====================

async function getPluggyApiKey() {
    const now = Date.now();
    if (pluggyTokenCache.token && now < pluggyTokenCache.expiresAt) {
        return pluggyTokenCache.token;
    }

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
        throw new Error('PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não configurados no .env');
    }

    const res = await axios.post(`${PLUGGY_BASE}/auth`, {
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET
    });

    pluggyTokenCache = {
        token: res.data.apiKey,
        expiresAt: now + (115 * 60 * 1000) // 115 minutos
    };

    return pluggyTokenCache.token;
}

function pluggyHeaders(apiKey) {
    return { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };
}

// ==================== PLUGGY ROUTES ====================

/**
 * POST /api/pluggy/connect-token
 * Gera um Connect Token para o Pluggy Widget no frontend.
 * Body opcional: { itemId } para reconectar um banco existente.
 */
app.post('/api/pluggy/connect-token', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        const body = {};
        if (req.body.itemId) body.itemId = req.body.itemId;

        const response = await axios.post(
            `${PLUGGY_BASE}/connect_token`,
            body,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json({ accessToken: response.data.accessToken });
    } catch (err) {
        console.error('[Pluggy] connect-token error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/items
 * Lista todos os items (bancos conectados).
 * Query: none (retorna todos os items da conta)
 */
app.get('/api/pluggy/items', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/items`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] items error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/items/:itemId
 * Detalhes de um item específico.
 */
app.get('/api/pluggy/items/:itemId', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/items/${req.params.itemId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] item detail error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * DELETE /api/pluggy/items/:itemId
 * Remove (desconecta) um banco.
 */
app.delete('/api/pluggy/items/:itemId', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        await axios.delete(
            `${PLUGGY_BASE}/items/${req.params.itemId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Pluggy] delete item error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/accounts?itemId=XXX
 * Lista contas (corrente, poupança, etc.) de um item.
 */
app.get('/api/pluggy/accounts', async (req, res) => {
    try {
        const { itemId } = req.query;
        if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' });

        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/accounts?itemId=${itemId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] accounts error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/transactions?accountId=XXX&from=YYYY-MM-DD&to=YYYY-MM-DD&pageSize=100&page=1
 * Lista transações de uma conta.
 */
app.get('/api/pluggy/transactions', async (req, res) => {
    try {
        const { accountId, from, to, pageSize = 100, page = 1 } = req.query;
        if (!accountId) return res.status(400).json({ error: 'accountId obrigatório' });

        const apiKey = await getPluggyApiKey();
        const params = new URLSearchParams({ accountId, pageSize, page });
        if (from) params.append('from', from);
        if (to) params.append('to', to);

        const response = await axios.get(
            `${PLUGGY_BASE}/transactions?${params}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] transactions error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/investments?itemId=XXX
 * Lista investimentos de um item.
 */
app.get('/api/pluggy/investments', async (req, res) => {
    try {
        const { itemId } = req.query;
        if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' });

        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/investments?itemId=${itemId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] investments error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/connectors
 * Lista bancos/instituições disponíveis para conexão.
 * Query opcional: ?name=itau&sandbox=false
 */
app.get('/api/pluggy/connectors', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        const params = new URLSearchParams();
        if (req.query.name) params.append('name', req.query.name);
        if (req.query.sandbox) params.append('sandbox', req.query.sandbox);

        const response = await axios.get(
            `${PLUGGY_BASE}/connectors${params.toString() ? '?' + params : ''}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Pluggy] connectors error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

// ==================== PLUGGY WEBHOOK ====================

/**
 * Valida a assinatura do webhook do Pluggy
 * Pluggy envia o header X-Pluggy-Signature em SHA256
 */
function validatePluggyWebhookSignature(payload, signature) {
    if (!PLUGGY_WEBHOOK_SECRET) {
        console.warn('[Webhook] PLUGGY_WEBHOOK_SECRET não configurado');
        return false;
    }
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hash = crypto
        .createHmac('sha256', PLUGGY_WEBHOOK_SECRET)
        .update(payloadStr)
        .digest('hex');
    return hash === signature;
}

/**
 * POST /api/pluggy/webhook
 * Recebe eventos do Pluggy em tempo real
 * Eventos possíveis: item/updated, transactions/created, item/created, item/error
 */
app.post('/api/pluggy/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-pluggy-signature'];
        const rawBody = JSON.stringify(req.body); // Pluggy precisa do raw body para validar

        // Validar autenticidade
        if (!validatePluggyWebhookSignature(rawBody, signature)) {
            console.warn('[Webhook] Assinatura inválida', { signature, body: req.body });
            return res.status(401).json({ error: 'Webhook signature invalid' });
        }

        const { type, timestamp, data } = req.body;
        console.log(`[Webhook] Evento recebido: ${type} em ${timestamp}`);

        // Processar cada tipo de evento
        switch (type) {
            case 'item/updated':
                await handleItemStatusChanged(data);
                break;
            case 'transactions/created':
                await handleTransactionReceived(data);
                break;
            case 'item/created':
                await handleAccountCreated(data);
                break;
            case 'item/error':
                await handleItemError(data);
                break;
            default:
                console.log(`[Webhook] Tipo de evento desconhecido: ${type}`);
        }

        res.json({ success: true, type, timestamp });
    } catch (err) {
        console.error('[Webhook] Erro ao processar webhook:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Handlers de eventos do webhook
async function handleItemStatusChanged(data) {
    const { itemId, status, error, connectorName } = data;
    console.log(`[Webhook] Item ${itemId} status: ${status}`, connectorName);
    if (error) console.error(`[Webhook] Erro no item: ${error}`);
}

async function handleTransactionReceived(data) {
    const { itemId, accountId, transactions = [] } = data;
    console.log(`[Webhook] ${transactions.length} transações recebidas para conta ${accountId}`);

    // Aqui você pode importar as transações para seu Firestore
    // Exemplo: await importTransactionsFromPluggy(itemId, accountId);
}

async function handleAccountCreated(data) {
    const { itemId, account } = data;
    console.log(`[Webhook] Nova conta criada: ${account.name} (${account.type})`);
}

async function handleItemError(data) {
    const { itemId, status, error } = data;
    console.error(`[Webhook] Erro no item ${itemId}: ${error}`);
}

/**
 * POST /api/pluggy/register-webhook
 * Registra o webhook na Pluggy (chame uma única vez)
 * Body opcional: { url } para sobrescrever PLUGGY_WEBHOOK_URL
 */
app.post('/api/pluggy/register-webhook', async (req, res) => {
    try {
        if (!PLUGGY_WEBHOOK_URL || !PLUGGY_WEBHOOK_SECRET) {
            return res.status(400).json({ 
                error: 'PLUGGY_WEBHOOK_URL e PLUGGY_WEBHOOK_SECRET são obrigatórios no .env' 
            });
        }

        const apiKey = await getPluggyApiKey();
        const webhookUrl = req.body.url || `${PLUGGY_WEBHOOK_URL}/api/pluggy/webhook`;

        const response = await axios.post(
            `${PLUGGY_BASE}/webhooks`,
            {
                url: webhookUrl,
                events: ['item/updated', 'transactions/created', 'item/created', 'item/error']
            },
            { headers: pluggyHeaders(apiKey) }
        );

        console.log('[Webhook] Registrado com sucesso:', response.data);
        res.json({
            success: true,
            webhook: response.data,
            message: 'Webhook registrado com sucesso na Pluggy'
        });
    } catch (err) {
        console.error('[Webhook] Erro ao registrar:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * GET /api/pluggy/webhooks
 * Lista todos os webhooks registrados
 */
app.get('/api/pluggy/webhooks', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        const response = await axios.get(
            `${PLUGGY_BASE}/webhooks`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('[Webhook] Erro ao listar:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

/**
 * DELETE /api/pluggy/webhooks/:webhookId
 * Remove um webhook
 */
app.delete('/api/pluggy/webhooks/:webhookId', async (req, res) => {
    try {
        const apiKey = await getPluggyApiKey();
        await axios.delete(
            `${PLUGGY_BASE}/webhooks/${req.params.webhookId}`,
            { headers: pluggyHeaders(apiKey) }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Webhook] Erro ao deletar:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

// ==================== GEMINI AI ROUTES ====================

/**
 * POST /api/ai/chat
 * Body: {
 *   messages: [{ role: 'user'|'model', parts: [{text}] }],
 *   context: { transactions: [...], balances: [...], user: 'Higor' }
 * }
 */
app.post('/api/ai/chat', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurado no .env' });
        }

        const { messages, context } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages é obrigatório' });
        }

        // Monta contexto financeiro para o sistema
        const systemContext = buildFinancialContext(context);

        // Prepara histórico de mensagens no formato Gemini
        const geminiContents = [
            {
                role: 'user',
                parts: [{ text: systemContext }]
            },
            {
                role: 'model',
                parts: [{ text: 'Entendido! Sou o assistente financeiro da Família Coelho. Posso analisar seus gastos, investimentos e responder perguntas sobre suas finanças. Como posso ajudar?' }]
            },
            ...messages
        ];

        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: geminiContents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                    responseMimeType: 'text/plain'
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
                ]
            }
        );

        const text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Não consegui gerar uma resposta.';
        res.json({ text });
    } catch (err) {
        console.error('[Gemini] chat error:', err.response?.data || err.message);
        const apiErr = err.response?.data?.error;
        let friendlyMsg = apiErr?.message || err.message;

        if (apiErr?.status === 'RESOURCE_EXHAUSTED') {
            friendlyMsg = 'Quota da API Gemini esgotada ou zerada. Verifique sua chave em aistudio.google.com/app/apikey e crie uma nova com "Create API key in new project".';
        } else if (apiErr?.status === 'UNAUTHENTICATED' || apiErr?.status === 'PERMISSION_DENIED') {
            friendlyMsg = 'Chave Gemini inválida. Verifique o valor de GEMINI_API_KEY no .env.';
        }

        res.status(500).json({ error: friendlyMsg });
    }
});

function buildFinancialContext(context) {
    if (!context) return 'Você é um assistente financeiro pessoal da Família Coelho (Higor e Rafaella). Responda sempre em português brasileiro de forma clara e amigável.';

    const { transactions = [], balances = [], user = 'Família', currentMonth } = context;

    // Resumo de transações do mês atual
    const despesas = transactions.filter(t => t.tipo === 'Despesa');
    const receitas = transactions.filter(t => t.tipo === 'Receita');
    const totalDespesas = despesas.reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totalReceitas = receitas.reduce((s, t) => s + parseFloat(t.valor || 0), 0);

    // Top categorias
    const catMap = {};
    despesas.forEach(t => {
        catMap[t.categoria] = (catMap[t.categoria] || 0) + parseFloat(t.valor || 0);
    });
    const topCats = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
        .join(', ');

    // Saldos Open Finance
    const balanceSummary = balances.length > 0
        ? balances.map(b => `${b.name} (${b.bankName}): R$ ${(b.balance || 0).toFixed(2)}`).join(' | ')
        : 'Nenhum banco conectado via Open Finance ainda.';

    return `Você é um assistente financeiro pessoal e inteligente da Família Coelho (Higor e Rafaella). 
Responda sempre em português brasileiro de forma clara, amigável e objetiva.
Evite ser prolixo — vá direto ao ponto.
Use emojis com moderação.

=== DADOS FINANCEIROS ATUAIS (${currentMonth || 'este mês'}) ===
Usuário logado: ${user}
Total de Receitas: R$ ${totalReceitas.toFixed(2)}
Total de Despesas: R$ ${totalDespesas.toFixed(2)}
Saldo do Mês: R$ ${(totalReceitas - totalDespesas).toFixed(2)}
Top Categorias de Gasto: ${topCats || 'nenhuma'}
Transações registradas: ${transactions.length}

=== SALDOS BANCÁRIOS (Open Finance) ===
${balanceSummary}

Com esses dados, responda às perguntas do usuário com inteligência e precisão.
Se perguntarem algo que não está nos dados, seja honesto e diga que não tem essa informação disponível.`;
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        pluggy: !!(PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET),
        gemini: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ==================== START ====================
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Finanças Coelho rodando em http://localhost:${PORT}`);
    console.log(`   Pluggy: ${PLUGGY_CLIENT_ID ? '✅ configurado' : '❌ faltando PLUGGY_CLIENT_ID'}`);
    console.log(`   Gemini: ${GEMINI_API_KEY ? '✅ configurado' : '❌ faltando GEMINI_API_KEY'}`);
    console.log(`   Abra http://localhost:${PORT} no navegador\n`);
});

module.exports = app;

// AI Auto-Categorization Route
app.post('/api/transactions/ai-auto-categorize', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
        const { description, amount, type } = req.body;
        if (!description) return res.status(400).json({ error: 'description required' });
        const prompt = `Analyze: "${description}" (R$$amount, $type). Reply ONLY JSON: {"suggestions":[{"category":"Food","subcategory":"Resto","confidence":0.95}]}`;
        const gr = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 200 } });
        const txt = gr.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const m = txt.match(/\{[\s\S]*\}/); res.json(m ? JSON.parse(m[0]) : {suggestions:[]});
    } catch (e) {
        console.error('[AI] cat:', e.message);
        res.json({ suggestions: [{ category: 'Other', subcategory: 'Unknown', confidence: 0.5 }] });
    }
});

