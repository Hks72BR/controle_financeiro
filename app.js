// ==================== CONTROLE FINANCEIRO - APP.JS ====================
// Família Coelho - PWA com Firebase Firestore

// ==================== FIREBASE CONFIG ====================
firebase.initializeApp({
    apiKey: "AIzaSyD4jC4XAJZ7btb0y-Cg82EOIAtdIoD7DPw",
    authDomain: "controle-financeiro-593ea.firebaseapp.com",
    projectId: "controle-financeiro-593ea",
    storageBucket: "controle-financeiro-593ea.firebasestorage.app",
    messagingSenderId: "697313204607",
    appId: "1:697313204607:web:2b2437bd40611f11c4e24a"
});

const db = firebase.firestore();
const auth = firebase.auth();

// Chart.js dark theme defaults
Chart.defaults.color = '#E8E6E3';
Chart.defaults.borderColor = '#3A3A3A';
Chart.defaults.plugins.legend.labels.color = '#E8E6E3';

const TRANSACTIONS_COL = 'transactions';
const CONFIG_COL = 'config';
const USERS_COL = 'users';

// ==================== STATE ====================
const USER_MAP = {
    higor: { name: 'Higor', email: 'higor@financascoelho.app' },
    rafa: { name: 'Rafaella', email: 'rafa@financascoelho.app' }
};

const defaultConfig = {
    higor: { salario: 2899.58, va: 2478.00, vt: 0, outros: 0 },
    rafa: { salario: 2500.00, va: 0, vt: 0, outros: 0 }
};

let currentUser = null;
let currentUserKey = null;
let transactions = [];
let config = {};
let charts = {};
let unsubscribe = null;
let budgets = {};
let metas = [];

// ==================== INIT ====================
function init() {
    loadConfigFromFirestore();
    setupEventListeners();
}

// ==================== FIREBASE DATA ====================
function startRealtimeSync() {
    // Listen to transactions in real-time
    if (unsubscribe) unsubscribe();

    unsubscribe = db.collection(TRANSACTIONS_COL)
        .orderBy('data', 'desc')
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by date ascending for processing
            transactions.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
            populateMonthSelectors();
            // Re-render active tab
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const tabName = activeTab.id.replace('Tab', '');
                switch (tabName) {
                    case 'dashboard': renderDashboard(); break;
                    case 'transactions': renderTransactions(); break;
                    case 'analytics': renderAnalytics(); break;
                }
            }
        }, err => {
            console.error('Firestore sync error:', err);
            showToast('Erro ao sincronizar dados', 'error');
        });
}

async function addTransactionToFirestore(transaction) {
    try {
        await db.collection(TRANSACTIONS_COL).add({
            ...transaction,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser || 'app'
        });
        return true;
    } catch (err) {
        console.error('Error adding transaction:', err);
        showToast('Erro ao salvar transação', 'error');
        return false;
    }
}

async function deleteTransactionFromFirestore(docId) {
    try {
        await db.collection(TRANSACTIONS_COL).doc(docId).delete();
        return true;
    } catch (err) {
        console.error('Error deleting:', err);
        showToast('Erro ao excluir', 'error');
        return false;
    }
}

async function updateTransactionInFirestore(docId, data) {
    try {
        await db.collection(TRANSACTIONS_COL).doc(docId).update(data);
        return true;
    } catch (err) {
        console.error('Error updating:', err);
        showToast('Erro ao atualizar', 'error');
        return false;
    }
}

async function loadConfigFromFirestore() {
    try {
        const doc = await db.collection(CONFIG_COL).doc('renda').get();
        if (doc.exists) {
            config = doc.data();
        } else {
            config = defaultConfig;
            await db.collection(CONFIG_COL).doc('renda').set(config);
        }
    } catch (err) {
        console.error('Config load error:', err);
        config = defaultConfig;
    }
}

async function saveConfigToFirestore() {
    try {
        await db.collection(CONFIG_COL).doc('renda').set(config);
        return true;
    } catch (err) {
        console.error('Config save error:', err);
        return false;
    }
}

