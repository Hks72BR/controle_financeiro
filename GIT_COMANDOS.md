# 🚀 Comandos Git - Guia Rápido

## Primeira Vez (Setup Inicial)

### 1. Configure o Git (se ainda não fez)

```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### 2. Crie o repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: `controle-financeiro`
3. Visibilidade: **Private** 🔒
4. **NÃO** marque "Initialize with README"
5. Clique em "Create repository"

### 3. Suba o código (primeira vez)

```powershell
cd "C:\Users\higor\Desktop\controle financeiro"

# Inicializar git
git init

# Adicionar todos os arquivos
git add .

# Primeiro commit
git commit -m "Initial commit - PWA Controle Financeiro"

# Conectar ao GitHub (SUBSTITUA SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/controle-financeiro.git

# Enviar para GitHub
git branch -M main
git push -u origin main
```

---

## Atualizações Futuras

Sempre que fizer alterações no código:

```powershell
cd "C:\Users\higor\Desktop\controle financeiro"

# Ver o que mudou
git status

# Adicionar alterações
git add .

# Fazer commit com mensagem descritiva
git commit -m "Descrição do que você alterou"

# Enviar para GitHub
git push
```

---

## Comandos Úteis

### Ver status atual
```powershell
git status
```

### Ver histórico de commits
```powershell
git log --oneline
```

### Desfazer alterações não commitadas
```powershell
git checkout .
```

### Ver diferenças
```powershell
git diff
```

### Criar branch para nova feature
```powershell
git checkout -b nome-da-feature
```

### Voltar para main
```powershell
git checkout main
```

### Baixar atualizações do GitHub
```powershell
git pull
```

---

## Mensagens de Commit Recomendadas

Use mensagens claras e descritivas:

```bash
git commit -m "Adiciona filtro por data no dashboard"
git commit -m "Corrige bug no cálculo de saldo"
git commit -m "Melhora design dos gráficos"
git commit -m "Adiciona exportação em PDF"
git commit -m "Atualiza documentação"
```

### Padrão de mensagens:

- **Adiciona** - novas funcionalidades
- **Corrige** - bugs e problemas
- **Melhora** - melhorias em funcionalidades existentes
- **Atualiza** - atualizações de dependências ou docs
- **Remove** - remoção de código/arquivos

---

## Fluxo de Trabalho Diário

```powershell
# 1. Entrar na pasta
cd "C:\Users\higor\Desktop\controle financeiro"

# 2. Baixar atualizações (se Rafa também estiver editando)
git pull

# 3. Fazer suas alterações no código

# 4. Ver o que mudou
git status

# 5. Adicionar e commitar
git add .
git commit -m "Sua mensagem aqui"

# 6. Enviar para GitHub
git push

# 7. Deploy automático na Vercel! 🎉
```

---

## Autenticação no GitHub

### Se pedir senha:

O GitHub **não aceita mais senhas**. Use **token de acesso pessoal**:

1. GitHub → Settings → Developer settings
2. Personal access tokens → Generate new token
3. Marque: `repo` (acesso completo a repositórios)
4. Gere o token
5. **Copie e guarde** (só aparece uma vez!)
6. Use o token como senha no git

### Ou configure SSH (mais fácil):

```powershell
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu@email.com"

# Copiar chave pública
cat ~/.ssh/id_ed25519.pub

# Adicionar no GitHub:
# Settings → SSH and GPG keys → New SSH key
```

Depois use URL SSH em vez de HTTPS:
```powershell
git remote set-url origin git@github.com:SEU_USUARIO/controle-financeiro.git
```

---

## Sincronização com Vercel

### Deploy Automático

✅ **Já configurado!**

Toda vez que você faz `git push`:
1. GitHub recebe o código
2. Vercel detecta automaticamente
3. Deploy acontece em ~30 segundos
4. App atualizado na URL de produção

### Ver status do deploy

1. Acesse [vercel.com](https://vercel.com)
2. Entre no projeto `controle-financeiro`
3. Veja os deploys na aba "Deployments"

---

## Problemas Comuns

### "fatal: not a git repository"
```powershell
git init
```

### "Updates were rejected"
```powershell
git pull --rebase
git push
```

### "Failed to push"
```powershell
# Força o push (cuidado!)
git push -f origin main
```

### Desfazer último commit
```powershell
git reset --soft HEAD~1
```

### Ignorar arquivo já commitado
```powershell
git rm --cached arquivo.txt
# Adicione ao .gitignore
git commit -m "Remove arquivo do git"
```

---

## Checklist de Deploy

Antes de cada `git push`:

- [ ] Código testado localmente
- [ ] Sem erros no console (F12)
- [ ] Todas as funcionalidades OK
- [ ] Mensagem de commit descritiva
- [ ] .gitignore atualizado (não enviar senhas!)

---

## Dicas Finais

1. **Commite frequentemente** - pequenos commits são melhores
2. **Mensagens claras** - você vai agradecer depois
3. **Teste antes de push** - evita bugs em produção
4. **Use branches** - para features grandes
5. **Faça backup** - exportar CSV regularmente

---

**Comando mais usado:**

```powershell
cd "C:\Users\higor\Desktop\controle financeiro"
git add .
git commit -m "Sua mensagem"
git push
```

**Isso é 90% do que você vai precisar! 🚀**
