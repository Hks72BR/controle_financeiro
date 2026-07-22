/**
 * INTEGRAÇÃO WEBHOOK + FIRESTORE
 * 
 * Este arquivo mostra como integrar o webhook com Firebase/Firestore
 * para importar automaticamente transações do Pluggy
 * 
 * INSTRUÇÕES:
 * 1. Copie essas funções para o server.js
 * 2. Substitua os handlers vazios em handleTransactionReceived(), etc
 * 3. Reinicie o servidor
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Supondo que Firebase já está inicializado no server.js
// const db = admin.firestore();

// ==================== WEBHOOK HANDLERS COM FIRESTORE ====================

/**
 * Processa o evento TRANSACTION_RECEIVED
 * Importa as transações para o Firestore
 */
async function handleTransactionReceivedWithFirestore(data, apiKey, PLUGGY_BASE) {
    const { itemId, accountId } = data;
    console.log(`[Webhook] Importando transações para ${accountId}...`);

    try {
        // 1. Buscar transações da API Pluggy
        const response = await axios.get(
            `${PLUGGY_BASE}/transactions?accountId=${accountId}&pageSize=100&sort=-date`,
            { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
        );

        const transactions = response.data.results || [];
        if (transactions.length === 0) {
            console.log('[Webhook] Nenhuma transação para importar');
            return;
        }

        // 2. Importar para Firestore em batch
        const db = admin.firestore();
        const batch = db.batch();
        let importCount = 0;

        for (const tx of transactions) {
            // Verificar se transação já existe (por ID único)
            const existingRef = await db
                .collection('pluggy_transactions')
                .where('pluggyId', '==', tx.id)
                .limit(1)
                .get();

            if (existingRef.empty) {
                // Criar novo documento
                const docRef = db.collection('pluggy_transactions').doc();
                batch.set(docRef, {
                    pluggyId: tx.id,
                    itemId,
                    accountId,
                    date: tx.date,
                    description: tx.description || '',
                    amount: parseFloat(tx.amount || 0),
                    balance: parseFloat(tx.balance || 0),
                    type: tx.type || 'DEBIT', // DEBIT, CREDIT
                    category: tx.category || 'Uncategorized',
                    merchant: tx.merchant || null,
                    importedAt: new Date(),
                    syncedToApp: false // Flag para sincronizar com app.js
                });
                importCount++;
            }
        }

        // 3. Commit do batch
        if (importCount > 0) {
            await batch.commit();
            console.log(`[Webhook] ✅ ${importCount} transações importadas para Firestore`);

            // 4. Registrar no log de sincronização
            await db.collection('webhook_logs').add({
                type: 'TRANSACTION_RECEIVED',
                itemId,
                accountId,
                transactionsImported: importCount,
                timestamp: new Date(),
                status: 'success'
            });
        } else {
            console.log('[Webhook] ℹ️ Todas as transações já existem');
        }

    } catch (err) {
        console.error('[Webhook] Erro ao importar transações:', err.message);
        
        // Registrar erro
        try {
            const db = admin.firestore();
            await db.collection('webhook_logs').add({
                type: 'TRANSACTION_RECEIVED',
                itemId,
                accountId,
                error: err.message,
                timestamp: new Date(),
                status: 'error'
            });
        } catch (logErr) {
            console.error('[Webhook] Erro ao registrar log:', logErr.message);
        }
    }
}

/**
 * Processa o evento ITEM_STATUS_CHANGED
 * Atualiza o status de conexão do banco
 */
async function handleItemStatusChangedWithFirestore(data) {
    const { itemId, status, connectorName, error } = data;
    console.log(`[Webhook] Item ${itemId} (${connectorName}): ${status}`);

    try {
        const db = admin.firestore();

        // Verificar ou criar documento de item
        const itemRef = db.collection('pluggy_items').doc(itemId);
        
        await itemRef.set({
            itemId,
            connectorName,
            status, // CONNECTED, DISCONNECTED, ERROR, PROCESSING
            error: error || null,
            lastStatusChange: new Date(),
            isActive: status === 'CONNECTED'
        }, { merge: true });

        console.log(`[Webhook] ✅ Item ${itemId} atualizado`);

        // Registrar no log
        await db.collection('webhook_logs').add({
            type: 'ITEM_STATUS_CHANGED',
            itemId,
            connectorName,
            status,
            error,
            timestamp: new Date(),
            statusSuccess: !error
        });

    } catch (err) {
        console.error('[Webhook] Erro ao atualizar item:', err.message);
    }
}

/**
 * Processa o evento ACCOUNT_CREATED
 * Registra novas contas descobertas
 */
async function handleAccountCreatedWithFirestore(data) {
    const { itemId, account } = data;
    console.log(`[Webhook] Nova conta: ${account.name} (${account.type})`);

    try {
        const db = admin.firestore();

        await db.collection('pluggy_accounts').add({
            itemId,
            accountId: account.id,
            name: account.name,
            type: account.type, // CHECKING, SAVINGS, INVESTMENT
            balance: parseFloat(account.balance || 0),
            currency: account.currency || 'BRL',
            createdAt: new Date(),
            discoveredViaWebhook: true
        });

        console.log(`[Webhook] ✅ Conta ${account.name} registrada`);

        // Registrar no log
        const logRef = await db.collection('webhook_logs').add({
            type: 'ACCOUNT_CREATED',
            itemId,
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('[Webhook] Erro ao registrar conta:', err.message);
    }
}

/**
 * Processa o evento ITEM_ERROR
 * Registra erros de conexão
 */
async function handleItemErrorWithFirestore(data) {
    const { itemId, error, connectorName } = data;
    console.error(`[Webhook] ❌ Erro no item ${itemId}: ${error}`);

    try {
        const db = admin.firestore();

        // Atualizar item com erro
        await db.collection('pluggy_items').doc(itemId).set({
            status: 'ERROR',
            error,
            lastError: new Date(),
            isActive: false
        }, { merge: true });

        // Alertar administrador (opcional)
        await db.collection('alerts').add({
            type: 'PLUGGY_CONNECTION_ERROR',
            itemId,
            connectorName,
            error,
            severity: 'HIGH',
            timestamp: new Date(),
            resolved: false
        });

        console.log(`[Webhook] ✅ Erro registrado para alert`);

    } catch (err) {
        console.error('[Webhook] Erro ao registrar erro:', err.message);
    }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Lista transações não sincronizadas com app.js
 * Use em app.js para sincronizar UI
 */
async function getUnsyncedTransactions(limit = 50) {
    try {
        const db = admin.firestore();
        const snapshot = await db
            .collection('pluggy_transactions')
            .where('syncedToApp', '==', false)
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('[Firestore] Erro ao buscar transações:', err.message);
        return [];
    }
}

/**
 * Marca transações como sincronizadas
 */
async function markTransactionsAsSynced(transactionIds) {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        for (const txId of transactionIds) {
            const ref = db.collection('pluggy_transactions').doc(txId);
            batch.update(ref, { syncedToApp: true, syncedAt: new Date() });
        }

        await batch.commit();
        console.log(`[Firestore] ${transactionIds.length} transações marcadas como sincronizadas`);
    } catch (err) {
        console.error('[Firestore] Erro ao marcar como sincronizado:', err.message);
    }
}

/**
 * Busca items conectados via Pluggy
 */
async function getConnectedPluggyItems() {
    try {
        const db = admin.firestore();
        const snapshot = await db
            .collection('pluggy_items')
            .where('status', '==', 'CONNECTED')
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('[Firestore] Erro ao buscar items:', err.message);
        return [];
    }
}

/**
 * Busca contas de um item
 */
async function getAccountsByItem(itemId) {
    try {
        const db = admin.firestore();
        const snapshot = await db
            .collection('pluggy_accounts')
            .where('itemId', '==', itemId)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('[Firestore] Erro ao buscar contas:', err.message);
        return [];
    }
}

// ==================== EXPORT ====================

module.exports = {
    handleTransactionReceivedWithFirestore,
    handleItemStatusChangedWithFirestore,
    handleAccountCreatedWithFirestore,
    handleItemErrorWithFirestore,
    getUnsyncedTransactions,
    markTransactionsAsSynced,
    getConnectedPluggyItems,
    getAccountsByItem
};

// ==================== COMO USAR ====================

/*

1. Copie este arquivo como webhook-firestore-integration.js

2. No server.js, importe:

const {
    handleTransactionReceivedWithFirestore,
    handleItemStatusChangedWithFirestore,
    handleAccountCreatedWithFirestore,
    handleItemErrorWithFirestore
} = require('./webhook-firestore-integration');

3. Substitua os handlers:

async function handleTransactionReceived(data) {
    const apiKey = await getPluggyApiKey();
    await handleTransactionReceivedWithFirestore(data, apiKey, PLUGGY_BASE);
}

async function handleItemStatusChanged(data) {
    await handleItemStatusChangedWithFirestore(data);
}

async function handleAccountCreated(data) {
    await handleAccountCreatedWithFirestore(data);
}

async function handleItemError(data) {
    await handleItemErrorWithFirestore(data);
}

4. Em app.js, adicione (para sincronizar UI em tempo real):

// Observar transações não sincronizadas
const unsubscribe = db.collection('pluggy_transactions')
    .where('syncedToApp', '==', false)
    .onSnapshot(snapshot => {
        snapshot.docs.forEach(doc => {
            const tx = doc.data();
            // Adicionar à lista de transações
            transactions.push({
                id: doc.id,
                ...tx,
                fonte: 'pluggy'
            });
        });
        
        // Marcar como sincronizadas
        const ids = snapshot.docs.map(d => d.id);
        markTransactionsAsSynced(ids);
        
        // Re-renderizar dashboard
        renderDashboard();
    });

*/
