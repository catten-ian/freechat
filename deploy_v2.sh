#!/bin/bash
# 小喵AI助手 - 后端数据库版本部署脚本
# 部署 Phase 1+2+3 完整后端 + 云端同步

set -e

SERVER="root@217.69.4.85"
PASS="6Cj.@H7QQYcgyq-E"
REMOTE_DIR="/var/www/freechat"

echo "📦 [1/6] 本地构建前端..."
cd /home/fame/.openclaw/workspace/freechat
npm run build

echo "💾 [2/6] 备份服务器旧版本..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $SERVER << REMOTE
TS=\$(date +%Y%m%d_%H%M%S)
cd $REMOTE_DIR
cp server.js server.js.bak.\$TS 2>/dev/null || true
[ -d data ] && cp -r data data.bak.\$TS 2>/dev/null || true
echo "✅ 备份完成: \$TS"
REMOTE

echo "🚀 [3/6] 上传后端文件..."
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no \
  server.js database.js api.js ws_server.js \
  $SERVER:$REMOTE_DIR/

echo "📂 [4/6] 上传前端 dist..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $SERVER "rm -rf $REMOTE_DIR/dist"
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -r dist $SERVER:$REMOTE_DIR/

echo "🗄️ [5/6] 确保 data 目录存在..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $SERVER << REMOTE
mkdir -p $REMOTE_DIR/data
chmod 755 $REMOTE_DIR/data
REMOTE

echo "🔄 [6/6] 重启服务..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $SERVER << 'REMOTE'
cd /var/www/freechat
pm2 restart freechat || pm2 start server.js --name freechat
pm2 save
sleep 2
echo "--- PM2 状态 ---"
pm2 list | grep freechat
echo "--- 最新日志 ---"
pm2 logs freechat --lines 10 --nostream 2>&1 | tail -15
REMOTE

echo ""
echo "✅ 部署完成！"
echo "🌐 前端: https://www.catten.cyou/ai/"
echo "🔌 数据库 API: https://www.catten.cyou/ai/api/db/conversations"
