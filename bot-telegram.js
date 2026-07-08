// Bot Telegram - Controle Financeiro (Modo Autônomo)
// Recebe comprovantes (fotos, PDFs, documentos) e registra AUTOMATICAMENTE

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { PDFParse } = require('pdf-parse');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, serverTimestamp } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// ==================== FIREBASE ====================

const firebaseApp = initializeApp({
    apiKey: "AIzaSyD4jC4XAJZ7btb0y-Cg82EOIAtdIoD7DPw",
    authDomain: "controle-financeiro-593ea.firebaseapp.com",
    projectId: "controle-financeiro-593ea",
    storageBucket: "controle-financeiro-593ea.firebasestorage.app",
    messagingSenderId: "648090262378",
    appId: "1:648090262378:web:controle-financeiro"
});

const db = getFirestore(firebaseApp);
const authInstance = getAuth(firebaseApp);

// Autenticar bot com Firebase Auth
const BOT_EMAIL = process.env.BOT_EMAIL || 'bot@financascoelho.app';
const BOT_PASSWORD = process.env.BOT_PASSWORD || 'BotCoelho2026!';

async function authenticateBot() {
    try {
        await signInWithEmailAndPassword(authInstance, BOT_EMAIL, BOT_PASSWORD);
        console.log('🔐 Bot autenticado no Firebase');
    } catch (err) {
        console.error('❌ Falha na autenticação do bot:', err.message);
        console.error('   Configure BOT_EMAIL e BOT_PASSWORD no .env');
        console.error('   Ou crie a conta do bot no app primeiro');
    }
}

authenticateBot();

// ==================== CONFIGURAÇÃO ====================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CSV_FILE = path.join(__dirname, 'Controle_Financeiro.csv');
const TEMP_DIR = path.join(__dirname, 'temp_images');

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado no .env');
    process.exit(1);
}

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ==================== CONTAS FIXAS ====================

let fixedBills = [];

// Carregar contas fixas do Firestore
async function loadFixedBills() {
    try {
        const snapshot = await getDocs(collection(db, 'fixedBills'));
        fixedBills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`📋 ${fixedBills.length} contas fixas carregadas`);
    } catch (err) {
        console.error('Erro ao carregar contas fixas:', err.message);
        fixedBills = [];
    }
}

// Encontrar conta fixa que corresponde à transação
function findMatchingFixedBill(descricao, categoria) {
    if (fixedBills.length === 0) return null;
    
    const descLower = (descricao || '').toLowerCase();
    const catLower = (categoria || '').toLowerCase();
    const textoCompleto = `${descLower} ${catLower}`;
    
    for (const bill of fixedBills) {
        if (!bill.keywords) continue;
        
        const keywords = bill.keywords.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
        
        for (const keyword of keywords) {
            if (textoCompleto.includes(keyword)) {
                console.log(`🔗 Conta vinculada: "${keyword}" -> ${bill.name}`);
                return bill;
            }
        }
    }
    
    return null;
}

// Carregar contas fixas na inicialização
loadFixedBills();

// Recarregar contas fixas periodicamente (a cada 5 minutos)
setInterval(loadFixedBills, 5 * 60 * 1000);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ==================== AUTO-CATEGORIZAÇÃO ====================

const REGRAS_CATEGORIA = [
    // FGTS / Receitas especiais
    { palavras: ['fgts', 'saque fgts', 'fgts aniversário', 'fgts aniversario', 'cp fgts'], categoria: 'Outros', subcategoria: 'FGTS' },
    
    // Moradia
    { palavras: ['caixa economica', 'caixa econ', 'financiamento', 'parcela caixa', 'habitação'], categoria: 'Moradia', subcategoria: 'Financiamento' },
    { palavras: ['cury', 'mrv', 'construtora', 'incorporadora'], categoria: 'Moradia', subcategoria: 'Financiamento' },
    { palavras: ['aluguel', 'locação', 'imobiliária', 'imobiliaria'], categoria: 'Moradia', subcategoria: 'Aluguel' },
    { palavras: ['condomínio', 'condominio'], categoria: 'Moradia', subcategoria: 'Condomínio' },

    // Serviços / Utilidades
    { palavras: ['sabesp', 'água', 'agua', 'saneamento', 'copasa'], categoria: 'Serviços', subcategoria: 'Água' },
    { palavras: ['enel', 'cpfl', 'eletropaulo', 'luz', 'energia', 'celpe', 'coelba', 'cemig'], categoria: 'Serviços', subcategoria: 'Luz' },
    { palavras: ['comgás', 'comgas', 'gás', 'gas encanado'], categoria: 'Serviços', subcategoria: 'Gás' },

    // Telefonia
    { palavras: ['vivo', 'telefonica', 'claro', 'tim ', 'oi móvel', 'oi movel'], categoria: 'Telefonia', subcategoria: 'Celular' },
    { palavras: ['supersim'], categoria: 'Telefonia', subcategoria: 'Celular' },

    // Internet/TV
    { palavras: ['grajaúnet', 'grajanet', 'graja tecnologia', 'graja', 'internet', 'fibra', 'banda larga', 'net virtua', 'netflix', 'globoplay', 'disney', 'hbo', 'spotify', 'amazon prime', 'streaming'], categoria: 'Internet/TV', subcategoria: 'Internet' },

    // Educação
    { palavras: ['estácio', 'estacio', 'faculdade', 'universidade', 'unip', 'anhanguera', 'mensalidade'], categoria: 'Educação', subcategoria: 'Faculdade' },
    { palavras: ['senac', 'senai', 'curso', 'escola', 'udemy', 'alura'], categoria: 'Educação', subcategoria: 'Curso' },

    // Transporte
    { palavras: ['combustível', 'combustivel', 'gasolina', 'etanol', 'posto', 'shell', 'ipiranga', 'br distribuidora'], categoria: 'Transporte', subcategoria: 'Combustível' },
    { palavras: ['uber ', 'uber.com', '99app', '99pop', '99 pop', 'cabify', 'indrive', 'indriver'], categoria: 'Transporte', subcategoria: 'Uber' },
    { palavras: ['aluguel carro', 'locadora', 'movida', 'localiza', 'unidas'], categoria: 'Transporte', subcategoria: 'Aluguel Veículo' },

    // Saúde
    { palavras: ['academia', 'smartfit', 'smart fit', 'bluefit', 'blue fit'], categoria: 'Saúde', subcategoria: 'Academia' },
    { palavras: ['farmácia', 'farmacia', 'drogaria', 'droga raia', 'drogasil', 'pacheco'], categoria: 'Saúde', subcategoria: 'Farmácia' },
    { palavras: ['consulta', 'médico', 'medico', 'hospital', 'clínica', 'clinica', 'exame', 'laboratório'], categoria: 'Saúde', subcategoria: 'Consulta' },

    // Religioso
    { palavras: ['dízimo', 'dizimo', 'oferta', 'contribuição igreja', 'igreja'], categoria: 'Religioso', subcategoria: 'Dízimo' },

    // Cartão
    { palavras: ['nubank', 'nu bank'], categoria: 'Cartão', subcategoria: 'Cartão de Crédito' },
    { palavras: ['blipay', 'jeitto', 'picpay', 'mercado pago'], categoria: 'Cartão', subcategoria: 'Cartão de Crédito' },

    // Alimentação
    { palavras: ['mercado', 'supermercado', 'atacadão', 'atacadao', 'assaí', 'assai', 'pão de açúcar', 'extra', 'carrefour'], categoria: 'Alimentação', subcategoria: 'Mercado' },
    { palavras: ['ifood', 'rappi', 'delivery', 'restaurante', 'lanchonete', 'pizzaria', 'hamburgueria'], categoria: 'Alimentação', subcategoria: 'Restaurante' },

    // Veículo
    { palavras: ['oficina', 'mecânico', 'mecanico', 'pneu', 'borracharia', 'funilaria', 'autopeças', 'autopecas'], categoria: 'Veículo', subcategoria: 'Manutenção' },
    { palavras: ['ipva', 'licenciamento', 'detran', 'dpvat'], categoria: 'Veículo', subcategoria: 'IPVA' },
    { palavras: ['seguro auto', 'porto seguro', 'azul seguros'], categoria: 'Veículo', subcategoria: 'Seguro' },

    // Beleza
    { palavras: ['avon', 'natura', 'boticário', 'boticario', 'cosmético', 'cosmetico', 'salão', 'salao', 'barbearia', 'cabelereiro'], categoria: 'Beleza', subcategoria: 'Cosméticos' },

    // Lazer
    { palavras: ['viagem', 'hotel', 'pousada', 'airbnb', 'passagem aérea', 'passagem aerea', 'cinema', 'teatro', 'show', 'ingresso'], categoria: 'Lazer', subcategoria: 'Entretenimento' },
];