// ==================== AUTH (Firebase Email/Password) ====================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('userSelect').value;
    const password = document.getElementById('passwordInput').value;
    const userInfo = USER_MAP[username];

    if (!userInfo) {
        showToast('Selecione um usuário', 'error');
        return;
    }

    try {
        // Tentar login
        await auth.signInWithEmailAndPassword(userInfo.email, password);
        enterApp(username, userInfo.name);
    } catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            // Pode ser primeiro acesso OU senha errada - tentar criar conta
            try {
                await auth.createUserWithEmailAndPassword(userInfo.email, password);
                enterApp(username, userInfo.name);
                showToast('Conta criada com sucesso!', 'success');
                return;
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    // Conta existe mas senha está errada
                    showToast('Senha incorreta', 'error');
                } else if (createErr.code === 'auth/weak-password') {
                    showToast('Senha fraca - use pelo menos 6 caracteres', 'error');
                } else {
                    showToast('Erro: ' + createErr.message, 'error');
                }
                return;
            }
        }
        showToast('Erro ao entrar: ' + err.message, 'error');
    }
});

function enterApp(userKey, userName) {
    currentUser = userName;
    currentUserKey = userKey;
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    document.getElementById('currentUser').textContent = currentUser;
    document.getElementById('userAvatar').textContent = currentUser[0];
    startRealtimeSync();
    Promise.all([loadConfigFromFirestore(), loadBudgetsFromFirestore(), loadMetasFromFirestore()]).then(() => renderDashboard());
    showToast(`Bem-vindo(a), ${currentUser}!`, 'success');
}

function logout() {
    if (unsubscribe) unsubscribe();
    auth.signOut();
    currentUser = null;
    currentUserKey = null;
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('passwordInput').value = '';
}

// ==================== NAVIGATION ====================
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('logoutBtnMobile').addEventListener('click', logout);
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);

    document.getElementById('dashboardMonth').addEventListener('change', renderDashboard);
    document.getElementById('analyticsMonth').addEventListener('change', renderAnalytics);

    document.getElementById('filterType').addEventListener('change', renderTransactions);
    document.getElementById('filterMonth').addEventListener('change', renderTransactions);
    document.getElementById('filterCategory').addEventListener('change', renderTransactions);
    document.getElementById('searchInput').addEventListener('input', renderTransactions);

    document.getElementById('transactionForm').addEventListener('submit', handleAddTransaction);
    document.getElementById('formData').value = new Date().toISOString().split('T')[0];

    document.getElementById('saveConfigBtn').addEventListener('click', handleSaveConfig);
    document.querySelectorAll('#configTab input[type="number"]').forEach(input => {
        input.addEventListener('input', updateConfigTotals);
    });

    document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleImport);
    document.getElementById('exportCsvBtn').addEventListener('click', handleExport);

    document.getElementById('changePasswordBtn').addEventListener('click', () => document.getElementById('passwordModal').classList.add('active'));
    document.getElementById('cancelPasswordBtn').addEventListener('click', () => document.getElementById('passwordModal').classList.remove('active'));
    document.getElementById('confirmPasswordBtn').addEventListener('click', handleChangePassword);
    document.getElementById('clearDataBtn').addEventListener('click', handleClearData);

    document.getElementById('saveBudgetBtn').addEventListener('click', handleSaveBudget);
    document.getElementById('addMetaBtn').addEventListener('click', handleAddMeta);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditTransaction);

    populateMonthSelectors();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));

    document.getElementById(`${tabName}Tab`).classList.add('active');
    document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));
    closeSidebar();

    switch (tabName) {
        case 'dashboard': renderDashboard(); break;
        case 'transactions': renderTransactions(); break;
        case 'analytics': renderAnalytics(); break;
        case 'config': renderConfig(); break;
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', closeSidebar);
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}

// ==================== MONTH SELECTORS ====================
function populateMonthSelectors() {
    const months = getAvailableMonths();
    const currentMonth = new Date().toISOString().slice(0, 7);

    ['dashboardMonth', 'analyticsMonth', 'filterMonth'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const prev = select.value;
        select.innerHTML = id === 'filterMonth' ? '<option value="all">Todos os meses</option>' : '';
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = formatMonthName(m);
            if ((prev && m === prev) || (!prev && m === currentMonth)) opt.selected = true;
            select.appendChild(opt);
        });
    });
}

function getAvailableMonths() {
    const monthsSet = new Set();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsSet.add(d.toISOString().slice(0, 7));
    }
    transactions.forEach(t => { if (t.data) monthsSet.add(t.data.slice(0, 7)); });
    return Array.from(monthsSet).sort().reverse();
}

