// Importador automático de dados dos CSVs
async function importarDadosCSV() {
    try {
        // Tentar buscar Controle_Financeiro.csv primeiro, depois Fato_Transacoes.csv
        let response;
        let csvText;
        
        try {
            response = await fetch('Controle_Financeiro.csv');
            csvText = await response.text();
        } catch (e) {
            response = await fetch('Fato_Transacoes.csv');
            csvText = await response.text();
        }
        
        // Parse CSV - função auxiliar para processar linha com vírgulas em valores
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
        
        const linhas = csvText.trim().split('\n');
        const transacoes = [];
        
        // Pular header (linha 0)
        for (let i = 1; i < linhas.length; i++) {
            const valores = parseCSVLine(linhas[i]);
            
            if (valores.length >= 7 && valores[0]) {
                // Determinar usuário pela descrição
                let usuario = 'Sistema';
                const descricao = valores[4].toLowerCase();
                if (descricao.includes('higor')) {
                    usuario = 'Higor';
                } else if (descricao.includes('rafa')) {
                    usuario = 'Rafa';
                }
                
                const transacao = {
                    id: Date.now() + i + Math.random() * 1000,
                    data: valores[0],
                    tipo: valores[1],
                    categoria: valores[2],
                    descricao: valores[4],
                    valor: parseFloat(valores[5]),
                    pagamento: valores[6] || 'Débito',
                    usuario: usuario,
                    criadoEm: new Date().toISOString()
                };
                
                transacoes.push(transacao);
            }
        }
        
        // Salvar no localStorage
        const dados = {
            transactions: transacoes,
            lastSync: new Date().toISOString()
        };
        
        localStorage.setItem('financeiro_data', JSON.stringify(dados));
        
        return transacoes.length;
    } catch (error) {
        console.error('Erro ao importar CSV:', error);
        throw error;
    }
}

// Exportar função
window.importarDadosCSV = importarDadosCSV;
