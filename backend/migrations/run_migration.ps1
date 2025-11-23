# Database Migration Script
# Usage: Run this script in PowerShell (password is automatically provided)

Write-Host "Starting database migration..." -ForegroundColor Green
Write-Host ""

# MySQL password (can be overridden by environment variable)
$mysqlPassword = if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "123456" }

# Read SQL file content
$sqlContent = Get-Content -Path "add_pricing_system_fields.sql" -Raw -Encoding UTF8

# Execute SQL with password using --password= format
$env:MYSQL_PWD = $mysqlPassword
$sqlContent | mysql -u root kongfuworld
$env:MYSQL_PWD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Database migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Database migration failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}