function formatMonthName(ym) {
    const [y, m] = ym.split('-');
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${names[parseInt(m) - 1]} ${y}`;
}

// ==================== DASHBOARD ====================
function renderDashboard() {
    const month = document.getElementById('dashboardMonth').value || new Date().toISOString().slice(0, 7);
    const filtered = transactions.filter(t => t.data && t.data.startsWith(month));

    const receitasExtras = filtered.filter(t => t.tipo === 'Receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const rendaBase = getRendaFamiliar();
    const receitas = rendaBase + receitasExtras;
    const despesas = filtered.filter(t => t.tipo === 'Despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const saldo = receitas - despesas;
    const taxa = receitas > 0 ? Math.max(0, ((receitas - despesas) / receitas * 100)) : 0;

    document.getElementById('totalReceitas').textContent = formatCurrency(receitas);
    document.getElementById('totalDespesas').textContent = formatCurrency(despesas);
    document.getElementById('saldo').textContent = formatCurrency(saldo);
    document.getElementById('taxaEconomia').textContent = taxa.toFixed(0) + '%';
    document.getElementById('dashboardSubtitle').textContent = formatMonthName(month);

    const higorCfg = config.higor || {};
    const rafaCfg = config.rafa || {};
    document.getElementById('higorLiquido').textContent = formatCurrency(higorCfg.salario || 0);
    document.getElementById('higorBeneficios').textContent = formatCurrency((higorCfg.va || 0) + (higorCfg.vt || 0) + (higorCfg.outros || 0));
    document.getElementById('rafaLiquido').textContent = formatCurrency(rafaCfg.salario || 0);
    document.getElementById('rafaBeneficios').textContent = formatCurrency((rafaCfg.va || 0) + (rafaCfg.vt || 0) + (rafaCfg.outros || 0));

    renderDashPieChart(filtered);
    renderRecentTransactions(filtered);
    renderBudgetDashboard(filtered);
    renderMetasDashboard();
}

function renderDashPieChart(filtered) {
    const despesas = filtered.filter(t => t.tipo === 'Despesa');
    const byCategory = {};
    despesas.forEach(t => { byCategory[t.categoria || 'Outros'] = (byCategory[t.categoria || 'Outros'] || 0) + (parseFloat(t.valor) || 0); });

    if (charts.dashPie) charts.dashPie.destroy();
    const ctx = document.getElementById('dashPieChart');
    if (!ctx) return;

    charts.dashPie = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(byCategory), datasets: [{ data: Object.values(byCategory), backgroundColor: generateColors(Object.keys(byCategory).length), borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } }, cutout: '65%' }
    });
}

function renderRecentTransactions(filtered) {
    const container = document.getElementById('recentTransactions');
    const recent = filtered.slice(-8).reverse();

    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons-round">receipt_long</span><p>Nenhuma transação neste mês</p></div>';
        return;
    }

    container.innerHTML = recent.map(t => `
        <div class="recent-item">
            <div class="recent-item-left">
                <span class="recent-item-desc">${escapeHtml(t.descricao || 'Sem descrição')}</span>
                <span class="recent-item-cat">${escapeHtml(t.categoria || '')} • ${formatDateBR(t.data)}</span>
            </div>
            <span class="recent-item-value ${t.tipo === 'Receita' ? 'receita' : 'despesa'}">
                ${t.tipo === 'Receita' ? '+' : '-'} ${formatCurrency(t.valor)}
            </span>
        </div>
    `).join('');
}

// ==================== TRANSACTIONS ====================
function renderTransactions() {
    const type = document.getElementById('filterType').value;
    const month = document.getElementById('filterMonth').value;
    const category = document.getElementById('filterCategory').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    let filtered = [...transactions];
    if (type !== 'all') filtered = filtered.filter(t => t.tipo === type);
    if (month !== 'all') filtered = filtered.filter(t => t.data && t.data.startsWith(month));
    if (category !== 'all') filtered = filtered.filter(t => t.categoria === category);
    if (search) filtered = filtered.filter(t => (t.descricao || '').toLowerCase().includes(search) || (t.categoria || '').toLowerCase().includes(search));

    const categories = [...new Set(transactions.map(t => t.categoria).filter(Boolean))].sort();
    const catSelect = document.getElementById('filterCategory');
    const currentCat = catSelect.value;
    catSelect.innerHTML = '<option value="all">Todas categorias</option>' + categories.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

    const container = document.getElementById('transactionsList');
    filtered.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons-round">search_off</span><p>Nenhuma transação encontrada</p></div>';
        return;
    }

    container.innerHTML = filtered.map(t => `
        <div class="transaction-row">
            <div class="tx-left">
                <div class="tx-icon ${t.tipo === 'Receita' ? 'receita' : 'despesa'}">
                    <span class="material-icons-round">${t.tipo === 'Receita' ? 'arrow_upward' : 'arrow_downward'}</span>
                </div>
                <div class="tx-info">
                    <h4>${escapeHtml(t.descricao || 'Sem descrição')}${t.recorrente ? '<span class="material-icons-round tx-recurring" title="Recorrente">repeat</span>' : ''}</h4>
                    <p>${escapeHtml(t.categoria || '')} ${t.subcategoria ? '• ' + escapeHtml(t.subcategoria) : ''} • ${escapeHtml(t.fonte || '')}${getPagadorBadge(t.pagador)}</p>
                </div>
            </div>
            <div class="tx-right">
                <div class="tx-value ${t.tipo === 'Receita' ? 'receita' : 'despesa'}">
                    ${t.tipo === 'Receita' ? '+' : '-'} ${formatCurrency(t.valor)}
                </div>
                <div class="tx-date">${formatDateBR(t.data)}</div>
            </div>
            <div class="tx-actions">
                <button onclick="editTransaction('${t.id}')" class="edit-btn" title="Editar">
                    <span class="material-icons-round" style="font-size:1.1rem">edit</span>
                </button>
                <button onclick="deleteTransaction('${t.id}')" title="Excluir">
                    <span class="material-icons-round" style="font-size:1.1rem">delete</span>
                </button>
            </div>
        </div>`).join('');
}

async function deleteTransaction(docId) {
    if (!confirm('Excluir esta transação?')) return;
    await deleteTransactionFromFirestore(docId);
    showToast('Transação excluída', 'info');
}

// ==================== ADD TRANSACTION ====================
async function handleAddTransaction(e) {
    e.preventDefault();

    const transaction = {
        data: document.getElementById('formData').value,
        tipo: document.querySelector('input[name="tipo"]:checked').value,
        categoria: document.getElementById('formCategoria').value,
        subcategoria: document.getElementById('formSubcategoria').value,
        descricao: document.getElementById('formDescricao').value,
        valor: parseFloat(document.getElementById('formValor').value),
        fonte: document.getElementById('formPagamento').value,
        status: document.getElementById('formStatus').value,
        pagador: document.getElementById('formPagador').value,
        recorrente: document.getElementById('formRecorrente').checked
    };

    const ok = await addTransactionToFirestore(transaction);
    if (ok) {
        document.getElementById('transactionForm').reset();
        document.getElementById('formData').value = new Date().toISOString().split('T')[0];
        document.querySelector('input[name="tipo"][value="Despesa"]').checked = true;
        showToast('Transação adicionada!', 'success');
    }
}

// ==================== ANALYTICS ====================
function renderAnalytics() {
    const month = document.getElementById('analyticsMonth').value || new Date().toISOString().slice(0, 7);
    const filtered = transactions.filter(t => t.data && t.data.startsWith(month));
    const despesas = filtered.filter(t => t.tipo === 'Despesa');

    const totalDespesas = despesas.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const rendaFamiliar = getRendaFamiliar();
    const comprometimento = rendaFamiliar > 0 ? (totalDespesas / rendaFamiliar * 100) : 0;

    document.getElementById('kpiRendaTotal').textContent = formatCurrency(rendaFamiliar);
    document.getElementById('kpiComprometimento').textContent = Math.min(comprometimento, 100).toFixed(0) + '%';
    document.getElementById('kpiCompBar').style.width = Math.min(comprometimento, 100) + '%';
    document.getElementById('kpiCompBar').style.background = comprometimento > 80 ? 'var(--danger)' : comprometimento > 60 ? 'var(--warning)' : 'var(--success)';
    document.getElementById('kpiQtdTransacoes').textContent = filtered.length;

    if (despesas.length > 0) {
        const maior = despesas.reduce((max, t) => (parseFloat(t.valor) || 0) > (parseFloat(max.valor) || 0) ? t : max);
        document.getElementById('kpiMaiorGasto').textContent = `${maior.descricao} (${formatCurrency(maior.valor)})`;
    } else {
        document.getElementById('kpiMaiorGasto').textContent = '-';
    }

    renderBarChart(month);
    renderDoughnutChart(despesas);
    renderPaymentChart(despesas);
    renderTopExpenses(despesas);
}

function renderBarChart(currentMonth) {
    const months = [];
    const [y, m] = currentMonth.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        months.push(d.toISOString().slice(0, 7));
    }

    const rendaFamiliar = getRendaFamiliar();
    const rendaData = months.map(() => rendaFamiliar);
    const despesasData = months.map(mo => transactions.filter(t => t.data && t.data.startsWith(mo) && t.tipo === 'Despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));

    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: months.map(mo => formatMonthName(mo).split(' ')[0].substring(0, 3)),
            datasets: [
                { label: 'Renda Familiar', data: rendaData, backgroundColor: 'rgba(197, 165, 90, 0.8)', borderRadius: 6 },
                { label: 'Despesas', data: despesasData, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#3A3A3A' } }, x: { grid: { display: false } } }
        }
    });
}

function renderDoughnutChart(despesas) {
    const byCategory = {};
    despesas.forEach(t => { byCategory[t.categoria || 'Outros'] = (byCategory[t.categoria || 'Outros'] || 0) + (parseFloat(t.valor) || 0); });
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    if (charts.doughnut) charts.doughnut.destroy();
    charts.doughnut = new Chart(document.getElementById('doughnutChart'), {
        type: 'doughnut',
        data: { labels: sorted.map(e => e[0]), datasets: [{ data: sorted.map(e => e[1]), backgroundColor: generateColors(sorted.length), borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } } }
    });
}

function renderPaymentChart(despesas) {
    const byPayment = {};
    despesas.forEach(t => { byPayment[t.fonte || 'Outros'] = (byPayment[t.fonte || 'Outros'] || 0) + (parseFloat(t.valor) || 0); });
    const colors = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    if (charts.payment) charts.payment.destroy();
    charts.payment = new Chart(document.getElementById('paymentChart'), {
        type: 'pie',
        data: { labels: Object.keys(byPayment), datasets: [{ data: Object.values(byPayment), backgroundColor: colors.slice(0, Object.keys(byPayment).length), borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } } }
    });
}

function renderTopExpenses(despesas) {
    const sorted = [...despesas].sort((a, b) => (parseFloat(b.valor) || 0) - (parseFloat(a.valor) || 0)).slice(0, 10);
    const container = document.getElementById('topExpensesList');

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sem despesas neste mês</p></div>';
        return;
    }

    container.innerHTML = sorted.map((t, i) => `
        <div class="top-item">
            <span class="top-item-rank">#${i + 1}</span>
            <div class="top-item-info">
                <div class="top-item-desc">${escapeHtml(t.descricao || 'Sem descrição')}</div>
                <div class="top-item-cat">${escapeHtml(t.categoria || '')} • ${formatDateBR(t.data)}</div>
            </div>
            <span class="top-item-value">${formatCurrency(t.valor)}</span>
        </div>
    `).join('');
}

// ==================== CONFIG ====================
function renderConfig() {
    const higor = config.higor || {};
    const rafa = config.rafa || {};

    document.getElementById('cfgHigorSalario').value = higor.salario || '';
    document.getElementById('cfgHigorVA').value = higor.va || '';
    document.getElementById('cfgHigorVT').value = higor.vt || '';
    document.getElementById('cfgHigorOutros').value = higor.outros || '';

    document.getElementById('cfgRafaSalario').value = rafa.salario || '';
    document.getElementById('cfgRafaVA').value = rafa.va || '';
    document.getElementById('cfgRafaVT').value = rafa.vt || '';
    document.getElementById('cfgRafaOutros').value = rafa.outros || '';

    updateConfigTotals();
    renderBudgetConfig();
    renderMetasConfig();
}

function updateConfigTotals() {
    const hT = (parseFloat(document.getElementById('cfgHigorSalario').value) || 0) +
        (parseFloat(document.getElementById('cfgHigorVA').value) || 0) +
        (parseFloat(document.getElementById('cfgHigorVT').value) || 0) +
        (parseFloat(document.getElementById('cfgHigorOutros').value) || 0);

    const rT = (parseFloat(document.getElementById('cfgRafaSalario').value) || 0) +
        (parseFloat(document.getElementById('cfgRafaVA').value) || 0) +
        (parseFloat(document.getElementById('cfgRafaVT').value) || 0) +
        (parseFloat(document.getElementById('cfgRafaOutros').value) || 0);

    document.getElementById('cfgHigorTotal').textContent = formatCurrency(hT);
    document.getElementById('cfgRafaTotal').textContent = formatCurrency(rT);
    document.getElementById('cfgFamiliaTotal').textContent = formatCurrency(hT + rT);
}

async function handleSaveConfig() {
    config = {
        higor: {
            salario: parseFloat(document.getElementById('cfgHigorSalario').value) || 0,
            va: parseFloat(document.getElementById('cfgHigorVA').value) || 0,
            vt: parseFloat(document.getElementById('cfgHigorVT').value) || 0,
            outros: parseFloat(document.getElementById('cfgHigorOutros').value) || 0
        },
        rafa: {
            salario: parseFloat(document.getElementById('cfgRafaSalario').value) || 0,
            va: parseFloat(document.getElementById('cfgRafaVA').value) || 0,
            vt: parseFloat(document.getElementById('cfgRafaVT').value) || 0,
            outros: parseFloat(document.getElementById('cfgRafaOutros').value) || 0
        }
    };
    const ok = await saveConfigToFirestore();
    if (ok) showToast('Configurações salvas!', 'success');
}

function getRendaFamiliar() {
    const h = config.higor || {};
    const r = config.rafa || {};
    return (h.salario || 0) + (h.va || 0) + (h.vt || 0) + (h.outros || 0) +
        (r.salario || 0) + (r.va || 0) + (r.vt || 0) + (r.outros || 0);
}

// ==================== IMPORT/EXPORT ====================
async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            let imported = [];

            if (file.name.endsWith('.csv')) {
                const lines = evt.target.result.split('\n').filter(l => l.trim());
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length >= 6) {
                        imported.push({
                            data: cols[0]?.trim(), tipo: cols[1]?.trim(),
                            categoria: cols[2]?.trim(), subcategoria: cols[3]?.trim(),
                            descricao: cols[4]?.trim(), valor: parseFloat(cols[5]) || 0,
                            fonte: cols[6]?.trim() || 'Débito', status: cols[7]?.trim() || 'Pago'
                        });
                    }
                }
            } else {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet);
                imported = data.map(row => ({
                    data: row.Data || row.data || '', tipo: row.Tipo || row.tipo || 'Despesa',
                    categoria: row.Categoria || row.categoria || 'Outros',
                    subcategoria: row.Subcategoria || row.subcategoria || '',
                    descricao: row.Descricao || row.descricao || row['Descrição'] || '',
                    valor: parseFloat(row.Valor || row.valor) || 0,
                    fonte: row.Fonte_Pagamento || row.fonte || row.Pagamento || 'Débito',
                    status: row.Status || row.status || 'Pago'
                }));
            }

            // Batch write to Firestore
            const batch = db.batch();
            imported.forEach(t => {
                const ref = db.collection(TRANSACTIONS_COL).doc();
                batch.set(ref, { ...t, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser || 'import' });
            });
            await batch.commit();

            showToast(`${imported.length} transações importadas!`, 'success');
        } catch (err) {
            showToast('Erro ao importar arquivo', 'error');
            console.error(err);
        }
    };

    file.name.endsWith('.csv') ? reader.readAsText(file) : reader.readAsBinaryString(file);
    e.target.value = '';
}

function handleExport() {
    if (transactions.length === 0) { showToast('Nenhuma transação para exportar', 'error'); return; }

    const header = 'Data,Tipo,Categoria,Subcategoria,Descricao,Valor,Fonte_Pagamento,Status';
    const lines = transactions.map(t =>
        `${t.data},${t.tipo},${t.categoria},${t.subcategoria || ''},${(t.descricao || '').replace(/,/g, ' ')},${(t.valor || 0).toFixed(2)},${t.fonte || 'Débito'},${t.status || 'Pago'}`
    );

    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Controle_Financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado!', 'success');
}

// ==================== PASSWORD / CLEAR ====================
async function handleChangePassword() {
    const newPass = document.getElementById('newPassword').value;
    if (!newPass || newPass.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return; }
    try {
        const user = auth.currentUser;
        if (user) {
            await user.updatePassword(newPass);
            document.getElementById('passwordModal').classList.remove('active');
            document.getElementById('newPassword').value = '';
            showToast('Senha alterada com sucesso!', 'success');
        }
    } catch (err) {
        showToast('Erro ao alterar senha: ' + err.message, 'error');
    }
}

async function handleClearData() {
    if (!confirm('⚠️ Tem certeza? Isso vai apagar TODAS as transações!')) return;
    if (!confirm('Última chance! Confirma?')) return;

    const snapshot = await db.collection(TRANSACTIONS_COL).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    showToast('Dados limpos', 'info');
}

// ==================== UTILITIES ====================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
}

function generateColors(count) {
    const palette = ['#6C63FF', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7C4DFF', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B', '#E91E63', '#3F51B5', '#009688', '#FFC107', '#795548'];
    return palette.slice(0, count);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== BUDGET & METAS ====================
async function loadBudgetsFromFirestore() {
    try {
        const doc = await db.collection(CONFIG_COL).doc('orcamento').get();
        if (doc.exists) budgets = doc.data();
        else budgets = {};
    } catch (err) {
        console.error('Budget load error:', err);
        budgets = {};
    }
}

async function saveBudgetsToFirestore() {
    try {
        await db.collection(CONFIG_COL).doc('orcamento').set(budgets);
        return true;
    } catch (err) {
        console.error('Budget save error:', err);
        showToast('Erro ao salvar orçamento', 'error');
        return false;
    }
}

async function loadMetasFromFirestore() {
    try {
        const doc = await db.collection(CONFIG_COL).doc('metas').get();
        if (doc.exists) metas = doc.data().lista || [];
        else metas = [];
    } catch (err) {
        console.error('Metas load error:', err);
        metas = [];
    }
}

async function saveMetasToFirestore() {
    try {
        await db.collection(CONFIG_COL).doc('metas').set({ lista: metas });
        return true;
    } catch (err) {
        console.error('Metas save error:', err);
        showToast('Erro ao salvar metas', 'error');
        return false;
    }
}

function renderBudgetDashboard(filtered) {
    const container = document.getElementById('budgetDashboard');
    const cards = document.getElementById('budgetCards');
    const activeBudgets = Object.entries(budgets).filter(([_, v]) => v > 0);

    if (activeBudgets.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';

    const despesas = filtered.filter(t => t.tipo === 'Despesa');
    const byCategory = {};
    despesas.forEach(t => { byCategory[t.categoria || 'Outros'] = (byCategory[t.categoria || 'Outros'] || 0) + (parseFloat(t.valor) || 0); });

    cards.innerHTML = activeBudgets.map(([cat, limit]) => {
        const spent = byCategory[cat] || 0;
        const pct = Math.min((spent / limit) * 100, 100);
        const color = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)';
        return `<div class="budget-card">
            <div class="budget-card-header"><h4>${escapeHtml(cat)}</h4><span>${formatCurrency(spent)} / ${formatCurrency(limit)}</span></div>
            <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
    }).join('');
}