function autoCategorizar(texto) {
    const textoLower = texto.toLowerCase();

    for (const regra of REGRAS_CATEGORIA) {
        for (const palavra of regra.palavras) {
            if (textoLower.includes(palavra.toLowerCase())) {
                console.log(`[DEBUG] Categorizado: "${palavra}" -> ${regra.categoria} > ${regra.subcategoria}`);
                return { categoria: regra.categoria, subcategoria: regra.subcategoria };
            }
        }
    }

    console.log('[DEBUG] Nenhuma categoria encontrada, usando Outros');
    return { categoria: 'Outros', subcategoria: 'Outros' };
}

// ==================== PROCESSAMENTO DE EXTRATO BANCÁRIO ====================

function detectarExtratoBancario(texto) {
    const textoLower = texto.toLowerCase();
    
    // Indicadores de que é um extrato
    const indicadoresExtrato = [
        'extrato',
        'movimentação',
        'movimentacao', 
        'lançamentos',
        'lancamentos',
        'período',
        'periodo',
        'saldo anterior',
        'saldo atual',
        'saldo final',
        'saldo disponível',
        'saldo disponivel'
    ];
    
    const temIndicador = indicadoresExtrato.some(ind => textoLower.includes(ind));
    
    // Contar quantas linhas parecem ser transações (data + valor)
    const linhas = texto.split('\n');
    let linhasTransacao = 0;
    
    for (const linha of linhas) {
        // Padrão: data no início e valor no final
        if (/\d{2}[\/\-]\d{2}/.test(linha) && /[\d.,]+\s*[-]?\s*$|[-]?\s*[\d.,]+\s*$/.test(linha)) {
            linhasTransacao++;
        }
    }
    
    // É extrato se tem indicador OU tem muitas linhas de transação
    return temIndicador || linhasTransacao >= 5;
}

function extrairTransacoesExtrato(texto, anoReferencia = null) {
    const transacoes = [];
    const linhas = texto.split('\n');
    const anoAtual = anoReferencia || new Date().getFullYear();
    
    // Tentar detectar o ano/mês do extrato
    const matchPeriodo = texto.match(/(?:período|periodo|mês|mes|referência|referencia)[:\s]*(\d{2})[\/\-](\d{2,4})/i);
    let mesExtrato = null;
    let anoExtrato = anoAtual;
    
    if (matchPeriodo) {
        mesExtrato = parseInt(matchPeriodo[1]);
        if (matchPeriodo[2].length === 4) {
            anoExtrato = parseInt(matchPeriodo[2]);
        } else if (matchPeriodo[2].length === 2) {
            anoExtrato = 2000 + parseInt(matchPeriodo[2]);
        }
    }
    
    // Padrões comuns de linha de extrato
    const padroes = [
        // Padrão 1: DD/MM Descrição Valor (negativo ou positivo)
        /^(\d{2})[\/\-](\d{2})\s+(.+?)\s+(-?\s*[\d.,]+)\s*$/,
        // Padrão 2: DD/MM/AAAA Descrição Valor
        /^(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})\s+(.+?)\s+(-?\s*[\d.,]+)\s*$/,
        // Padrão 3: Descrição DD/MM Valor
        /^(.+?)\s+(\d{2})[\/\-](\d{2})\s+(-?\s*[\d.,]+)\s*$/,
        // Padrão 4: Data | Descrição | Débito | Crédito (formato tabular)
        /^(\d{2})[\/\-](\d{2})[\/\-]?(\d{0,4})?\s*\|?\s*(.+?)\s*\|?\s*(-?[\d.,]*)\s*\|?\s*(-?[\d.,]*)\s*$/,
    ];
    
    // Palavras a ignorar (não são transações)
    const ignorar = [
        'saldo', 'total', 'subtotal', 'resumo', 'agência', 'agencia', 
        'conta', 'cliente', 'cpf', 'cnpj', 'período', 'periodo',
        'banco', 'extrato', 'página', 'pagina', 'data', 'descrição', 'descricao',
        'valor', 'débito', 'debito', 'crédito', 'credito', 'lançamento', 'lancamento'
    ];
    
    for (let linha of linhas) {
        linha = linha.trim();
        if (!linha || linha.length < 10) continue;
        
        // Ignorar linhas de cabeçalho/rodapé
        const linhaLower = linha.toLowerCase();
        if (ignorar.some(ign => linhaLower.startsWith(ign))) continue;
        if (/^saldo/i.test(linha)) continue;
        
        let transacao = null;
        
        // Tentar cada padrão
        for (const padrao of padroes) {
            const match = padrao.exec(linha);
            if (match) {
                transacao = extrairTransacaoDeMatch(match, anoExtrato, mesExtrato);
                if (transacao) break;
            }
        }
        
        // Se não casou com padrão específico, tentar extração genérica
        if (!transacao) {
            transacao = extrairTransacaoGenerica(linha, anoExtrato, mesExtrato);
        }
        
        if (transacao && transacao.valor > 0) {
            // Categorizar
            const cat = autoCategorizar(transacao.descricao);
            transacao.categoria = cat.categoria;
            transacao.subcategoria = cat.subcategoria;
            
            // Verificar conta fixa vinculada
            const matchedBill = findMatchingFixedBill(transacao.descricao, transacao.categoria);
            if (matchedBill) {
                transacao.categoria = matchedBill.category;
                transacao.subcategoria = matchedBill.name;
                transacao.linkedBillId = matchedBill.id;
                transacao.linkedBillName = matchedBill.name;
            }
            
            transacoes.push(transacao);
        }
    }
    
    return transacoes;
}

