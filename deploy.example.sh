#!/bin/bash
# deploy.example.sh - 示例部署脚本，请勿作为生产环境 webhook 入口直接使用
set -euo pipefail

PROJECT_ROOT="/var/www/void-island-site"
APP_NAME="void-island"
STATUS_LOG="$PROJECT_ROOT/deploy_status.log" # 部署状态追溯文件

exec > >(tee -a "$STATUS_LOG") 2>&1

log() {
    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"
}

cd "$PROJECT_ROOT" || exit 1
source /etc/environment
if [ -f /etc/void-island-site.env ]; then
    set -a
    # shellcheck disable=SC1091
    . /etc/void-island-site.env
    set +a
fi

echo "------------------------------------------------"
log "🚀 DEPLOY START"

log "Step 1: Pulling latest code..."
git fetch origin main
git reset --hard origin/main
CURRENT_COMMIT=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
log "Latest Commit: $CURRENT_COMMIT - $COMMIT_MSG"

log "Step 2: Cleaning up artifacts, cache and node_modules..."
rm -rf .next
rm -rf node_modules
rm -f *.db 
rm -f .aether_cache_*
npm cache clean --force

log "Step 3: Updating commit-log..."
BLOG_DIR="blog"
if [ -d "$BLOG_DIR" ]; then
    find "$BLOG_DIR" -type f -name "*.md" > commit-log.txt
    python3 ./update-commit-log.py || log "[WARN] Python script failed"
fi

log "Step 4: Fresh install of dependencies (This may take a while)..."
npm install

echo "[INFO] Building Next.js frontend..."
if npm run build; then
    echo "[PASS] Build successful" >> "$STATUS_LOG"
else
    echo "[FAIL] Build failed at $(date "+%H:%M:%S")" >> "$STATUS_LOG"
    exit 1
fi

log "Step 6: Restarting PM2 with custom server.js..."
pm2 delete "$APP_NAME" 2>/dev/null || true

NODE_ENV=production pm2 start server.js \
    --name "$APP_NAME" \
    --node-args="--max-old-space-size=1024" \
    --update-env

pm2 save

log "✅ DEPLOY SUCCESS (Commit: $CURRENT_COMMIT)"
echo "------------------------------------------------"
