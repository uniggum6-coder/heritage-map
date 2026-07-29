$dir = $PSScriptRoot
$port = 8791
$prefix = "http://localhost:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "서버가 실행되었습니다: $prefix"
Write-Host "브라우저가 자동으로 열립니다. 이 창을 닫으면 서버가 종료됩니다."

Start-Process "$($prefix)index.html"

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath.TrimStart("/")
    if ([string]::IsNullOrEmpty($localPath)) {
        $localPath = "index.html"
    }

    $filePath = Join-Path $dir $localPath

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        if ($mimeMap.ContainsKey($ext)) {
            $contentType = $mimeMap[$ext]
        } else {
            $contentType = "application/octet-stream"
        }
        try {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $response.StatusCode = 500
        }
    } else {
        $response.StatusCode = 404
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
        $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
    }

    $response.OutputStream.Close()
}
