# Stage 2 - S1 验收测试脚本
# 使用方法：重启后端后运行此脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stage 2 - S1 验收测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 测试 A: GET /api/chapters/novel/7/next-number
Write-Host "=== Test A: GET /api/chapters/novel/7/next-number ===" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/chapters/novel/7/next-number" -Method GET -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Response: $($json | ConvertTo-Json -Depth 5)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
Write-Host ""

# 测试 B: GET /api/chapters/novel/7/list
Write-Host "=== Test B: GET /api/chapters/novel/7/list ===" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/chapters/novel/7/list" -Method GET -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Response (first 30 lines):"
    ($json | ConvertTo-Json -Depth 3) -split "`n" | Select-Object -First 30
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
Write-Host ""

# 测试 C: GET /api/novels/7/volumes
Write-Host "=== Test C: GET /api/novels/7/volumes ===" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/novels/7/volumes" -Method GET -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Response: $($json | ConvertTo-Json -Depth 3)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
Write-Host ""

# 测试 D: GET /api/chapters/novel/7/paid
Write-Host "=== Test D: GET /api/chapters/novel/7/paid ===" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/chapters/novel/7/paid" -Method GET -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Response (first 30 lines):"
    ($json | ConvertTo-Json -Depth 3) -split "`n" | Select-Object -First 30
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
Write-Host ""

# 测试 E: GET /api/chapter/1244?userId=1000
Write-Host "=== Test E: GET /api/chapter/1244?userId=1000 ===" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/chapter/1244?userId=1000" -Method GET -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Response (first 30 lines):"
    ($json | ConvertTo-Json -Depth 3) -split "`n" | Select-Object -First 30
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "验收测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "请检查后端日志，确认：" -ForegroundColor Yellow
Write-Host "1. 没有出现 EPIPE/closed state 错误" -ForegroundColor Yellow
Write-Host "2. 能看到 Db.query 的 tag（如 novelCreation.nextChapterNumber）" -ForegroundColor Yellow
Write-Host ""

