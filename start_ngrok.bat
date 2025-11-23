@echo off
echo ========================================
echo Starting ngrok with authtoken...
echo ========================================
echo.
echo Ngrok will expose your local server at http://localhost:5000
echo.
echo After ngrok starts, you can:
echo 1. Open http://localhost:4040 in your browser to see the ngrok dashboard
echo 2. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
echo 3. Configure PayPal Webhook with: https://your-ngrok-url.ngrok.io/api/admin/webhooks/paypal
echo.
echo Note: Your ngrok authtoken is already configured.
echo.
echo Press Ctrl+C to stop ngrok
echo.
C:\ngrok\ngrok.exe http 5000

