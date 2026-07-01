// Script para importar o CSV existente para o Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseApp = initializeApp({
    apiKey: "AIzaSyD4jC4XAJZ7btb0y-Cg82EOIAtdIoD7DPw",
    projectId: "controle-financeiro-593ea",
});

const db = getFirestore(firebaseApp);
const CSV_FILE = path.join(__dirname, 'Controle_Financeiro.csv');

async function importar() {
    const conteudo = fs.readFileSync(CSV_FILE, 'utf-8');
    const linhas = conteudo.split('\n').filter(l => l.trim());
    const header = linhas[0].split(',');
    
    console.log(`📄 ${linhas.length - 1} registros para importar`);
    console.log(`📋 Campos: ${header.join(', ')}`);

    // Verificar transações existentes para evitar duplicatas
    const snapshot = await getDocs(collection(db, 'transactions'));
    const existentes = new Set();
    snapshot.docs.forEach(doc => {
        const d = doc.data();
        existentes.add(`${d.data}_${d.valor}_${d.descricao}`);
    });
    console.log(`🔍 ${existentes.size} transações já existem no Firestore`);

    let importados = 0;
    let pulados = 0;

    for (let i = 1; i < linhas.length; i++) {
        const campos = linhas[i].split(',');
        if (campos.length < 7) continue;

        const [data, tipo, categoria, subcategoria, descricao, valor, fonte, status] = campos;
        
        // Verificar duplicata
        const chave = `${data}_${parseFloat(valor)}_${descricao}`;
        if (existentes.has(chave)) {
            pulados++;
            continue;
        }

        // Detectar pagador pelo nome
        let pagador = 'familia';
        const descLower = descricao.toLowerCase();
        if (descLower.includes('higor')) pagador = 'higor';
        else if (descLower.includes('rafa')) pagador = 'rafa';

        const transaction = {
            data: data.trim(),
            tipo: tipo.trim(),
            categoria: categoria.trim(),
            subcategoria: subcategoria.trim(),
            descricao: descricao.trim(),
            valor: parseFloat(valor),
            fonte: fonte.trim(),
            pagador,
            status: (status || 'Pago').trim(),
            createdBy: 'csv-import',
            createdAt: new Date()
        };

        try {
            await addDoc(collection(db, 'transactions'), transaction);
            importados++;
            console.log(`  ✅ ${importados}. ${descricao} - R$ ${valor} (${data})`);
        } catch (err) {
            console.error(`  ❌ Erro: ${descricao} - ${err.message}`);
        }
    }

    console.log(`\n🎉 Importação concluída!`);
    console.log(`   ✅ Importados: ${importados}`);
    console.log(`   ⏭️  Pulados (duplicatas): ${pulados}`);
    process.exit(0);
}

importar().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
