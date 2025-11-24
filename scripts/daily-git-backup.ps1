$Time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "🚀 Auto Daily Backup Started at $Time"

# 切换到项目根目录
Set-Location -Path (Split-Path $MyInvocation.MyCommand.Path -Parent)
Set-Location ..

# 添加所有修改
git add .

# 创建提交
git commit -m "Daily auto-backup: $Time" | Out-Null

# 推送到 GitHub
git push origin main

Write-Host "✅ Auto Daily Backup Completed."

