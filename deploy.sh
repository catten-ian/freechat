#!/bin/bash

# 小喵AI更新脚本

echo "📦 打包前端..."
cd /home/fame/.openclaw/workspace/freechat
npm run build

echo "🚀 部署到服务器..."
sshpass -p '6Cj.@H7QQYcgyq-E' scp -r dist/* server.js root@217.69.4.85:/var/www/freechat/

echo "🔄 重启服务..."
sshpass -p '6Cj.@H7QQYcgyq-E' ssh root@217.69.4.85 << 'EOF'
cd /var/www/freechat
pm2 restart freechat || pm2 start server.js --name freechat
pm2 save
EOF

echo "✅ 部署完成！"
