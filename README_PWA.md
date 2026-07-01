# 📱 PWA - Controle Financeiro

## 🎯 Sobre o App

Progressive Web App (PWA) privado para controle financeiro pessoal de Higor e Rafa.

### ✨ Funcionalidades

- ✅ **Login seguro** com usuários Higor e Rafa
- ✅ **Funciona offline** (dados salvos localmente)
- ✅ **Instalável** no celular e desktop
- ✅ **Dashboard** com resumo financeiro
- ✅ **Gráficos** interativos de despesas
- ✅ **Adicionar transações** facilmente
- ✅ **Filtros** por tipo, mês e categoria
- ✅ **Relatórios** mensais completos
- ✅ **Exportar** dados em CSV
- ✅ **Responsivo** - funciona em qualquer dispositivo

---

## 🚀 Como Usar

### Opção 1: Abrir Diretamente (Localmente)

1. Abra o arquivo `index.html` diretamente no navegador
2. Use as credenciais:
   - **Usuário:** Higor ou Rafa
   - **Senha:** 1234

⚠️ **Importante:** Para funcionar offline completamente, você precisa rodar via servidor (Opção 2).

### Opção 2: Via Servidor Local (Recomendado)

#### Método Automático (Mais Fácil):

**Primeira vez (instalar):**
- Dê duplo clique em: `1-INSTALAR.bat`

**Sempre que quiser usar:**
- Dê duplo clique em: `2-RODAR_SERVIDOR.bat`
- Acesse: `http://localhost:8000`

#### Método Manual (via PowerShell):

**Instalar uma única vez:**
```powershell
pip install http-server
```

**Depois, para rodar:**
```powershell
cd "C:\Users\higor\Desktop\controle financeiro"
p
```

Depois acesse: `http://localhost:8000`

---

## 📲 Como Instalar no Celular

### Android (Chrome):

1. Abra o PWA no Chrome
2. Toque no menu (⋮) → **"Adicionar à tela inicial"**
3. Confirme a instalação
4. O ícone aparecerá na tela inicial

### iPhone (Safari):

1. Abra o PWA no Safari
2. Toque no botão de compartilhar (⬆️)
3. Role para baixo e toque em **"Adicionar à Tela Inicial"**
4. Confirme

### Desktop (Chrome, Edge, etc):

1. Abra o PWA no navegador
2. Clique no ícone de instalação (➕) na barra de endereço
3. Ou vá em Menu → **"Instalar Controle Financeiro"**

---

## 🔐 Segurança e Privacidade

### Dados 100% Locais

- **Nenhum servidor externo** - tudo fica no seu dispositivo
- **Sem internet necessária** - funciona totalmente offline
- **Sem rastreamento** - zero analytics ou cookies de terceiros
- **Privacidade total** - só você e Rafa têm acesso

### Senha Padrão

- **Usuário:** higor / **Senha:** 1234
- **Usuário:** rafa / **Senha:** 1234

**🔒 Alterar Senha (Avançado):**

1. Abra o console do navegador (F12)
2. Digite:

```javascript
let users = JSON.parse(localStorage.getItem('financeiro_users'));
users.higor.password = 'NOVA_SENHA_AQUI';
users.rafa.password = 'NOVA_SENHA_AQUI';
localStorage.setItem('financeiro_users', JSON.stringify(users));
```

---

## 📊 Como Funciona

### Estrutura de Dados

Todos os dados são salvos no **localStorage** do navegador:

- `financeiro_users` - Credenciais de login
- `financeiro_data` - Todas as transações

### Backup Manual

Para fazer backup dos seus dados:

1. Vá na aba **Relatórios**
2. Clique em **"📥 Exportar CSV"**
3. Salve o arquivo em local seguro

### Restaurar Dados

Se você reinstalar o navegador ou limpar o cache:

1. Importe o CSV no Power BI (você tem os arquivos)
2. Ou adicione manualmente as transações novamente

---

## 🎨 Personalização

### Alterar Cores

Edite o arquivo `styles.css`, seção `:root`:

```css
:root {
    --primary: #007BFF;    /* Cor principal */
    --success: #28A745;    /* Verde (receitas) */
    --danger: #DC3545;     /* Vermelho (despesas) */
}
```

