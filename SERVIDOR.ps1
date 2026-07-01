# Servidor HTTP simples em PowerShell
$port = 8000
$path = (Get-Location).Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Finanças Familia Coelho" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Servidor iniciado na porta $port" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse no navegador:" -ForegroundColor Yellow
Write-Host "  http://localhost:$port" -ForegroundColor White
Write-Host ""
Write-Host "Pressione Ctrl+C para encerrar" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador automaticamente
Start-Process "http://localhost:$port"

# Criar servidor HTTP
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Obter arquivo solicitado
        $localPath = $request.Url.LocalPath
        if ($localPath -eq '/') {
            $localPath = '/index.html'
        }
        
        $filePath = Join-Path $path $localPath.TrimStart('/')
        
        if (Test-Path $filePath) {
            # Definir Content-Type baseado na extensão
            $extension = [System.IO.Path]::GetExtension($filePath)
            $contentType = switch ($extension) {
                '.html' { 'text/html; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.js'   { 'application/javascript; charset=utf-8' }
                '.json' { 'application/json; charset=utf-8' }
                '.png'  { 'image/png' }
                '.jpg'  { 'image/jpeg' }
                '.jpeg' { 'image/jpeg' }
                '.gif'  { 'image/gif' }
                '.svg'  { 'image/svg+xml; charset=utf-8' }
                '.ico'  { 'image/x-icon' }
                '.csv'  { 'text/csv; charset=utf-8' }
                default { 'application/octet-stream' }
            }
            
            $response.ContentType = $contentType
            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            
            Write-Host "200 - $localPath" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo não encontrado")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            
            Write-Host "404 - $localPath" -ForegroundColor Red
        }
        
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