function extrairTransacaoDeMatch(match, anoExtrato, mesExtrato) {
    try {
        let dia, mes, ano, descricao, valorStr;
        
        if (match.length === 5) {
            // Padrão DD/MM Desc Valor
            [, dia, mes, descricao, valorStr] = match;
            ano = anoExtrato;
        } else if (match.length === 6 && match[3] && match[3].length >= 2) {
            // Padrão DD/MM/AAAA Desc Valor
            [, dia, mes, ano, descricao, valorStr] = match;
            if (ano.length === 2) ano = '20' + ano;
        } else if (match.length === 7) {
            // Padrão tabular com débito/crédito
            [, dia, mes, ano, descricao, debitoStr, creditoStr] = match;
            if (!ano || ano.length === 0) ano = anoExtrato;
            else if (ano.length === 2) ano = '20' + ano;
            
            const debito = parseValorBR(debitoStr);
            const credito = parseValorBR(creditoStr);
            valorStr = debito > 0 ? `-${debitoStr}` : creditoStr;
        }
        
        const valor = parseValorBR(valorStr);
        if (!valor || valor <= 0) return null;
        
        // Determinar tipo - FGTS e outras entradas são Receita
        const descLower = descricao.toLowerCase();
        const isCredito = valorStr.trim().startsWith('+') || 
                         (!valorStr.includes('-') && /cr[ée]dito|entrada|dep[oó]sito|transfer[eê]ncia\s+recebida|fgts|saque|resgate/i.test(descricao));
        
        // FGTS é sempre receita
        const isFGTS = /fgts|saque.*fgts|cp\s*fgts/i.test(descricao);
        
        const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        return {
            data: data,
            descricao: limparDescricaoExtrato(descricao),
            valor: Math.abs(valor),
            tipo: (isCredito || isFGTS) ? 'Receita' : 'Despesa',
            fonte: 'Débito'
        };
    } catch (e) {
        return null;
    }
}

