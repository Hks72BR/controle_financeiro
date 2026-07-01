# 🚀 Guia de Deploy - GitHub + Vercel

## Passo a Passo Completo

### 1️⃣ Preparar o Repositório no GitHub

#### A. Criar Repositório

1. Acesse [github.com](https://github.com)
2. Clique em **"New repository"**
3. Preencha:
   - **Nome:** `controle-financeiro`
   - **Descrição:** "PWA de Controle Financeiro Pessoal"
   - **Visibilidade:** 🔒 **Private** (recomendado para segurança)
   - ✅ **NÃO** marque "Initialize with README"
4. Clique em **"Create repository"**

#### B. Subir o Código

Abra o PowerShell na pasta do projeto:

```powershell
cd "C:\Users\higor\Desktop\controle financeiro"

# Inicializar git
git init

# Adicionar arquivos
git add .

# Primeiro commit
git commit -m "Initial commit - PWA Controle Financeiro"

# Conectar ao GitHub (substitua SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/controle-financeiro.git

# Enviar para GitHub
git branch -M main
git push -u origin main
```

**Problemas comuns:**

Se der erro de autenticação:
```powershell
# Configure seu nome e email
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Use token de acesso pessoal em vez de senha
# Gere em: GitHub → Settings → Developer settings → Personal access tokens
```

---

### 2️⃣ Deploy na Vercel

#### A. Criar Conta na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Sign Up"**
3. Escolha **"Continue with GitHub"**
4. Autorize a Vercel a acessar seu GitHub

#### B. Importar Projeto

1. No dashboard da Vercel, clique em **"Add New..."** → **"Project"**
2. Encontre o repositório `controle-financeiro`
3. Clique em **"Import"**
4. Configure:
   - **Framework Preset:** Other (ou None)
   - **Root Directory:** `./` (deixe padrão)
   - **Build Command:** (deixe vazio)
   - **Output Directory:** (deixe vazio)
5. Clique em **"Deploy"**

#### C. Aguardar Deploy

- A Vercel vai fazer o deploy automaticamente
- Leva ~30 segundos
- Você receberá uma URL: `https://controle-financeiro-xxx.vercel.app`

---

### 3️⃣ Configurar Domínio Personalizado (Opcional)

#### Se você TEM um domínio próprio:

1. No projeto na Vercel → **Settings** → **Domains**
2. Adicione seu domínio: `financeiro.seudominio.com`
3. Configure DNS no seu provedor:
   - **Tipo:** CNAME
   - **Nome:** financeiro
   - **Valor:** cname.vercel-dns.com

#### Se você NÃO tem domínio:

Você pode usar o domínio gratuito da Vercel:
- `https://controle-financeiro.vercel.app`

Ou personalizar o subdomínio:
1. Settings → Domains
2. Edite o domínio .vercel.app
3. Escolha um nome disponível

---

### 4️⃣ Testar o App Online

1. Acesse a URL fornecida pela Vercel
2. Faça login (higor/1234 ou rafa/1234)
3. **⚠️ ALTERE AS SENHAS IMEDIATAMENTE:**
   - F12 → Console
   - Execute o código para alterar senhas (veja README.md)

4. Teste todas as funcionalidades:
   - ✅ Adicionar transação
   - ✅ Ver dashboard
   - ✅ Filtros
   - ✅ Relatórios
   - ✅ Exportar CSV

5. Instale no celular:
   - Chrome → Menu → "Adicionar à tela inicial"

---

### 5️⃣ Configurar Deploy Automático

**Já está configurado!** 🎉

Sempre que você fizer `git push`:
```powershell
# Fazer alterações
git add .
git commit -m "Descrição da alteração"
git push

# Vercel faz deploy automático em ~30s
```

---

## 🔧 Configurações Avançadas

### Variáveis de Ambiente (se precisar no futuro)

1. Vercel → Settings → Environment Variables
2. Adicione variáveis:
   - `API_KEY`: sua-chave-api
   - `DATABASE_URL`: url-do-banco
3. Redeploy

### Proteção com Senha (Vercel)

Para adicionar proteção extra:

1. Settings → General → Password Protection
2. Ative e defina uma senha
3. Usuários precisarão da senha para acessar o site

### Analytics

Vercel oferece analytics grátis:

1. Analytics → Enable
2. Veja visitantes, páginas mais acessadas, etc.

---

## 🔄 Workflow de Desenvolvimento

### Fluxo Recomendado:

```powershell
# 1. Trabalhar localmente
cd "C:\Users\higor\Desktop\controle financeiro"

# 2. Rodar servidor local para testar
p

# 3. Abrir no navegador
http://localhost:8000

# 4. Fazer alterações e testar

# 5. Quando estiver satisfeito, enviar para GitHub
git add .
git commit -m "Adiciona nova funcionalidade X"
git push

# 6. Vercel faz deploy automático
# Aguarde ~30s e acesse a URL de produção
```

---

## 🐛 Solução de Problemas

### Deploy falhou na Vercel

1. Verifique os logs no dashboard da Vercel
2. Certifique-se que todos os arquivos necessários estão no GitHub
3. Verifique o `vercel.json` está correto

### Git push negado

```powershell
# Autentique com token de acesso pessoal
# GitHub → Settings → Developer settings → Personal access tokens → Generate new token
# Use o token como senha
```

### Service Worker não funciona

- Service Workers só funcionam em HTTPS ou localhost
- Na Vercel (HTTPS), funcionará automaticamente
- Limpe o cache do navegador se tiver problemas

### Dados não persistem

- LocalStorage é por domínio
- Dados locais (localhost) ≠ dados produção (vercel.app)
- Exporte CSV do local e recrie no produção

---

## 📊 Monitoramento

### Vercel Dashboard

Acesse para ver:
- ✅ Status do deploy
- 📊 Analytics (visitantes)
- 🔥 Performance
- 🐛 Logs de erro
- 📈 Uso de banda

### GitHub

- Ver histórico de commits
- Gerenciar código
- Criar branches para features

---

## 🔐 Segurança em Produção

### ⚠️ IMPORTANTE - Antes de Compartilhar

1. **Altere as senhas padrão** (1234)
2. **Considere repositório privado** no GitHub
3. **Ative proteção com senha** na Vercel (opcional)
4. **Não compartilhe a URL publicamente**
5. **Faça backups regulares** (exportar CSV)

### Para Melhor Segurança (Futuro):

- Implemente backend com autenticação real
- Use Firebase ou Supabase
- Adicione autenticação de dois fatores
- Hash de senhas com bcrypt
- Rate limiting

---

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Código no GitHub
- [ ] Deploy na Vercel funcionando
- [ ] URL personalizada configurada (opcional)
- [ ] Senhas alteradas
- [ ] App testado online
- [ ] PWA instalado no celular
- [ ] Backup inicial criado (CSV)
- [ ] Documentação revisada
- [ ] README.md atualizado com URL correta

---

## 🎉 Próximos Passos

1. **Compartilhe a URL** apenas com Rafa
2. **Ambos instalem** como PWA no celular
3. **Comecem a usar** diariamente
4. **Exportem backups** semanalmente
5. **Monitorem** pelo dashboard da Vercel

---

**Dúvidas?** Consulte:
- [Documentação Vercel](https://vercel.com/docs)
- [GitHub Guides](https://guides.github.com/)
- README.md do projeto

---

**Seu app está no ar! 🚀**

Acesse: `https://seu-projeto.vercel.app`
