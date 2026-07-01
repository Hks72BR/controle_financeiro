// Bulk Import and Excel/CSV Handler

// Add row to bulk table
document.getElementById('addBulkRow')?.addEventListener('click', () => {
    addBulkRow();
});

function addBulkRow(data = {}) {
    const tbody = document.getElementById('bulkTableBody');
    const row = document.createElement('tr');
    
    const today = data.data || new Date().toISOString().split('T')[0];
    
    row.innerHTML = `
        <td><input type="date" class="bulk-input" value="${today}"></td>
        <td>
            <select class="bulk-input">
                <option value="Despesa" ${data.tipo === 'Despesa' ? 'selected' : ''}>Despesa</option>
                <option value="Receita" ${data.tipo === 'Receita' ? 'selected' : ''}>Receita</option>
            </select>
        </td>
        <td>
            <select class="bulk-input">
                <option value="">Selecione...</option>
                <option value="Salário" ${data.categoria === 'Salário' ? 'selected' : ''}>Salário</option>
                <option value="Vale" ${data.categoria === 'Vale' ? 'selected' : ''}>Vale</option>
                <option value="Religioso" ${data.categoria === 'Religioso' ? 'selected' : ''}>Religioso</option>
                <option value="Moradia" ${data.categoria === 'Moradia' ? 'selected' : ''}>Moradia</option>
                <option value="Internet/TV" ${data.categoria === 'Internet/TV' ? 'selected' : ''}>Internet/TV</option>
                <option value="Telefonia" ${data.categoria === 'Telefonia' ? 'selected' : ''}>Telefonia</option>
                <option value="Educação" ${data.categoria === 'Educação' ? 'selected' : ''}>Educação</option>
                <option value="Cartão" ${data.categoria === 'Cartão' ? 'selected' : ''}>Cartão</option>
                <option value="Serviços" ${data.categoria === 'Serviços' ? 'selected' : ''}>Serviços</option>
                <option value="Saúde" ${data.categoria === 'Saúde' ? 'selected' : ''}>Saúde</option>
                <option value="Transporte" ${data.categoria === 'Transporte' ? 'selected' : ''}>Transporte</option>
                <option value="Lazer" ${data.categoria === 'Lazer' ? 'selected' : ''}>Lazer</option>
                <option value="Compras" ${data.categoria === 'Compras' ? 'selected' : ''}>Compras</option>
                <option value="Alimentação" ${data.categoria === 'Alimentação' ? 'selected' : ''}>Alimentação</option>
                <option value="Beleza" ${data.categoria === 'Beleza' ? 'selected' : ''}>Beleza</option>
                <option value="Combustível" ${data.categoria === 'Combustível' ? 'selected' : ''}>Combustível</option>
                <option value="Veículo" ${data.categoria === 'Veículo' ? 'selected' : ''}>Veículo</option>
                <option value="Presentes" ${data.categoria === 'Presentes' ? 'selected' : ''}>Presentes</option>
                <option value="Móveis" ${data.categoria === 'Móveis' ? 'selected' : ''}>Móveis</option>
                <option value="Outros" ${data.categoria === 'Outros' ? 'selected' : ''}>Outros</option>
            </select>
        </td>
        <td><input type="text" class="bulk-input" value="${data.descricao || ''}" placeholder="Descrição"></td>
        <td><input type="number" class="bulk-input" step="0.01" value="${data.valor || ''}" placeholder="0,00"></td>
        <td>
            <select class="bulk-input">
                <option value="Débito" ${data.pagamento === 'Débito' ? 'selected' : ''}>Débito</option>
                <option value="Crédito" ${data.pagamento === 'Crédito' ? 'selected' : ''}>Crédito</option>
                <option value="Dinheiro" ${data.pagamento === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                <option value="PIX" ${data.pagamento === 'PIX' ? 'selected' : ''}>PIX</option>
                <option value="Transferência" ${data.pagamento === 'Transferência' ? 'selected' : ''}>Transferência</option>
            </select>
        </td>
        <td><button class="btn-delete" onclick="this.parentElement.parentElement.remove()">🗑️</button></td>
    `;
    
    tbody.appendChild(row);
}