function extrairTransacaoGenerica(linha, anoExtrato, mesExtrato) {
    try {
        // Procurar data na linha
        const matchData = linha.match(/(\d{2})[\/\-](\d{2})(?:[\/\-](\d{2,4}))?/);
        if (!matchData) return null;
        
        // Procurar valor na linha
        const matchValor = linha.match(/(-?\s*\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/);
        if (!matchValor) return null;
        
        const [, dia, mes, ano] = matchData;
        const valorStr = matchValor[1];
        const valor = parseValorBR(valorStr);
        
        if (!valor || valor <= 0.01) return null;
        
        // Extrair descrição (tudo entre a data e o valor)
        let descricao = linha
            .replace(matchData[0], '')
            .replace(matchValor[0], '')
            .trim();
        
        if (!descricao || descricao.length < 3) return null;
        
        const anoFinal = ano ? (ano.length === 2 ? '20' + ano : ano) : anoExtrato;
        const data = `${anoFinal}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        const isCredito = valorStr.trim().startsWith('+');
        
        return {
            data: data,
            descricao: limparDescricaoExtrato(descricao),
            valor: Math.abs(valor),
            tipo: isCredito ? 'Receita' : 'Despesa',
            fonte: 'Débito'
        };
    } catch (e) {
        return null;
    }
}

function limparDescricaoExtrato(desc) {
    if (!desc) return 'Sem descrição';
    
    let limpa = desc
        .replace(/\s+/g, ' ')
        .replace(/[|;]/g, ' ')
        .replace(/^\d+\s*/, '') // Remover números no início
        .replace(/\s*\d+$/, '') // Remover números no final
        // Remover códigos CNPJ/CPF (sequências de 8+ dígitos)
        .replace(/\s+\d{8,}\s*/g, ' ')
        .replace(/\s+\d{4,}\s+\d{4,}/g, ' ') // Remover padrões tipo "0000 0000"
        .replace(/INTERNET BANKING PIX\s*/gi, 'PIX ') // Simplificar descrição PIX
        .replace(/CP FGTS CICLOS\s*/gi, 'Saque FGTS ') // Limpar descrição FGTS
        .replace(/\s+-\d+\s+/g, ' ') // Remover padrões tipo " -28 "
        .replace(/\s+\d{2}\/\d{2}\/\d{2,4}\s*/g, ' ') // Remover datas extras na descrição
        .trim();
    
    // Remover números no final novamente (após outras limpezas)
    limpa = limpa.replace(/\s+\d+$/, '').trim();
    
    // Limitar tamanho
    if (limpa.length > 60) {
        limpa = limpa.substring(0, 57) + '...';
    }
    
    return limpa || 'Transação';
}

async function processarExtratoBancario(texto, chatId, statusMsg, bot) {
    console.log('[DEBUG] Processando extrato bancário...');
    
    const transacoes = extrairTransacoesExtrato(texto);
    
    if (transacoes.length === 0) {
        return { sucesso: false, mensagem: 'Não consegui identificar transações no extrato.' };
    }
    
    // Remover duplicatas dentro do próprio extrato
    const seen = new Set();
    const transacoesUnicas = transacoes.filter(t => {
        const key = `${t.data}|${t.descricao}|${t.valor}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    // Atualizar status
    await bot.editMessageText(
        `📊 *Extrato detectado!*\n\n` +
        `Encontrei *${transacoesUnicas.length} transações* (${transacoes.length - transacoesUnicas.length} duplicadas removidas).\n` +
        `Verificando e salvando...`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );
    
    // Verificar transações existentes no banco para evitar duplicatas
    let existingTransactions = [];
    try {
        const snapshot = await db.collection('transacoes').get();
        existingTransactions = snapshot.docs.map(doc => {
            const d = doc.data();
            return `${d.data}|${d.descricao}|${d.valor}`;
        });
    } catch (e) {
        console.log('[WARN] Não foi possível verificar duplicatas existentes:', e.message);
    }
    const existingSet = new Set(existingTransactions);
    
    // Salvar apenas transações novas
    let salvos = 0;
    let pulados = 0;
    let erros = 0;
    let totalDespesas = 0;
    let totalReceitas = 0;
    const categorias = {};
    
    for (const t of transacoesUnicas) {
        // Verificar se já existe
        const key = `${t.data}|${t.descricao}|${t.valor}`;
        if (existingSet.has(key)) {
            pulados++;
            continue;
        }
        
        try {
            const result = await salvarRegistro({
                data: t.data,
                descricao: t.descricao,
                valor: t.valor,
                tipo: t.tipo,
                fonte: t.fonte,
                categoria: t.categoria,
                subcategoria: t.subcategoria,
                pagador: 'familia',
                linkedBillId: t.linkedBillId,
                linkedBillName: t.linkedBillName
            });
            
            salvos++;
            existingSet.add(key); // Adicionar ao set para evitar salvar duas vezes no mesmo batch
            
            if (t.tipo === 'Despesa') {
                totalDespesas += t.valor;
            } else {
                totalReceitas += t.valor;
            }
            
            // Contagem por categoria
            const catKey = t.categoria;
            categorias[catKey] = (categorias[catKey] || 0) + t.valor;
            
        } catch (err) {
            console.error('Erro ao salvar transação do extrato:', err);
            erros++;
        }
    }
    
    // Gerar resumo
    const resumo = gerarResumoExtrato(transacoesUnicas, salvos, erros, pulados, totalDespesas, totalReceitas, categorias);
    
    return { sucesso: true, mensagem: resumo, transacoes: salvos };
}

function gerarResumoExtrato(transacoes, salvos, erros, pulados, totalDespesas, totalReceitas, categorias) {
    // Top 5 categorias
    const topCategorias = Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, val]) => `  • ${cat}: R$ ${val.toFixed(2)}`)
        .join('\n');
    
    // Período do extrato
    const datas = transacoes.map(t => t.data).filter(d => d).sort();
    const dataInicio = datas[0] || '';
    const dataFim = datas[datas.length - 1] || '';
    
    let msg = `✅ *Extrato Processado!*\n\n`;
    if (dataInicio && dataFim) {
        msg += `📅 *Período:* ${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}\n`;
    }
    msg += `📝 *Transações:* ${salvos} novas salvas`;
    if (pulados > 0) msg += `, ${pulados} já existiam`;
    if (erros > 0) msg += `, ${erros} erros`;
    msg += `\n\n`;
    
    msg += `💰 *Resumo Financeiro:*\n`;
    msg += `  📈 Receitas: R$ ${totalReceitas.toFixed(2)}\n`;
    msg += `  📉 Despesas: R$ ${totalDespesas.toFixed(2)}\n`;
    msg += `  💵 Saldo: R$ ${(totalReceitas - totalDespesas).toFixed(2)}\n\n`;
    
    if (topCategorias) {
        msg += `📊 *Top Categorias (Despesas):*\n${topCategorias}\n\n`;
    }
    
    msg += `_Todas as transações foram categorizadas automaticamente e salvas no app!_`;
    
    return msg;
}

