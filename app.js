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
const TRANSACTIONS_COL = 'transactions';
const CONFIG_COL = 'config';
const USERS_COL = 'users';

// ==================== STATE ====================
const USERS_KEY = 'financeiro_users';
const defaultUsers = {
    higor: { name: 'Higor', password: '1234' },
    rafa: { name: 'Rafaella', password: '1234' }
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
let unsubscribe = null; // Firestore listener

// ==================== INIT ====================
function init() {
    if (!localStorage.getItem(USERS_KEY)) {
        localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }
    // Load config from Firestore (fallback to defaults)
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

// ==================== AUTH ====================
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('userSelect').value;
    const password = document.getElementById('passwordInput').value;
    const users = JSON.parse(localStorage.getItem(USERS_KEY));

    if (users[username] && users[username].password === password) {
        currentUser = users[username].name;
        currentUserKey = username;
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        document.getElementById('currentUser').textContent = currentUser;
        document.getElementById('userAvatar').textContent = currentUser[0];
        startRealtimeSync();
        loadConfigFromFirestore().then(() => renderDashboard());
        showToast(`Bem-vindo(a), ${currentUser}!`, 'success');
    } else {
        showToast('Usuário ou senha incorretos', 'error');
    }
});

function logout() {
    if (unsubscribe) unsubscribe();
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

    const receitas = filtered.filter(t => t.tipo === 'Receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const despesas = filtered.filter(t => t.tipo === 'Despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const saldo = receitas - despesas;
    const rendaTotal = getRendaFamiliar();
    const taxa = rendaTotal > 0 ? Math.max(0, ((rendaTotal - despesas) / rendaTotal * 100)) : 0;

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
                    <h4>${escapeHtml(t.descricao || 'Sem descrição')}</h4>
                    <p>${escapeHtml(t.categoria || '')} ${t.subcategoria ? '• ' + escapeHtml(t.subcategoria) : ''} • ${escapeHtml(t.fonte || '')}</p>
                </div>
            </div>
            <div class="tx-right">
                <div class="tx-value ${t.tipo === 'Receita' ? 'receita' : 'despesa'}">
                    ${t.tipo === 'Receita' ? '+' : '-'} ${formatCurrency(t.valor)}
                </div>
                <div class="tx-date">${formatDateBR(t.data)}</div>
            </div>
            <div class="tx-actions">
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
        status: document.getElementById('formStatus').value
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

    const receitasData = months.map(mo => transactions.filter(t => t.data && t.data.startsWith(mo) && t.tipo === 'Receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));
    const despesasData = months.map(mo => transactions.filter(t => t.data && t.data.startsWith(mo) && t.tipo === 'Despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));

    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: months.map(mo => formatMonthName(mo).split(' ')[0].substring(0, 3)),
            datasets: [
                { label: 'Receitas', data: receitasData, backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 6 },
                { label: 'Despesas', data: despesasData, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' } }, x: { grid: { display: false } } }
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
function handleChangePassword() {
    const newPass = document.getElementById('newPassword').value;
    if (!newPass || newPass.length < 4) { showToast('Senha deve ter pelo menos 4 caracteres', 'error'); return; }
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    users[currentUserKey].password = newPass;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    document.getElementById('passwordModal').classList.remove('active');
    document.getElementById('newPassword').value = '';
    showToast('Senha alterada!', 'success');
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

// ==================== INIT ====================
init();
