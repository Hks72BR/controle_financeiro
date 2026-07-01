// PWA - Controle Financeiro
// Data Storage
const STORAGE_KEY = 'financeiro_data';
const USERS_KEY = 'financeiro_users';
const TEMPLATES_KEY = 'financeiro_templates';

// Default users (senha: 1234)
const defaultUsers = {
    higor: { name: 'Higor', password: '1234' },
    rafa: { name: 'Rafa', password: '1234' }
};

// Initialize users
if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
}

// Current user
let currentUser = null;

// Data structure
let appData = {
    transactions: [],
    lastSync: null
};

// Templates
let templates = [];

// Load data
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        appData = JSON.parse(stored);
    }
    
    const storedTemplates = localStorage.getItem(TEMPLATES_KEY);
    if (storedTemplates) {
        templates = JSON.parse(storedTemplates);
    }
}

// Save data
function saveData() {
    appData.lastSync = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// Save templates
function saveTemplates() {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('userSelect').value;
    const password = document.getElementById('passwordInput').value;
    
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    
    if (users[username] && users[username].password === password) {
        currentUser = users[username].name;
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        document.getElementById('currentUser').textContent = currentUser;
        
        loadData();
        initializeApp();
        showToast('Login realizado com sucesso!', 'success');
    } else {
        showToast('Usuário ou senha incorretos!', 'error');
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    currentUser = null;
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('passwordInput').value = '';
    showToast('Logout realizado', 'success');
});

// Importar dados CSV
document.getElementById('importarBtn')?.addEventListener('click', async () => {
    if (confirm('Deseja importar os dados do CSV? Isso irá substituir todos os dados atuais.')) {
        try {
            const total = await importarDadosCSV();
            if (total > 0) {
                loadData();
                initializeApp();
                showToast(`${total} transações importadas com sucesso!`, 'success');
            } else {
                showToast('Nenhuma transação foi importada', 'error');
            }
        } catch (error) {
            showToast('Erro ao importar dados', 'error');
            console.error(error);
        }
    }
});

// Tab navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update active nav
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`${tab}Tab`).classList.add('active');
        
        // Refresh data based on tab
        if (tab === 'dashboard') updateDashboard();
        if (tab === 'transactions') updateTransactionsList();
        if (tab === 'reports') updateReports();
        if (tab === 'templates') updateTemplatesList();
    });
});

// Initialize app
function initializeApp() {
    // Set today's date as default
    document.getElementById('data').valueAsDate = new Date();
    
    // Load initial data
    updateDashboard();
    updateTransactionsList();
    updateReports();
    updateTemplatesList();
    populateFilters();
}

// Add transaction
document.getElementById('transactionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const transaction = {
        id: Date.now(),
        tipo: document.querySelector('input[name="tipo"]:checked').value,
        data: document.getElementById('data').value,
        categoria: document.getElementById('categoria').value,
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        pagamento: document.getElementById('pagamento').value,
        usuario: currentUser,
        criadoEm: new Date().toISOString()
    };
    
    appData.transactions.push(transaction);
    saveData();
    
    // Reset form
    e.target.reset();
    document.getElementById('data').valueAsDate = new Date();
    
    // Update UI
    updateDashboard();
    updateTransactionsList();
    updateReports();
    
    showToast('Transação adicionada com sucesso!', 'success');
    
    // Switch to dashboard
    document.querySelector('.nav-btn[data-tab="dashboard"]').click();
});

// Update Dashboard
function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTransactions = appData.transactions.filter(t => t.data.startsWith(currentMonth));
    
    const receitas = monthTransactions
        .filter(t => t.tipo === 'Receita')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const despesas = monthTransactions
        .filter(t => t.tipo === 'Despesa')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const saldo = receitas - despesas;
    
    document.getElementById('totalReceitas').textContent = formatCurrency(receitas);
    document.getElementById('totalDespesas').textContent = formatCurrency(despesas);
    document.getElementById('saldo').textContent = formatCurrency(saldo);
    document.getElementById('saldo').style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    
    // Update current month name
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthIndex = new Date().getMonth();
    const year = new Date().getFullYear();
    document.getElementById('currentMonthName').textContent = `${monthNames[monthIndex]} ${year}`;
    
    // Update current month expenses list
    updateCurrentMonthExpenses(monthTransactions);
}