function formatarDataBR(data) {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ==================== EXTRAÇÃO DE DADOS (comprovante único) ====================

function extrairDados(texto) {
    const dados = {
        data: null,
        valor: null,
        descricao: '',
        tipo: 'Despesa',
        fonte: 'Débito',
        categoria: 'Outros',
        subcategoria: 'Outros'
    };

    const textoLimpo = texto.replace(/\s+/g, ' ').trim();
    const textoLower = textoLimpo.toLowerCase();

    // === DETECTAR SE É FATURA DE CARTÃO (não processar) ===
    if (textoLower.includes('fatura') && (textoLower.includes('cartão') || textoLower.includes('cartao') || textoLower.includes('nubank') || textoLower.includes('credit'))) {
        // Faturas de cartão listam várias transações - valor total não faz sentido como despesa única
        console.log('[DEBUG] Fatura de cartão detectada - ignorando');
        dados.valor = null;
        return dados;
    }

    // === EXTRAIR VALOR ===
    // Prioridade: "Valor pago" ou "Valor" seguido de R$ na mesma ou próxima linha
    const padroesValorPrioritario = [
        /(?:valor\s+pago|valor\s+cobrado|valor\s+transferido|valor\s+da\s+transfer)[\s\S]*?R\$\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/i,
        /(?:valor\s+pago|valor\s+cobrado)[:\s]*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/i,
        /(?:valor\s+pago)[\s\n]+R?\$?\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/i,
    ];

    for (const padrao of padroesValorPrioritario) {
        const match = padrao.exec(textoLimpo);
        if (match) {
            const val = parseValorBR(match[1]);
            if (val > 0 && val < 100000) {
                dados.valor = val;
                break;
            }
        }
    }

    if (!dados.valor) {
        const padroesValor = [
            /(?:valor|total|pagamento|transferência|transferencia|pix|cobran[cç]a)[:\s]*R?\$?\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/gi,
            /R\$\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/gi,
            /(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
        ];

        let valoresEncontrados = [];
        for (const padrao of padroesValor) {
            let match;
            while ((match = padrao.exec(textoLimpo)) !== null) {
                const val = parseValorBR(match[1]);
                if (val > 0 && val < 100000) {
                    valoresEncontrados.push(val);
                }
            }
            if (valoresEncontrados.length > 0) break;
        }

        if (valoresEncontrados.length > 0) {
            const padraoExato = /(?:valor|total)[:\s]*R?\$?\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/i;
            const matchExato = padraoExato.exec(textoLimpo);
            if (matchExato) {
                dados.valor = parseValorBR(matchExato[1]);
            } else {
                dados.valor = valoresEncontrados[0];
            }
        }
    }

    // === EXTRAIR DATA ===
    const padroesData = [
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{2}\/\d{2}\/\d{2})\b/,
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{2})\s+(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})/i
    ];

    for (const padrao of padroesData) {
        const match = padrao.exec(textoLimpo);
        if (match) {
            dados.data = formatarData(match[0]);
            break;
        }
    }

    if (!dados.data) {
        dados.data = new Date().toISOString().split('T')[0];
    }

    // === EXTRAIR DESCRIÇÃO (nome limpo do recebedor) ===
    const textoNormalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhasTexto = textoNormalizado.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Método 1: Procurar linha após "Para" ou "Beneficiário" no texto com newlines
    for (let i = 0; i < linhasTexto.length; i++) {
        const linha = linhasTexto[i];
        if (/^(para|destinat[aá]rio|benefici[aá]rio|favorecido|nome do benefici[aá]rio|razão social|razao social)$/i.test(linha) || 
            /^(para|destinat[aá]rio|benefici[aá]rio|favorecido|nome do benefici[aá]rio)\s*:/i.test(linha)) {
            // O nome está na próxima linha
            let nomeLinha = linha.includes(':') ? linha.replace(/^[^:]+:\s*/, '') : (linhasTexto[i + 1] || '');
            nomeLinha = nomeLinha.trim();
            if (nomeLinha && nomeLinha.length >= 3 && nomeLinha.length <= 60 &&
                !/^(cpf|cnpj|chave|instituição|ag\s|\d)/i.test(nomeLinha)) {
                dados.descricao = nomeLinha;
                break;
            }
        }
    }

    // Método 2: Regex no texto com newlines  
    if (!dados.descricao) {
        const padroesRecebedor = [
            /(?:para|destinat[aá]rio|benefici[aá]rio|favorecido|nome|razão social|razao social)\s*[:\n]\s*([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú .]+)/im,
        ];
        for (const padrao of padroesRecebedor) {
            const match = padrao.exec(textoNormalizado);
            if (match) {
                let nome = match[1].split('\n')[0].trim();
                if (nome.length >= 3 && nome.length <= 60) {
                    dados.descricao = nome;
                    break;
                }
            }
        }
    }

    // Método 3: Fallback com linhas do texto
    if (!dados.descricao) {
        for (const linha of linhasTexto) {
            if (linha.length >= 4 && linha.length < 60 &&
                !/^\d+[,./\d]*$/.test(linha) &&
                !/^(comprovante|data|hora|valor|total|r\$|pix|cpf|cnpj|chave|instituição|forma|identificação|informações|código|pagamento|ag\s|cc\s|\*{2,})/i.test(linha) &&
                !/^\d{2}\/\d{2}/.test(linha) &&
                /[a-zA-ZÀ-ú]{3,}/.test(linha)) {
                dados.descricao = linha;
                break;
            }
        }
    }

    if (!dados.descricao) {
        dados.descricao = 'Comprovante sem descrição';
    }

    // === DETECTAR FORMA DE PAGAMENTO ===
    if (textoLower.includes('pix') || textoLower.includes('chave') || textoLower.includes('qr code')) {
        dados.fonte = 'Pix';
    } else if (textoLower.includes('boleto') || textoLower.includes('código de barras') || textoLower.includes('codigo de barras')) {
        dados.fonte = 'Boleto';
    } else if (textoLower.includes('crédito') || textoLower.includes('credito') || textoLower.includes('credit card')) {
        dados.fonte = 'Crédito';
    } else if (textoLower.includes('débito') || textoLower.includes('debito')) {
        dados.fonte = 'Débito';
    }

    // === DETECTAR SE É RECEITA ===
    if (textoLower.includes('recebido') || textoLower.includes('recebimento') ||
        textoLower.includes('crédito em conta') || textoLower.includes('depósito') ||
        textoLower.includes('deposito') || textoLower.includes('transferência recebida')) {
        dados.tipo = 'Receita';
    }

    // === DETECTAR QUEM PAGOU ===
    dados.pagador = 'familia';
    const matchPagador = texto.match(/(?:pagador|de|remetente)[\s\S]*?(?:nome|de)\s*[:\n]\s*([^\n]+)/i);
    if (matchPagador) {
        const nomePagador = matchPagador[1].toLowerCase();
        if (nomePagador.includes('higor')) {
            dados.pagador = 'higor';
        } else if (nomePagador.includes('rafaella') || nomePagador.includes('rafaela')) {
            dados.pagador = 'rafa';
        }
    } else {
        if (textoLower.includes('higor')) dados.pagador = 'higor';
        else if (textoLower.includes('rafaella') || textoLower.includes('rafaela')) dados.pagador = 'rafa';
    }

    // === AUTO-CATEGORIZAR ===
    const categoriaDetectada = autoCategorizar(texto + ' ' + dados.descricao);
    dados.categoria = categoriaDetectada.categoria;
    dados.subcategoria = categoriaDetectada.subcategoria;

    return dados;
}

function parseValorBR(valorStr) {
    return parseFloat(valorStr.replace(/[\s.]/g, '').replace(',', '.'));
}

