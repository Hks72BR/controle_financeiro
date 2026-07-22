// ==================== AI AUTO-CATEGORIZATION SUGGESTIONS ====================
// Funções para integrar sugestões de categorização automática da IA

let aiSuggestionQueue = [];

/**
 * Detecta se é um depósito/salário e pede sugestão de categorização
 */
async function checkForAiSuggestions(transaction) {
    if (!transaction || !transaction.descricao) return;
    
    const desc = transaction.descricao.toLowerCase();
    const isReceita = transaction.tipo === 'Receita';
    
    // Triggers para pedir sugestão: descrições que parecem ser depósitos de cliente/empresa
    const triggers = ['depósito', 'transferência', 'pagamento', 'freelancer', 'cliente', 'empresa', 'nf', 'invoice'];
    const hasKeyword = triggers.some(t => desc.includes(t));
    
    if (isReceita && hasKeyword) {
        const suggestions = await getAiCategorySuggestions(transaction.descricao, transaction.valor, transaction.tipo);
        if (suggestions && suggestions.length > 0) {
            showAiSuggestionToast(transaction.descricao, suggestions[0]);
        }
    }
}

/**
 * Chama o backend para obter sugestões de categorização
 */
async function getAiCategorySuggestions(description, amount, type) {
    try {
        const res = await fetch(`${API_BASE}/api/transactions/ai-auto-categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, amount, type })
        });
        
        if (!res.ok) {
            console.warn('[AI] Sugestão indisponível:', await res.text());
            return [];
        }
        
        const data = await res.json();
        return data.suggestions || [];
    } catch (err) {
        console.warn('[AI] Erro ao obter sugestões:', err);
        return [];
    }
}

/**
 * Mostra um toast com sugestão de categorização
 */
function showAiSuggestionToast(description, suggestion) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const html = `
        💡 <strong>Sugestão IA:</strong> "${description}" pode ser categorizado como 
        <strong>${suggestion.category} → ${suggestion.subcategory}</strong> (${(suggestion.confidence * 100).toFixed(0)}% confiança)
        <br>
        <button onclick="acceptAiSuggestion('${suggestion.category}', '${suggestion.subcategory}')" 
                style="margin-top:0.5rem; padding:0.4rem 0.8rem; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;">
            ✓ Aceitar
        </button>
    `;
    
    toast.innerHTML = html;
    toast.className = 'toast info show';
    
    setTimeout(() => {
        if (toast.classList.contains('show')) {
            toast.classList.remove('show');
        }
    }, 8000);
}

/**
 * Aceita sugestão e atualiza transação recente
 */
function acceptAiSuggestion(category, subcategory) {
    // Encontra última transação e atualiza
    if (transactions.length === 0) return;
    const lastTx = transactions[transactions.length - 1];
    
    updateTransactionInFirestore(lastTx.id, {
        categoria: category,
        subcategoria: subcategory
    }).then(ok => {
        if (ok) {
            showToast(`✓ Categorização aplicada: ${category} → ${subcategoria}`, 'success');
            renderDashboard();
            renderTransactions();
        }
    });
}

/**
 * Integra com Chat IA - quando usuário pergunta sobre depósito, oferece auto-categorização
 */
async function chatIaAutoDetectDeposit(userMessage) {
    const msg = userMessage.toLowerCase();
    const keywords = ['depósito', 'transferência', 'recebimento', 'salário', 'freelancer', 'pagamento cliente'];
    const mentionsDeposit = keywords.some(k => msg.includes(k));
    
    if (mentionsDeposit) {
        // Procura transações recentes que ainda não têm categoria bem definida
        const recentReceitas = transactions
            .filter(t => t.tipo === 'Receita' && (!t.categoria || t.categoria === 'Outros'))
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .slice(0, 3);
        
        if (recentReceitas.length > 0) {
            // Oferece sugestão automática
            const tx = recentReceitas[0];
            const suggestions = await getAiCategorySuggestions(tx.descricao, tx.valor, tx.tipo);
            
            if (suggestions && suggestions.length > 0) {
                const top = suggestions[0];
                const response = `Detectei uma transação recente: "${tx.descricao}" (R$ ${tx.valor}). ` +
                    `Gostaria de categorizá-la como **${top.category} → ${top.subcategory}**? ` +
                    `(${(top.confidence * 100).toFixed(0)}% de confiança)`;
                return response;
            }
        }
    }
    
    return null;
}
