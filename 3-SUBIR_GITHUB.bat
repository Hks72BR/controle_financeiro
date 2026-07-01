@echo off
echo.
echo ========================================
echo   Subindo para GitHub
echo ========================================
echo.

cd "C:\Users\higor\Desktop\controle financeiro"

echo Inicializando Git...
git init

echo.
echo Adicionando arquivos...
git add .

echo.
echo Fazendo commit...
git commit -m "Initial commit - PWA Controle Financeiro"

echo.
echo ========================================
echo IMPORTANTE!
echo ========================================
echo.
echo Agora voce precisa:
echo.
echo 1. Criar repositorio no GitHub:
echo    - Acesse: github.com
echo    - Clique em: New repository
echo    - Nome: controle-financeiro
echo    - Visibilidade: Private
echo    - Nao marque "Initialize with README"
echo.
echo 2. Depois, execute os comandos abaixo:
echo    (substitua SEU_USUARIO pelo seu usuario do GitHub)
echo.
echo    git remote add origin https://github.com/SEU_USUARIO/controle-financeiro.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo ========================================
echo.
pause