function formatarData(dataStr) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
        const [d, m, y] = dataStr.split('/');
        return `${y}-${m}-${d}`;
    }
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(dataStr)) {
        const [d, m, y] = dataStr.split('/');
        return `20${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        return dataStr;
    }
    const meses = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
        'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
        'agosto': '08', 'setembro': '09', 'outubro': '10',
        'novembro': '11', 'dezembro': '12'
    };
    const match = dataStr.match(/(\d{2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})/i);
    if (match) {
        const mes = meses[match[2].toLowerCase()];
        if (mes) return `${match[3]}-${mes}-${match[1]}`;
    }
    return new Date().toISOString().split('T')[0];
}

// ==================== PROCESSAMENTO DE ARQUIVOS ====================

async function processarImagem(filePath) {
    const processedPath = filePath.replace(/\.\w+$/, '_processed.png');
    await sharp(filePath)
        .grayscale()
        .normalize()
        .sharpen()
        .resize(2400, null, { withoutEnlargement: true })
        .png()
        .toFile(processedPath);

    const { data: { text } } = await Tesseract.recognize(processedPath, 'por');

    limparTemp(filePath, processedPath);
    return text;
}

async function processarPDF(filePath) {
    console.log('[DEBUG] Processando PDF:', filePath);
    const buffer = fs.readFileSync(filePath);
    const uint8 = new Uint8Array(buffer);
    console.log('[DEBUG] PDF tamanho:', uint8.length, 'bytes');
    const pdf = new PDFParse(uint8);
    await pdf.load();
    const result = await pdf.getText();
    const text = result.pages.map(p => p.text).join('\n');
    console.log('[DEBUG] PDF texto extraído:', text.substring(0, 300));
    limparTemp(filePath);
    return text;
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                fs.unlinkSync(dest);
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function limparTemp(...arquivos) {
    arquivos.forEach(arq => {
        try { if (fs.existsSync(arq)) fs.unlinkSync(arq); } catch (e) { }
    });
}

// ==================== SALVAR NO FIRESTORE + CSV ====================

function limparDescricao(desc) {
    if (!desc) return 'Sem descrição';
    let limpa = desc.replace(/\r?\n/g, ' ').replace(/,/g, ' -');
    // Remover CPF, CNPJ, chaves e tudo depois
    limpa = limpa.replace(/\s*(CPF|CNPJ|Chave|Instituição|Instituicao|Documento do|Ag\s+\d|Cc\s+\d).*/gi, '').trim();
    // Remover asteriscos de mascaramento
    limpa = limpa.replace(/\*{2,}[^\s]*/g, '').trim();
    // Remover números de documento soltos
    limpa = limpa.replace(/\s+\d{2,}\.\d{3}\.\d{3}[\/-]\d+/g, '').trim();
    // Limitar tamanho
    limpa = limpa.substring(0, 50).trim();
    return limpa || 'Sem descrição';
}

async function salvarRegistro(dados) {
    const descLimpa = limparDescricao(dados.descricao);

    // Verificar se corresponde a alguma conta fixa
    const matchedBill = findMatchingFixedBill(dados.descricao, dados.categoria);

    const transaction = {
        data: dados.data,
        tipo: dados.tipo || 'Despesa',
        categoria: matchedBill ? matchedBill.category : (dados.categoria || 'Outros'),
        subcategoria: matchedBill ? matchedBill.name : (dados.subcategoria || 'Outros'),
        descricao: descLimpa,
        valor: parseFloat((dados.valor || 0).toFixed(2)),
        fonte: dados.fonte || 'Débito',
        pagador: matchedBill?.responsible || dados.pagador || 'familia',
        status: 'Pago',
        createdAt: serverTimestamp(),
        createdBy: 'bot-telegram'
    };

    // Se encontrou conta fixa, vincular
    if (matchedBill) {
        transaction.linkedBillId = matchedBill.id;
        transaction.linkedBillName = matchedBill.name;
    }

    try {
        await addDoc(collection(db, 'transactions'), transaction);
        const linkedMsg = matchedBill ? ` [🔗 ${matchedBill.name}]` : '';
        console.log(`✅ Firestore: ${descLimpa} - R$ ${transaction.valor}${linkedMsg}`);
    } catch (err) {
        console.error('❌ Erro Firestore:', err.message);
    }

    // Backup local no CSV
    const linha = [dados.data, transaction.tipo, transaction.categoria, transaction.subcategoria, descLimpa, transaction.valor.toFixed(2), transaction.fonte, 'Pago'].join(',');
    try { fs.appendFileSync(CSV_FILE, '\n' + linha, 'utf-8'); } catch (e) { }

    return { linha, linkedBill: matchedBill };
}

// ==================== HANDLERS DO BOT ====================

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🏦 *Controle Financeiro - Bot Autônomo*\n\n` +
        `Envie comprovantes e eu registro *automaticamente*!\n\n` +
        `📸 *Aceito:*\n` +
        `• Fotos de comprovantes\n` +
        `• Screenshots de Pix/transferências\n` +
        `• PDFs de boletos/recibos\n` +
        `• Documentos de comprovantes\n` +
        `• 📊 *Extratos bancários completos!*\n\n` +
        `_Extratos são detectados automaticamente e todas as transações são salvas!_\n\n` +
        `*Comandos:*\n` +
        `/ultimos - Ver últimos registros\n` +
        `/resumo - Resumo do mês\n` +
        `/manual - Registrar manualmente\n` +
        `/ajuda - Mais informações`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/ultimos/, async (msg) => {
    try {
        const { getDocs, query, orderBy, limit } = require('firebase/firestore');
        const q = query(collection(db, 'transactions'), orderBy('data', 'desc'), limit(7));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            bot.sendMessage(msg.chat.id, '📋 Nenhum registro encontrado.');
            return;
        }

        let texto = '📋 *Últimos registros:*\n\n';
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            const emoji = d.tipo === 'Receita' ? '🟢' : '🔴';
            const pagador = d.pagador === 'higor' ? '👤H' : d.pagador === 'rafa' ? '👤R' : '👥';
            texto += `${emoji} *${escapeMarkdown(d.descricao || 'Sem desc')}*\n   📅 ${escapeMarkdown(d.data)} | 💰 R$ ${parseFloat(d.valor).toFixed(2)} | ${pagador}\n\n`;
        });

        bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('Erro /ultimos:', err.message);
        bot.sendMessage(msg.chat.id, '❌ Erro ao ler registros.');
    }
});

