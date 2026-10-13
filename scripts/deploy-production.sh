#!/bin/bash
# ==============================================================================
# DIGITALMUID — Production Deployment Script (Hostinger / VPS / PM2 / Node.js)
# ==============================================================================
set -e

echo "=== [1/5] Checking Node.js Environment ==="
node -v
npm -v

echo "=== [2/5] Installing Dependencies ==="
npm install --production=false

echo "=== [3/5] Building Client, Bundling Server & Generating Static SEO Pages ==="
npm run build

echo "=== [4/5] Verifying Generated Artifacts ==="
test -f dist/server.cjs || { echo "ERROR: dist/server.cjs missing!"; exit 1; }
test -f dist/web/index.html || { echo "ERROR: dist/web/index.html missing!"; exit 1; }
test -f dist/learn/index.html || { echo "ERROR: dist/learn/index.html missing!"; exit 1; }
test -f dist/contact/index.html || { echo "ERROR: dist/contact/index.html missing!"; exit 1; }
test -f dist/business-growth-consultation/index.html || { echo "ERROR: dist/business-growth-consultation/index.html missing!"; exit 1; }
test -f dist/sitemap.xml || { echo "ERROR: dist/sitemap.xml missing!"; exit 1; }
test -f dist/robots.txt || { echo "ERROR: dist/robots.txt missing!"; exit 1; }
test -f dist/_redirects || { echo "ERROR: dist/_redirects missing!"; exit 1; }
test -f dist/.htaccess || { echo "ERROR: dist/.htaccess missing!"; exit 1; }

echo "=== [5/5] Restarting Production Application Process ==="
if command -v pm2 >/dev/null 2>&1; then
  echo "Restarting via PM2..."
  pm2 restart digitalmuid || pm2 restart server || pm2 start dist/server.cjs --name "digitalmuid"
elif [ -f "/etc/systemd/system/digitalmuid.service" ]; then
  echo "Restarting systemd service..."
  systemctl restart digitalmuid
else
  echo "Process manager not detected in current shell. If running in Hostinger hPanel Node.js app,"
  echo "click 'Restart Application' in the hPanel Node.js dashboard."
fi

echo "=== Deployment Completed Successfully ==="
