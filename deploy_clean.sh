#!/bin/bash

# 小喵AI助手 - 强制重新部署脚本
# 解决服务器上运行错误版本的问题

set -e  # 遇到错误立即退出

echo "📦 [1/5] 打包前端..."
cd /home/fame/.openclaw/workspace/freechat
npm run build

echo "🗑️ [2/5] 清理服务器旧文件..."
sshpass -p '6Cj.@H7QQYcgyq-E' ssh root@217.69.4.85 "rm -rf /var/www/freechat/dist /var/www/freechat/server.js"

echo "🚀 [3/5] 上传新文件到服务器..."
sshpass -p '6Cj.@H7QQYcgyq-E' scp -r dist root@217.69.4.85:/var/www/freechat/
sshpass -p '6Cj.@H7QQYcgyq-E' scp server.js root@217.69.4.85:/var/www/freechat/

echo "🔄 [4/5] 重启服务..."
sshpass -p '6Cj.@H7QQYcgyq-E' ssh root@217.69.4.85 << 'EOF'
cd /var/www/freechat
pm2 restart freechat || pm2 start server.js --name freechat
pm2 save
EOF

echo "✅ [5/5] 部署完成！"
echo "🌐 访问: https://www.catten.cyou/ai/"
