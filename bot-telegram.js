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
const pdfParse = require('pdf-parse');
const admin = require('firebase-admin');

// ==================== FIREBASE ADMIN ====================

admin.initializeApp({
    projectId: 'controle-financeiro-593ea'
});

const db = admin.firestore();

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
    { palavras: ['grajaúnet', 'grajanet', 'internet', 'fibra', 'banda larga', 'net ', 'netflix', 'globoplay', 'disney', 'hbo', 'spotify', 'amazon prime', 'streaming'], categoria: 'Internet/TV', subcategoria: 'Internet' },

    // Educação
    { palavras: ['estácio', 'estacio', 'faculdade', 'universidade', 'unip', 'anhanguera', 'mensalidade'], categoria: 'Educação', subcategoria: 'Faculdade' },
    { palavras: ['senac', 'senai', 'curso', 'escola', 'udemy', 'alura'], categoria: 'Educação', subcategoria: 'Curso' },

    // Transporte
    { palavras: ['combustível', 'combustivel', 'gasolina', 'etanol', 'posto', 'shell', 'ipiranga', 'br distribuidora'], categoria: 'Transporte', subcategoria: 'Combustível' },
    { palavras: ['uber', '99', '99pop', 'cabify', 'indrive'], categoria: 'Transporte', subcategoria: 'Uber' },
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
                return { categoria: regra.categoria, subcategoria: regra.subcategoria };
            }
        }
    }

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

    // === EXTRAIR VALOR ===
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
            if (val > 0 && val < 1000000) {
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
            dados.valor = Math.max(...valoresEncontrados);
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

    // === EXTRAIR DESCRIÇÃO ===
    const padroesDesc = [
        /(?:destinat[aá]rio|benefici[aá]rio|para|favorecido|nome|razão social|razao social)[:\s]*([^\n]{3,60})/i,
        /(?:descri[çc][aã]o|motivo|mensagem|hist[oó]rico)[:\s]*([^\n]{3,60})/i,
        /(?:pagamento|transfer[eê]ncia|pix)\s+(?:para|de|enviado)\s+([^\n]{3,60})/i,
        /(?:empresa|estabelecimento|loja)[:\s]*([^\n]{3,60})/i,
    ];

    for (const padrao of padroesDesc) {
        const match = padrao.exec(textoLimpo);
        if (match) {
            dados.descricao = match[1].trim()
                .replace(/[,\n\r]/g, ' ')
                .substring(0, 60);
            break;
        }
    }

    if (!dados.descricao) {
        const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 60);
        for (const linha of linhas) {
            if (!/^\d+[,./\d]*$/.test(linha) && !/^(data|hora|valor|total|r\$|pix|cpf|cnpj)/i.test(linha)) {
                dados.descricao = linha.replace(/[,]/g, ' ').substring(0, 60);
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
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    limparTemp(filePath);
    return data.text;
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

async function salvarRegistro(dados) {
    const descLimpa = (dados.descricao || 'Sem descrição').replace(/,/g, ' -').replace(/\n/g, ' ');

    const transaction = {
        data: dados.data,
        tipo: dados.tipo || 'Despesa',
        categoria: dados.categoria || 'Outros',
        subcategoria: dados.subcategoria || 'Outros',
        descricao: descLimpa,
        valor: parseFloat((dados.valor || 0).toFixed(2)),
        fonte: dados.fonte || 'Débito',
        status: 'Pago',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'bot-telegram'
    };

    try {
        await db.collection('transactions').add(transaction);
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

bot.onText(/\/ultimos/, (msg) => {
    try {
        const csv = fs.readFileSync(CSV_FILE, 'utf-8');
        const linhas = csv.trim().split('\n');
        const ultimas = linhas.slice(-7);

        let texto = '📋 *Últimos registros:*\n\n';
        ultimas.forEach((linha) => {
            const cols = linha.split(',');
            if (cols.length >= 6) {
                const [data, tipo, cat, , desc, valor] = cols;
                const emoji = tipo === 'Receita' ? '🟢' : '🔴';
                texto += `${emoji} *${desc}*\n   📅 ${data} | 💰 R$ ${valor} | 📁 ${cat}\n\n`;
            }
        });

        bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
    } catch (err) {
        bot.sendMessage(msg.chat.id, '❌ Erro ao ler registros.');
    }
});

bot.onText(/\/resumo/, (msg) => {
    try {
        const csv = fs.readFileSync(CSV_FILE, 'utf-8');
        const linhas = csv.trim().split('\n').slice(1);

        const mesAtual = new Date().toISOString().slice(0, 7);
        let totalDespesas = 0;
        let totalReceitas = 0;
        let count = 0;

        linhas.forEach(linha => {
            const cols = linha.split(',');
            if (cols.length >= 6 && cols[0].startsWith(mesAtual)) {
                const valor = parseFloat(cols[5]) || 0;
                if (cols[1] === 'Receita') totalReceitas += valor;
                else totalDespesas += valor;
                count++;
            }
        });

        const saldo = totalReceitas - totalDespesas;
        const emoji = saldo >= 0 ? '🟢' : '🔴';

        bot.sendMessage(msg.chat.id,
            `📊 *Resumo do Mês (${mesAtual})*\n\n` +
            `🟢 Receitas: R$ ${totalReceitas.toFixed(2)}\n` +
            `🔴 Despesas: R$ ${totalDespesas.toFixed(2)}\n` +
            `${emoji} Saldo: R$ ${saldo.toFixed(2)}\n\n` +
            `📝 Total de registros: ${count}`,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
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

function formatarConfirmacao(dados) {
    return `✅ *Registrado automaticamente!*\n\n` +
        `💰 *Valor:* R$ ${dados.valor.toFixed(2)}\n` +
        `📅 *Data:* ${dados.data}\n` +
        `📝 *Descrição:* ${dados.descricao}\n` +
        `📁 *Categoria:* ${dados.categoria} > ${dados.subcategoria}\n` +
        `💳 *Pagamento:* ${dados.fonte}\n` +
        `📊 *Tipo:* ${dados.tipo}`;
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