function renderMetasDashboard() {
    const container = document.getElementById('metasDashboard');
    const cards = document.getElementById('metasCards');

    if (metas.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';

    const totalReceitas = transactions.filter(t => t.tipo === 'Receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const totalDespesas = transactions.filter(t => t.tipo === 'Despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const distinctMonths = new Set(transactions.map(t => t.data ? t.data.slice(0, 7) : null).filter(Boolean));
    const rendaAccumulated = getRendaFamiliar() * distinctMonths.size;
    const totalSavings = Math.max(0, (rendaAccumulated + totalReceitas) - totalDespesas);

    cards.innerHTML = metas.map(meta => {
        const pct = meta.valor > 0 ? Math.min((totalSavings / meta.valor) * 100, 100) : 0;
        const color = pct >= 100 ? 'var(--success)' : pct > 50 ? 'var(--primary)' : 'var(--warning)';
        return `<div class="meta-card">
            <div class="meta-card-header"><h4>${escapeHtml(meta.nome)}</h4><span>${formatCurrency(totalSavings)} / ${formatCurrency(meta.valor)}</span></div>
            <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${pct.toFixed(0)}%;background:${color}"></div></div>
            <div class="meta-deadline">Prazo: ${meta.prazo ? formatMonthName(meta.prazo) : 'Não definido'}</div>
        </div>`;
    }).join('');
}

function renderBudgetConfig() {
    document.querySelectorAll('.budget-input').forEach(input => {
        input.value = budgets[input.dataset.category] || '';
    });
}

function renderMetasConfig() {
    const container = document.getElementById('metasList');
    if (metas.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:1rem"><p>Nenhuma meta definida</p></div>';
        return;
    }
    container.innerHTML = metas.map((m, i) => `
        <div class="meta-list-item">
            <div class="meta-info">
                <h4>${escapeHtml(m.nome)}</h4>
                <p>${formatCurrency(m.valor)} \u2022 Prazo: ${m.prazo ? formatMonthName(m.prazo) : 'N\u00e3o definido'}</p>
            </div>
            <button onclick="removeMeta(${i})" title="Remover">
                <span class="material-icons-round" style="font-size:1.1rem">delete</span>
            </button>
        </div>
    `).join('');
}

async function handleSaveBudget() {
    budgets = {};
    document.querySelectorAll('.budget-input').forEach(input => {
        const val = parseFloat(input.value) || 0;
        if (val > 0) budgets[input.dataset.category] = val;
    });
    const ok = await saveBudgetsToFirestore();
    if (ok) showToast('Or\u00e7amento salvo!', 'success');
}

async function handleAddMeta() {
    const nome = document.getElementById('metaNome').value.trim();
    const valor = parseFloat(document.getElementById('metaValor').value) || 0;
    const prazo = document.getElementById('metaPrazo').value;

    if (!nome || valor <= 0) { showToast('Preencha nome e valor da meta', 'error'); return; }

    metas.push({ nome, valor, prazo });
    const ok = await saveMetasToFirestore();
    if (ok) {
        document.getElementById('metaNome').value = '';
        document.getElementById('metaValor').value = '';
        document.getElementById('metaPrazo').value = '';
        renderMetasConfig();
        showToast('Meta adicionada!', 'success');
    }
}

async function removeMeta(index) {
    if (!confirm('Remover esta meta?')) return;
    metas.splice(index, 1);
    await saveMetasToFirestore();
    renderMetasConfig();
    showToast('Meta removida', 'info');
}

// ==================== EDIT TRANSACTION ====================
function editTransaction(docId) {
    const t = transactions.find(tx => tx.id === docId);
    if (!t) return;

    document.getElementById('editId').value = t.id;
    document.getElementById('editData').value = t.data || '';
    document.getElementById('editValor').value = t.valor || '';
    document.getElementById('editTipo').value = t.tipo || 'Despesa';
    document.getElementById('editCategoria').value = t.categoria || '';
    document.getElementById('editSubcategoria').value = t.subcategoria || '';
    document.getElementById('editDescricao').value = t.descricao || '';
    document.getElementById('editFonte').value = t.fonte || 'Pix';
    document.getElementById('editPagador').value = t.pagador || '';
    document.getElementById('editStatus').value = t.status || 'Pago';

    document.getElementById('editModal').classList.add('active');
}

async function saveEditTransaction() {
    const docId = document.getElementById('editId').value;
    const data = {
        data: document.getElementById('editData').value,
        tipo: document.getElementById('editTipo').value,
        categoria: document.getElementById('editCategoria').value,
        subcategoria: document.getElementById('editSubcategoria').value,
        descricao: document.getElementById('editDescricao').value,
        valor: parseFloat(document.getElementById('editValor').value) || 0,
        fonte: document.getElementById('editFonte').value,
        pagador: document.getElementById('editPagador').value,
        status: document.getElementById('editStatus').value
    };

    const ok = await updateTransactionInFirestore(docId, data);
    if (ok) {
        document.getElementById('editModal').classList.remove('active');
        showToast('Transa\u00e7\u00e3o atualizada!', 'success');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

function getPagadorBadge(pagador) {
    if (!pagador) return '';
    const cls = pagador === 'Higor' ? 'higor' : pagador === 'Rafaella' ? 'rafa' : 'familia';
    return ` <span class="pagador-badge ${cls}"><span class="dot"></span>${pagador}</span>`;
}

// ==================== INIT ====================
init();