// Save all bulk transactions
document.getElementById('saveBulkTransactions')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#bulkTableBody tr');
    
    if (rows.length === 0) {
        showToast('Adicione pelo menos uma transação', 'error');
        return;
    }
    
    let saved = 0;
    
    rows.forEach(row => {
        const inputs = row.querySelectorAll('.bulk-input');
        
        const data = inputs[0].value;
        const tipo = inputs[1].value;
        const categoria = inputs[2].value;
        const descricao = inputs[3].value;
        const valor = parseFloat(inputs[4].value);
        const pagamento = inputs[5].value;
        
        if (data && tipo && categoria && descricao && valor && pagamento) {
            const transaction = {
                id: Date.now() + Math.random() * 10000,
                tipo,
                data,
                categoria,
                descricao,
                valor,
                pagamento,
                usuario: currentUser,
                criadoEm: new Date().toISOString()
            };
            
            appData.transactions.push(transaction);
            saved++;
        }
    });
    
    if (saved > 0) {
        saveData();
        updateDashboard();
        updateTransactionsList();
        updateReports();
        
        // Clear table
        document.getElementById('bulkTableBody').innerHTML = '';
        
        showToast(`${saved} transações salvas com sucesso!`, 'success');
        
        // Switch to dashboard
        document.querySelector('.nav-btn[data-tab="dashboard"]').click();
    } else {
        showToast('Preencha todos os campos obrigatórios', 'error');
    }
});

// File input handler
document.getElementById('fileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    document.getElementById('fileInfo').textContent = `Arquivo: ${file.name}`;
    
    const fileType = file.name.split('.').pop().toLowerCase();
    
    try {
        if (fileType === 'csv') {
            await importCSV(file);
        } else if (fileType === 'xlsx' || fileType === 'xls') {
            await importExcel(file);
        } else {
            showToast('Formato não suportado. Use .xlsx, .xls ou .csv', 'error');
        }
    } catch (error) {
        console.error('Erro ao importar:', error);
        showToast('Erro ao importar arquivo', 'error');
    }
});

// Import CSV
async function importCSV(file) {
    const text = await file.text();
    const lines = text.trim().split('\n');
    
    // Clear table
    document.getElementById('bulkTableBody').innerHTML = '';
    
    let imported = 0;
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        
        if (values.length >= 6) {
            addBulkRow({
                data: values[0],
                tipo: values[1],
                categoria: values[2],
                descricao: values[4] || values[3],
                valor: parseFloat(values[5]),
                pagamento: values[6] || 'Débito'
            });
            imported++;
        }
    }
    
    showToast(`${imported} linhas importadas. Revise e clique em Salvar Todas`, 'success');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Import Excel
async function importExcel(file) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    
    // Get first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    // Clear table
    document.getElementById('bulkTableBody').innerHTML = '';
    
    let imported = 0;
    
    // Try to find header row and data
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip empty rows
        if (!row || row.length === 0) continue;
        
        // Try to detect if this is data row (has date-like first column)
        const firstCol = row[0];
        if (!firstCol) continue;
        
        // Convert to string and check if it looks like a date or category
        const firstStr = String(firstCol).toLowerCase();
        
        // Skip headers
        if (firstStr.includes('data') || firstStr.includes('categoria') || 
            firstStr.includes('descrição') || firstStr.includes('entrada') ||
            firstStr.includes('saída') || firstStr.includes('valor')) {
            continue;
        }
        
        // Try to parse as transaction
        let data, tipo, categoria, descricao, valor, pagamento;
        
        // Check if row has enough columns
        if (row.length >= 4) {
            // Pattern 1: Data, Tipo, Categoria, Descricao, Valor, Pagamento
            if (row.length >= 6) {
                data = parseExcelDate(row[0]);
                tipo = String(row[1]).includes('Receita') ? 'Receita' : 'Despesa';
                categoria = row[2];
                descricao = row[4] || row[3];
                valor = parseExcelValue(row[5]);
                pagamento = row[6] || 'Débito';
            }
            // Pattern 2: Categoria, Descricao, Entrada, Saida (from image)
            else {
                categoria = row[0];
                descricao = row[1];
                const entrada = parseExcelValue(row[2]);
                const saida = parseExcelValue(row[3]);
                
                if (entrada > 0) {
                    tipo = 'Receita';
                    valor = entrada;
                } else if (saida > 0) {
                    tipo = 'Despesa';
                    valor = saida;
                } else {
                    continue; // Skip rows without values
                }
                
                data = new Date().toISOString().split('T')[0];
                pagamento = 'Débito';
            }
            
            if (categoria && descricao && valor > 0) {
                addBulkRow({
                    data,
                    tipo,
                    categoria,
                    descricao,
                    valor,
                    pagamento
                });
                imported++;
            }
        }
    }
    
    showToast(`${imported} linhas importadas do Excel. Revise e clique em Salvar Todas`, 'success');
}

function parseExcelDate(value) {
    if (!value) return new Date().toISOString().split('T')[0];
    
    // If it's already a string date
    if (typeof value === 'string' && value.includes('-')) {
        return value.split('T')[0];
    }
    
    // If it's an Excel serial date
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    
    return new Date().toISOString().split('T')[0];
}

function parseExcelValue(value) {
    if (!value) return 0;
    
    // Remove currency symbols and convert
    const cleaned = String(value).replace(/[R$\s]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Initialize with 3 empty rows
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('bulkTableBody')) {
        addBulkRow();
        addBulkRow();
        addBulkRow();
    }
});