// Update Current Month Expenses
function updateCurrentMonthExpenses(monthTransactions) {
    const despesas = monthTransactions
        .filter(t => t.tipo === 'Despesa')
        .sort((a, b) => new Date(b.data) - new Date(a.data));
    
    const container = document.getElementById('currentMonthExpenses');
    
    if (despesas.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="icon">📝</span><p>Nenhum gasto registrado este mês</p></div>';
        return;
    }
    
    container.innerHTML = despesas.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${t.categoria}</div>
                <div class="transaction-description">${t.descricao}</div>
                <div class="transaction-date">${formatDate(t.data)} • ${t.pagamento}</div>
            </div>
            <div class="transaction-value despesa">
                - ${formatCurrency(t.valor)}
            </div>
        </div>
    `).join('');
}

// Update Transactions List
function updateTransactionsList() {
    const filterType = document.getElementById('filterType')?.value || 'all';
    const filterMonth = document.getElementById('filterMonth')?.value || 'all';
    const filterCategory = document.getElementById('filterCategory')?.value || 'all';
    
    let filtered = appData.transactions;
    
    if (filterType !== 'all') {
        filtered = filtered.filter(t => t.tipo === filterType);
    }
    
    if (filterMonth !== 'all') {
        filtered = filtered.filter(t => t.data.startsWith(filterMonth));
    }
    
    if (filterCategory !== 'all') {
        filtered = filtered.filter(t => t.categoria === filterCategory);
    }
    
    filtered.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    const container = document.getElementById('allTransactions');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="icon">🔍</span><p>Nenhuma transação encontrada</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${t.categoria}</div>
                <div class="transaction-description">${t.descricao}</div>
                <div class="transaction-date">${formatDate(t.data)} • ${t.pagamento} • ${t.usuario}</div>
            </div>
            <div class="transaction-value ${t.tipo.toLowerCase()}">
                ${t.tipo === 'Receita' ? '+' : '-'} ${formatCurrency(t.valor)}
            </div>
        </div>
    `).join('');
}

// Populate Filters
function populateFilters() {
    // Month filter
    const months = [...new Set(appData.transactions.map(t => t.data.slice(0, 7)))];
    const monthSelect = document.getElementById('filterMonth');
    monthSelect.innerHTML = '<option value="all">Todos os meses</option>';
    months.sort().reverse().forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = formatMonth(month);
        monthSelect.appendChild(option);
    });
    
    // Category filter
    const categories = [...new Set(appData.transactions.map(t => t.categoria))];
    const categorySelect = document.getElementById('filterCategory');
    categorySelect.innerHTML = '<option value="all">Todas categorias</option>';
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
    
    // Report month
    const reportMonth = document.getElementById('reportMonth');
    reportMonth.innerHTML = '';
    months.sort().reverse().forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = formatMonth(month);
        reportMonth.appendChild(option);
    });
    if (months.length === 0) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        reportMonth.innerHTML = `<option value="${currentMonth}">${formatMonth(currentMonth)}</option>`;
    }
}