### Adicionar Categorias

Edite o arquivo `index.html`, procure por `<select id="categoria">` e adicione:

```html
<option value="NomeCategoria">Nome da Categoria</option>
```

---

## 🔄 Sincronização Entre Dispositivos

⚠️ **Não há sincronização automática** - cada dispositivo tem seus próprios dados.

**Solução Manual:**

1. No dispositivo 1: Exporte CSV
2. Compartilhe o CSV (WhatsApp, email, etc)
3. No dispositivo 2: Adicione as transações manualmente

**Solução Futura (Avançado):**
- Configurar Google Firebase (grátis)
- Sincronização automática na nuvem
- Requer modificação do código

---

## 📱 Funcionalidades Detalhadas

### 1️⃣ Dashboard

- **Resumo do mês atual:** Receitas, Despesas, Saldo
- **Gráfico de pizza:** Distribuição por categoria
- **Últimas transações:** 5 mais recentes

### 2️⃣ Transações

- **Lista completa** de todas as transações
- **Filtros:**
  - Por tipo (Receita/Despesa)
  - Por mês
  - Por categoria
- **Ordenação:** Mais recentes primeiro

### 3️⃣ Adicionar

Formulário completo:
- Tipo (Receita ou Despesa)
- Data
- Categoria
- Descrição
- Valor
- Forma de pagamento

### 4️⃣ Relatórios

- Selecione o mês
- Veja totais e taxa de economia
- Gráfico de barras por categoria
- Detalhamento completo
- Exportar para CSV

---

## 🛠️ Solução de Problemas

### O app não funciona offline

- Certifique-se de acessar via HTTPS ou localhost
- Service Workers não funcionam com file://
- Use um servidor local (veja Opção 2)

### Perdi todos os dados

- Dados estão no localStorage do navegador
- Se limpou o cache, foram apagados
- **Solução:** Sempre exporte backups em CSV

### Não consigo instalar no celular

- Precisa estar rodando em HTTPS ou localhost
- Alguns navegadores não suportam PWA
- Use Chrome (Android) ou Safari (iOS)

### Gráficos não aparecem

- Verifique se tem conexão internet (Chart.js é carregado via CDN)
- Ou baixe o Chart.js localmente

---

## 📦 Arquivos do Projeto

```
controle financeiro/
├── index.html              # Página principal
├── styles.css              # Estilos do app
├── app.js                  # Lógica do aplicativo
├── service-worker.js       # Funcionalidade offline
├── manifest.json           # Configuração do PWA
├── icon-192.png            # Ícone 192x192 (criar)
├── icon-512.png            # Ícone 512x512 (criar)
└── README_PWA.md           # Este arquivo
```

---

## 🎯 Próximos Passos Sugeridos

### Curto Prazo

1. ✅ Criar ícones personalizados (192x192 e 512x512)
2. ✅ Importar transações do CSV original
3. ✅ Começar a usar diariamente

### Médio Prazo

1. 📊 Analisar padrões de gastos
2. 🎯 Definir metas mensais
3. 📈 Acompanhar evolução mês a mês

### Longo Prazo

1. ☁️ Configurar sincronização na nuvem (Firebase)
2. 🔔 Adicionar notificações de vencimento
3. 📸 Upload de comprovantes/notas fiscais
4. 🤖 Categorização automática com IA

---

## 🆘 Suporte

Para dúvidas ou problemas:

1. Consulte este README
2. Verifique o console do navegador (F12) para erros
3. Limpe o cache e tente novamente
4. Como último recurso, apague `localStorage` e recomece

---

## 📄 Licença

Este projeto é de uso **privado** exclusivo para Higor e Rafa.
Não redistribuir ou compartilhar publicamente.

---

## 🎉 Dicas de Uso

1. **Registre diariamente** - não deixe acumular
2. **Seja específico** nas descrições
3. **Use categorias consistentes**
4. **Exporte backup mensalmente**
5. **Revise relatórios toda semana**
6. **Defina metas realistas**
7. **Celebre economias!** 🎊

---

**Desenvolvido com ❤️ para uma vida financeira mais organizada!**