bot.onText(/\/resumo/, async (msg) => {
    try {
        const { getDocs, query, where, orderBy } = require('firebase/firestore');
        const mesAtual = new Date().toISOString().slice(0, 7);
        const mesFim = mesAtual + '\uf8ff';

        const snapshot = await getDocs(query(collection(db, 'transactions')));
        const doMes = snapshot.docs.map(d => d.data()).filter(d => d.data && d.data.startsWith(mesAtual));

        let totalDespesas = 0;
        let totalReceitas = 0;
        const porCategoria = {};
        let gastoHigor = 0, gastoRafa = 0;

        doMes.forEach(d => {
            const valor = parseFloat(d.valor) || 0;
            if (d.tipo === 'Receita') totalReceitas += valor;
            else {
                totalDespesas += valor;
                porCategoria[d.categoria || 'Outros'] = (porCategoria[d.categoria || 'Outros'] || 0) + valor;
                if (d.pagador === 'higor') gastoHigor += valor;
                else if (d.pagador === 'rafa') gastoRafa += valor;
            }
        });

        const saldo = totalReceitas - totalDespesas;
        const topCats = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5);

        let texto = `📊 *Resumo do Mês \\(${escapeMarkdown(mesAtual)}\\)*\n\n`;
        texto += `🟢 Receitas: R$ ${totalReceitas.toFixed(2)}\n`;
        texto += `🔴 Despesas: R$ ${totalDespesas.toFixed(2)}\n`;
        texto += `${saldo >= 0 ? '🟢' : '🔴'} Saldo: R$ ${saldo.toFixed(2)}\n`;
        texto += `📝 Transações: ${doMes.length}\n\n`;

        if (gastoHigor > 0 || gastoRafa > 0) {
            texto += `*Gastos por pessoa:*\n`;
            if (gastoHigor > 0) texto += `👤 Higor: R$ ${gastoHigor.toFixed(2)}\n`;
            if (gastoRafa > 0) texto += `👤 Rafaella: R$ ${gastoRafa.toFixed(2)}\n`;
            texto += `\n`;
        }

        if (topCats.length > 0) {
            texto += `*Top categorias:*\n`;
            topCats.forEach(([cat, val]) => {
                texto += `  📁 ${escapeMarkdown(cat)}: R$ ${val.toFixed(2)}\n`;
            });
        }

        bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('Erro /resumo:', err.message);
        bot.sendMessage(msg.chat.id, '❌ Erro ao gerar resumo.');
    }
});

bot.onText(/\/manual/, (msg) => {
    bot.sendMessage(msg.chat.id,
        '✏️ *Registro Manual*\n\n' +
        'Envie no formato:\n' +
        '`valor | descrição`\n\n' +
        'Exemplos:\n' +
        '`150.00 | Conta de luz`\n' +
        '`89.90 | Internet Grajaúnet`\n' +
        '`1068.58 | Parcela Caixa`',
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/ajuda/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📖 *Como funciona:*\n\n` +
        `1️⃣ Receba comprovante no WhatsApp\n` +
        `2️⃣ Encaminhe pra cá (foto, print ou PDF)\n` +
        `3️⃣ Bot extrai valor, data e descrição\n` +
        `4️⃣ Categoriza automaticamente\n` +
        `5️⃣ Salva no controle - pronto! ✅\n\n` +
        `*Tipos aceitos:*\n` +
        `📸 Fotos e screenshots\n` +
        `📄 PDFs de boleto/recibo\n` +
        `📎 Imagens enviadas como documento\n\n` +
        `*Dica:* Screenshots funcionam melhor que fotos da tela!\n\n` +
        `*Se o bot não detectar o valor:*\n` +
        `Use /manual → \`valor | descrição\``,
        { parse_mode: 'Markdown' }
    );
});