// Update Reports
let expenseChart = null;
function updateReports() {
    const selectedMonth = document.getElementById('reportMonth')?.value || new Date().toISOString().slice(0, 7);
    const monthTransactions = appData.transactions.filter(t => t.data.startsWith(selectedMonth));
    
    const receitas = monthTransactions
        .filter(t => t.tipo === 'Receita')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const despesas = monthTransactions
        .filter(t => t.tipo === 'Despesa')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const saldo = receitas - despesas;
    const taxa = receitas > 0 ? ((saldo / receitas) * 100) : 0;
    
    document.getElementById('reportReceitas').textContent = formatCurrency(receitas);
    document.getElementById('reportDespesas').textContent = formatCurrency(despesas);
    document.getElementById('reportSaldo').textContent = formatCurrency(saldo);
    document.getElementById('reportSaldo').style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('reportTaxa').textContent = taxa.toFixed(1) + '%';
    document.getElementById('reportTaxa').style.color = taxa >= 0 ? 'var(--success)' : 'var(--danger)';
    
    // Expense chart
    const despesasData = monthTransactions.filter(t => t.tipo === 'Despesa');
    const categoryTotals = {};
    
    despesasData.forEach(t => {
        categoryTotals[t.categoria] = (categoryTotals[t.categoria] || 0) + t.valor;
    });
    
    const ctx = document.getElementById('expenseChart');
    
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    if (Object.keys(categoryTotals).length > 0) {
        expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryTotals),
                datasets: [{
                    data: Object.values(categoryTotals),
                    backgroundColor: [
                        '#DC3545', '#FFC107', '#28A745', '#007BFF', '#6C757D',
                        '#17A2B8', '#FD7E14', '#E83E8C', '#20C997', '#6610F2'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Category breakdown
    const breakdown = document.getElementById('categoryBreakdown');
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    
    breakdown.innerHTML = sorted.map(([cat, val]) => `
        <div class="category-item">
            <span class="category-name">${cat}</span>
            <span class="category-amount">${formatCurrency(val)}</span>
        </div>
    `).join('');
}

// Filter listeners
document.getElementById('filterType')?.addEventListener('change', updateTransactionsList);
document.getElementById('filterMonth')?.addEventListener('change', updateTransactionsList);
document.getElementById('filterCategory')?.addEventListener('change', updateTransactionsList);
document.getElementById('reportMonth')?.addEventListener('change', updateReports);

// Export CSV
document.getElementById('exportBtn')?.addEventListener('click', () => {
    const selectedMonth = document.getElementById('reportMonth').value;
    const monthTransactions = appData.transactions.filter(t => t.data.startsWith(selectedMonth));
    
    const csv = [
        ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Pagamento', 'Usuário'],
        ...monthTransactions.map(t => [
            t.data,
            t.tipo,
            t.categoria,
            t.descricao,
            t.valor,
            t.pagamento,
            t.usuario
        ])
    ].map(row => row.join(';')).join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${selectedMonth}.csv`;
    link.click();
    
    showToast('CSV exportado com sucesso!', 'success');
});

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ========================================
// FUNCIONALIDADE DE TEMPLATES
// ========================================

// Criar template do mês atual
document.getElementById('criarTemplateBtn')?.addEventListener('click', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTransactions = appData.transactions.filter(t => 
        t.data.startsWith(currentMonth) && t.tipo === 'Despesa'
    );
    
    if (monthTransactions.length === 0) {
        showToast('Nenhuma despesa encontrada no mês atual', 'error');
        return;
    }
    
    const templateName = prompt('Nome do template:', `Template ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    
    if (!templateName) return;
    
    const template = {
        id: Date.now(),
        name: templateName,
        createdAt: new Date().toISOString(),
        sourceMonth: currentMonth,
        transactions: monthTransactions.map(t => ({
            categoria: t.categoria,
            descricao: t.descricao,
            valor: t.valor,
            pagamento: t.pagamento
        }))
    };
    
    templates.push(template);
    saveTemplates();
    updateTemplatesList();
    showToast('Template criado com sucesso!', 'success');
});

// Aplicar template
document.getElementById('aplicarTemplateBtn')?.addEventListener('click', () => {
    if (templates.length === 0) {
        showToast('Nenhum template disponível', 'error');
        return;
    }
    
    // Preencher select de templates
    const select = document.getElementById('templateSelect');
    select.innerHTML = templates.map(t => 
        `<option value="${t.id}">${t.name} (${t.transactions.length} despesas)</option>`
    ).join('');
    
    // Definir mês destino como próximo mês
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('mesDestino').value = nextMonth.toISOString().slice(0, 7);
    
    document.getElementById('aplicarTemplateModal').style.display = 'flex';
});

// Confirmar aplicação de template
document.getElementById('confirmarAplicarBtn')?.addEventListener('click', () => {
    const templateId = parseInt(document.getElementById('templateSelect').value);
    const mesDestino = document.getElementById('mesDestino').value;
    
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
        showToast('Template não encontrado', 'error');
        return;
    }
    
    // Criar transações a partir do template
    const dayOfMonth = 5; // Dia padrão
    template.transactions.forEach((t, index) => {
        const transaction = {
            id: Date.now() + index + Math.random() * 1000,
            data: `${mesDestino}-${String(dayOfMonth).padStart(2, '0')}`,
            tipo: 'Despesa',
            categoria: t.categoria,
            descricao: t.descricao,
            valor: t.valor,
            pagamento: t.pagamento,
            usuario: currentUser,
            criadoEm: new Date().toISOString()
        };
        
        appData.transactions.push(transaction);
    });
    
    saveData();
    document.getElementById('aplicarTemplateModal').style.display = 'none';
    updateDashboard();
    updateTransactionsList();
    showToast(`${template.transactions.length} despesas adicionadas!`, 'success');
});

// Cancelar aplicação de template
document.getElementById('cancelarAplicarBtn')?.addEventListener('click', () => {
    document.getElementById('aplicarTemplateModal').style.display = 'none';
});

// Atualizar lista de templates
function updateTemplatesList() {
    const container = document.getElementById('templatesList');
    
    if (templates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="icon">📋</span>
                <p>Nenhum template criado ainda</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Crie um template para reutilizar despesas mensais</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = templates.map(template => `
        <div class="template-card">
            <div class="template-card-header">
                <h3>${template.name}</h3>
                <button onclick="deleteTemplate(${template.id})" class="btn-small btn-delete">🗑️ Excluir</button>
            </div>
            <div class="template-card-info">
                📅 Criado em: ${formatDate(template.createdAt.slice(0, 10))}
            </div>
            <div class="template-card-info">
                💰 ${template.transactions.length} despesas • Total: ${formatCurrency(template.transactions.reduce((sum, t) => sum + t.valor, 0))}
            </div>
            <details style="margin-top: 1rem;">
                <summary style="cursor: pointer; font-weight: 600; color: var(--primary);">Ver despesas incluídas</summary>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${template.transactions.map(t => `
                        <li style="margin: 0.3rem 0;">
                            ${t.categoria} - ${t.descricao}: ${formatCurrency(t.valor)}
                        </li>
                    `).join('')}
                </ul>
            </details>
        </div>
    `).join('');
}

// Deletar template
function deleteTemplate(id) {
    if (confirm('Deseja realmente excluir este template?')) {
        templates = templates.filter(t => t.id !== id);
        saveTemplates();
        updateTemplatesList();
        showToast('Template excluído', 'success');
    }
}

// Tornar função global
window.deleteTemplate = deleteTemplate;
