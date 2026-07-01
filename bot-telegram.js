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
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ==================== AUTO-CATEGORIZAÇÃO ====================

const REGRAS_CATEGORIA = [
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

// ==================== EXTRAÇÃO DE DADOS ====================

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

    const transaction = {
        data: dados.data,
        tipo: dados.tipo || 'Despesa',
        categoria: dados.categoria || 'Outros',
        subcategoria: dados.subcategoria || 'Outros',
        descricao: descLimpa,
        valor: parseFloat((dados.valor || 0).toFixed(2)),
        fonte: dados.fonte || 'Débito',
        pagador: dados.pagador || 'familia',
        status: 'Pago',
        createdAt: serverTimestamp(),
        createdBy: 'bot-telegram'
    };

    try {
        await addDoc(collection(db, 'transactions'), transaction);
        console.log(`✅ Firestore: ${descLimpa} - R$ ${transaction.valor}`);
    } catch (err) {
        console.error('❌ Erro Firestore:', err.message);
    }

    // Backup local no CSV
    const linha = [dados.data, transaction.tipo, transaction.categoria, transaction.subcategoria, descLimpa, transaction.valor.toFixed(2), transaction.fonte, 'Pago'].join(',');
    try { fs.appendFileSync(CSV_FILE, '\n' + linha, 'utf-8'); } catch (e) { }

    return linha;
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
        `• Documentos de comprovantes\n\n` +
        `Tudo é processado e salvo sem precisar de confirmação.\n\n` +
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
    const statusMsg = await bot.sendMessage(chatId, '⏳ Analisando comprovante...');

    try {
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

        const imagePath = path.join(TEMP_DIR, `${chatId}_${Date.now()}.jpg`);
        await downloadFile(fileUrl, imagePath);

        const texto = await processarImagem(imagePath);
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

        await salvarRegistro(dados);
        await bot.editMessageText(formatarConfirmacao(dados),
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

        await salvarRegistro(dados);
        await bot.editMessageText(formatarConfirmacao(dados),
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

        await salvarRegistro(dados);
        bot.sendMessage(chatId, formatarConfirmacao(dados), { parse_mode: 'Markdown' });
    }
});

// ==================== FORMATAÇÃO ====================

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/([*_`\[\]()~>#+\-=|{}.!])/g, '\\$1');
}

function formatarConfirmacao(dados) {
    return `✅ *Registrado automaticamente!*\n\n` +
        `💰 *Valor:* R$ ${dados.valor.toFixed(2)}\n` +
        `📅 *Data:* ${escapeMarkdown(dados.data)}\n` +
        `📝 *Descrição:* ${escapeMarkdown(dados.descricao)}\n` +
        `📁 *Categoria:* ${escapeMarkdown(dados.categoria)} > ${escapeMarkdown(dados.subcategoria)}\n` +
        `💳 *Pagamento:* ${escapeMarkdown(dados.fonte)}\n` +
        `� *Pagador:* ${dados.pagador === 'higor' ? 'Higor' : dados.pagador === 'rafa' ? 'Rafaella' : 'Família'}\n` +
        `�📊 *Tipo:* ${escapeMarkdown(dados.tipo)}`;
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
console.log('║                                               ║');
console.log('║  Ctrl+C para encerrar                         ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');

process.on('SIGINT', () => {
    console.log('\n🛑 Bot encerrado.');
    bot.stopPolling();
    process.exit(0);
});