// ==================== RECEBER FOTOS ====================

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const statusMsg = await bot.sendMessage(chatId, '⏳ Analisando imagem...');

    try {
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

        const imagePath = path.join(TEMP_DIR, `${chatId}_${Date.now()}.jpg`);
        await downloadFile(fileUrl, imagePath);

        const texto = await processarImagem(imagePath);
        
        // Verificar se é extrato bancário
        if (detectarExtratoBancario(texto)) {
            const resultado = await processarExtratoBancario(texto, chatId, statusMsg, bot);
            await bot.editMessageText(resultado.mensagem,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
            return;
        }
        
        // Processamento normal de comprovante único
        const dados = extrairDados(texto);

        if (!dados.valor) {
            await bot.editMessageText(
                `⚠️ *Não consegui extrair o valor.*\n\n` +
                `Texto detectado:\n\`\`\`\n${texto.substring(0, 400)}\n\`\`\`\n\n` +
                `Use /manual → \`valor | descrição\``,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
            return;
        }

        const result = await salvarRegistro(dados);
        await bot.editMessageText(formatarConfirmacao(dados, result.linkedBill),
            { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
        );

    } catch (err) {
        console.error('Erro foto:', err.message);
        await bot.editMessageText('❌ Erro ao processar imagem. Tente novamente.',
            { chat_id: chatId, message_id: statusMsg.message_id }
        );
    }
});

// ==================== RECEBER DOCUMENTOS ====================

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;
    const mime = doc.mime_type || '';
    const fileName = doc.file_name || '';

    const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png|bmp|tiff|webp)$/i.test(fileName);
    const isPDF = mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPDF) {
        bot.sendMessage(chatId,
            '⚠️ Formato não suportado. Envie como *foto*, *PDF* ou *imagem*.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const statusMsg = await bot.sendMessage(chatId, `⏳ Processando ${isPDF ? 'PDF' : 'documento'}...`);

    try {
        const file = await bot.getFile(doc.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        const ext = isPDF ? '.pdf' : '.png';
        const filePath = path.join(TEMP_DIR, `${chatId}_${Date.now()}${ext}`);

        await downloadFile(fileUrl, filePath);

        let texto;
        if (isPDF) {
            texto = await processarPDF(filePath);
        } else {
            texto = await processarImagem(filePath);
        }

        // Verificar se é extrato bancário
        if (detectarExtratoBancario(texto)) {
            const resultado = await processarExtratoBancario(texto, chatId, statusMsg, bot);
            await bot.editMessageText(resultado.mensagem,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
            return;
        }

        // Processamento normal de comprovante único
        const dados = extrairDados(texto);

        if (!dados.valor) {
            await bot.editMessageText(
                `⚠️ *Não consegui extrair o valor deste ${isPDF ? 'PDF' : 'documento'}.*\n\n` +
                `Texto detectado:\n\`\`\`\n${texto.substring(0, 400)}\n\`\`\`\n\n` +
                `Use /manual → \`valor | descrição\``,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
            return;
        }

        const result = await salvarRegistro(dados);
        await bot.editMessageText(formatarConfirmacao(dados, result.linkedBill),
            { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
        );

    } catch (err) {
        console.error('Erro documento:', err.message);
        console.error('[DEBUG] Stack:', err.stack);
        await bot.editMessageText('❌ Erro ao processar documento. Tente novamente.',
            { chat_id: chatId, message_id: statusMsg.message_id }
        );
    }
});

// ==================== REGISTRO MANUAL POR TEXTO ====================

bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/') || msg.photo || msg.document) return;

    const chatId = msg.chat.id;
    const texto = msg.text.trim();

    // Formato: valor | descrição
    const match = texto.match(/^([\d.,]+)\s*\|\s*(.+)$/);
    if (match) {
        const valor = parseFloat(match[1].replace(',', '.'));
        const descricao = match[2].trim();

        if (isNaN(valor) || valor <= 0) {
            bot.sendMessage(chatId, '⚠️ Valor inválido. Use: `150.00 | Descrição`', { parse_mode: 'Markdown' });
            return;
        }

        const categoriaDetectada = autoCategorizar(descricao);

        const dados = {
            data: new Date().toISOString().split('T')[0],
            valor: valor,
            descricao: descricao.replace(/,/g, ' -').substring(0, 60),
            tipo: 'Despesa',
            fonte: 'Débito',
            categoria: categoriaDetectada.categoria,
            subcategoria: categoriaDetectada.subcategoria
        };

        const result = await salvarRegistro(dados);
        bot.sendMessage(chatId, formatarConfirmacao(dados, result.linkedBill), { parse_mode: 'Markdown' });
    }
});

// ==================== FORMATAÇÃO ====================

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/([*_`\[\]()~>#+\-=|{}.!])/g, '\\$1');
}

function formatarConfirmacao(dados, linkedBill = null) {
    let msg = `✅ *Registrado automaticamente!*\n\n` +
        `💰 *Valor:* R$ ${dados.valor.toFixed(2)}\n` +
        `📅 *Data:* ${escapeMarkdown(dados.data)}\n` +
        `📝 *Descrição:* ${escapeMarkdown(dados.descricao)}\n` +
        `📁 *Categoria:* ${escapeMarkdown(dados.categoria)} > ${escapeMarkdown(dados.subcategoria)}\n` +
        `💳 *Pagamento:* ${escapeMarkdown(dados.fonte)}\n` +
        `👤 *Pagador:* ${dados.pagador === 'higor' ? 'Higor' : dados.pagador === 'rafa' ? 'Rafaella' : 'Família'}\n` +
        `📊 *Tipo:* ${escapeMarkdown(dados.tipo)}`;
    
    if (linkedBill) {
        msg += `\n\n🔗 *Conta vinculada:* ${escapeMarkdown(linkedBill.name)}`;
    }
    
    return msg;
}

// ==================== INICIALIZAÇÃO ====================

// ==================== HEALTH CHECK SERVER ====================

// PORT é usado por plataformas cloud (Railway, Render, etc)
const HEALTH_PORT = process.env.PORT || process.env.HEALTH_PORT || 3000;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Seu chat ID para receber notificações

let botStats = {
    startTime: new Date(),
    lastActivity: null,
    messagesProcessed: 0,
    errorsCount: 0,
    isHealthy: true
};

// Servidor HTTP para health check (monitoramento externo)
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        const uptime = Math.floor((Date.now() - botStats.startTime.getTime()) / 1000);
        const status = {
            status: botStats.isHealthy ? 'ok' : 'unhealthy',
            uptime: uptime,
            uptimeFormatted: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${uptime%60}s`,
            startTime: botStats.startTime.toISOString(),
            lastActivity: botStats.lastActivity ? botStats.lastActivity.toISOString() : null,
            messagesProcessed: botStats.messagesProcessed,
            errorsCount: botStats.errorsCount,
            timestamp: new Date().toISOString()
        };
        
        res.writeHead(botStats.isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

healthServer.listen(HEALTH_PORT, () => {
    console.log(`🏥 Health check ativo em http://localhost:${HEALTH_PORT}/health`);
});

// Atualizar estatísticas a cada mensagem processada
function updateStats(success = true) {
    botStats.lastActivity = new Date();
    botStats.messagesProcessed++;
    if (!success) botStats.errorsCount++;
}

// Notificar admin via Telegram quando bot inicia/para
async function notifyAdmin(message) {
    if (ADMIN_CHAT_ID) {
        try {
            await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Falha ao notificar admin:', err.message);
        }
    }
}

// ==================== INICIALIZAÇÃO ====================

console.log('');
console.log('╔═══════════════════════════════════════════════╗');
console.log('║  🤖 Bot Controle Financeiro - Modo Autônomo   ║');
console.log('║                                               ║');
console.log('║  📸 Fotos    ✅ Suportado                     ║');
console.log('║  📄 PDFs     ✅ Suportado                     ║');
console.log('║  📎 Docs     ✅ Suportado                     ║');
console.log('║  🏷️  Auto-Cat ✅ Ativo                        ║');
console.log('║  🏥 Health   ✅ Porta ' + HEALTH_PORT + '                      ║');
console.log('║                                               ║');
console.log('║  Ctrl+C para encerrar                         ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');

// Notificar que o bot iniciou
setTimeout(() => {
    notifyAdmin('✅ *Bot Iniciado*\n\n🕐 ' + new Date().toLocaleString('pt-BR') + '\n🏥 Health check ativo');
}, 2000);

process.on('SIGINT', async () => {
    console.log('\n🛑 Bot encerrado.');
    await notifyAdmin('🛑 *Bot Encerrado*\n\n🕐 ' + new Date().toLocaleString('pt-BR'));
    bot.stopPolling();
    healthServer.close();
    process.exit(0);
});

// Capturar erros não tratados
process.on('uncaughtException', async (err) => {
    console.error('❌ Erro crítico:', err);
    botStats.isHealthy = false;
    botStats.errorsCount++;
    await notifyAdmin('❌ *Erro Crítico no Bot*\n\n```\n' + err.message + '\n```');
});

process.on('unhandledRejection', async (reason) => {
    console.error('❌ Promise rejeitada:', reason);
    botStats.errorsCount++;
    await notifyAdmin('⚠️ *Erro no Bot*\n\n```\n' + String(reason) + '\n```');
});
