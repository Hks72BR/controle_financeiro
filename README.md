# 💰 Controle Financeiro - PWA

![License](https://img.shields.io/badge/license-Private-red)
![Status](https://img.shields.io/badge/status-Active-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

Progressive Web App (PWA) completo para controle financeiro pessoal. Instalável, funciona offline e 100% privado.

## 🚀 Demo

**[Acesse o App](https://seu-dominio.vercel.app)**

## ✨ Funcionalidades

- 📊 **Dashboard Interativo** - Visualize receitas, despesas e saldo em tempo real
- 💳 **Registro de Transações** - Adicione receitas e despesas facilmente
- 📈 **Gráficos Dinâmicos** - Análise visual por categoria com Chart.js
- 🔍 **Filtros Avançados** - Filtre por tipo, mês e categoria
- 📱 **PWA Instalável** - Instale como app nativo no celular/desktop
- 🔒 **100% Privado** - Dados armazenados localmente no navegador
- 📴 **Funciona Offline** - Service Worker para uso sem internet
- 📥 **Exportar CSV** - Backup completo dos dados
- 🎨 **Design Responsivo** - Funciona em qualquer dispositivo
- 👥 **Multi-usuário** - Sistema de login para diferentes usuários

## 🎯 Screenshots

### Dashboard
![Dashboard](docs/screenshot-dashboard.png)

### Adicionar Transação
![Adicionar](docs/screenshot-add.png)

### Relatórios
![Relatórios](docs/screenshot-reports.png)

## 🛠️ Tecnologias

- **HTML5** - Estrutura semântica
- **CSS3** - Estilização moderna com variáveis CSS
- **JavaScript Vanilla** - Sem frameworks, puro e performático
- **Chart.js** - Gráficos interativos
- **Service Worker** - Cache e funcionalidade offline
- **LocalStorage** - Persistência de dados no navegador
- **PWA Manifest** - Instalação como app nativo

## 📦 Instalação e Deploy

### Deploy na Vercel (Recomendado)

1. **Fork este repositório**

2. **Importe no Vercel:**
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "New Project"
   - Importe do GitHub
   - Deploy automático!

3. **Configure domínio personalizado** (opcional):
   - Settings → Domains
   - Adicione seu domínio

### Desenvolvimento Local

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/controle-financeiro.git
cd controle-financeiro

# Instale servidor local (uma vez)
pip install http-server

# Execute o servidor
p

# Acesse no navegador
http://localhost:8000
```

Ou simplesmente abra `index.html` no navegador (funciona, mas sem PWA completo).

## 🔐 Autenticação

### Credenciais Padrão

- **Usuário:** higor | **Senha:** 1234
- **Usuário:** rafa | **Senha:** 1234

### ⚠️ IMPORTANTE - Segurança

Este app usa autenticação básica no frontend. Para uso em produção:

**Altere as senhas imediatamente:**

1. Abra o console do navegador (F12)
2. Execute:

```javascript
let users = JSON.parse(localStorage.getItem('financeiro_users'));
users.higor.password = 'SUA_SENHA_FORTE_AQUI';
users.rafa.password = 'SUA_SENHA_FORTE_AQUI';
localStorage.setItem('financeiro_users', JSON.stringify(users));
```

**Para segurança máxima em produção:**
- Considere adicionar backend com autenticação real
- Use Firebase Authentication ou Auth0
- Implemente hash de senhas (bcrypt)
- Adicione autenticação de dois fatores

## 📱 Instalação como App

### Android (Chrome)

1. Acesse o app no Chrome
2. Toque no menu (⋮) → "Adicionar à tela inicial"
3. Confirme a instalação
4. Pronto! Ícone na tela inicial

### iOS (Safari)

1. Acesse o app no Safari
2. Toque no botão compartilhar (⬆️)
3. Role e toque em "Adicionar à Tela Inicial"
4. Confirme

### Desktop (Chrome/Edge)

1. Acesse o app
2. Clique no ícone de instalação (➕) na barra de endereço
3. Ou Menu → "Instalar Controle Financeiro"

## 📊 Estrutura de Dados

Os dados são armazenados localmente no `localStorage`:

```javascript
{
  transactions: [
    {
      id: 1706548800000,
      tipo: "Despesa",
      data: "2026-01-30",
      categoria: "Alimentação",
      descricao: "Supermercado",
      valor: 250.00,
      pagamento: "Débito",
      usuario: "Higor",
      criadoEm: "2026-01-30T14:30:00.000Z"
    }
  ],
  lastSync: "2026-01-30T14:30:00.000Z"
}
```

## 🔄 Backup e Restauração

### Fazer Backup

1. Acesse a aba **Relatórios**
2. Clique em **"📥 Exportar CSV"**
3. Salve o arquivo em local seguro

### Restaurar Dados

Atualmente manual - adicione as transações novamente ou use a integração com Power BI (arquivos CSV inclusos).

### Sincronização Entre Dispositivos

⚠️ Por padrão, cada dispositivo tem seus próprios dados locais.

**Para sincronizar:**
- Exporte CSV de um dispositivo
- Importe no outro manualmente
- Ou implemente sincronização na nuvem (Firebase/Supabase)

## 🎨 Personalização

### Alterar Cores

Edite `styles.css`:

```css
:root {
    --primary: #007BFF;    /* Azul principal */
    --success: #28A745;    /* Verde (receitas) */
    --danger: #DC3545;     /* Vermelho (despesas) */
}
```

### Adicionar Categorias

Edite `index.html`, procure `<select id="categoria">`:

```html
<option value="NomeCategoria">Nome da Categoria</option>
```

### Alterar Ícones

Substitua:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

## 📁 Estrutura do Projeto

```
controle-financeiro/
├── index.html              # Página principal
├── styles.css              # Estilos
├── app.js                  # Lógica do aplicativo
├── service-worker.js       # Cache offline
├── manifest.json           # Config PWA
├── vercel.json             # Config Vercel
├── icon-192.png            # Ícone 192x192
├── icon-512.png            # Ícone 512x512
├── .gitignore              # Arquivos ignorados
├── README.md               # Este arquivo
└── docs/                   # Documentação adicional
    ├── README_PWA.md       # Guia completo do PWA
    └── README_PowerBI.md   # Integração Power BI
```

## 🚀 Roadmap

- [x] Dashboard com resumo financeiro
- [x] Adicionar/visualizar transações
- [x] Filtros e relatórios
- [x] Exportar CSV
- [x] PWA instalável
- [x] Funciona offline
- [x] Deploy Vercel
- [ ] Sincronização na nuvem (Firebase)
- [ ] Categorização automática com IA
- [ ] Notificações de vencimento
- [ ] Upload de comprovantes
- [ ] Metas e orçamento mensal
- [ ] Gráficos de evolução temporal
- [ ] Modo escuro
- [ ] Temas personalizáveis

## 🤝 Contribuindo

Este é um projeto privado, mas se você fizer fork:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é de uso **privado**. Todos os direitos reservados.

## 👨‍💻 Autores

- **Higor** - Desenvolvimento e manutenção
- **Rafa** - Testes e feedback

## 🙏 Agradecimentos

- [Chart.js](https://www.chartjs.org/) - Biblioteca de gráficos
- [Vercel](https://vercel.com) - Hospedagem gratuita
- Comunidade PWA

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a [documentação completa](docs/README_PWA.md)
2. Verifique o console do navegador (F12) para erros
3. Limpe o cache e tente novamente

---

**Desenvolvido com ❤️ para uma vida financeira mais organizada!**

⭐ Se este projeto te ajudou, considere dar uma estrela!
