# 🐱 小喵AI助手

一个基于 React + Vite 的现代化 AI 对话助手，支持多种模型、图片生成、对话管理等功能。

## ✨ 功能特性

### 📝 对话功能
- **多模型支持**：免费模型（Llama、Gemma、Qwen）、付费模型（GPT-4o、Claude）、非审查模型（Venice）
- **思考模式**：支持 AI 思考过程展示
- **图片上传**：支持多模态对话
- **Markdown 渲染**：支持代码高亮、表格等
- **对话导出**：导出对话历史

### 🎨 图片生成
- **多模型支持**：Nano Banana、DALL-E、Flux、Venice 等
- **多种尺寸**：自动、512x512、1024x1024、2K、4K 等
- **无审查选项**：Venice 系列模型支持无限制生成

### 📁 对话管理（v2.1.0 新增）
- **侧栏设计**：清晰的对话列表展示
- **搜索功能**：搜索对话标题和内容，支持高亮显示
- **文件夹管理**：创建、删除文件夹，组织对话
- **标签系统**：为对话添加彩色标签
- **消息预览**：显示最后一条消息和时间戳
- **移动端适配**：响应式设计，侧栏可折叠

## 🛠️ 技术栈

- **前端**：React 18 + Vite 5
- **样式**：CSS Variables + Flexbox
- **Markdown**：react-markdown + remark-gfm + rehype-highlight
- **代码高亮**：highlight.js
- **状态管理**：useState + localStorage
- **开发规范**：OpenSpec 规范化开发流程

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/catten-ian/freechat.git
cd freechat

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

## 🚀 部署

### 服务器要求
- Node.js 18+
- PM2 进程管理器
- Caddy 反向代理

### 部署步骤

```bash
# 1. 构建前端
npm run build

# 2. 部署到服务器
bash deploy_clean.sh

# 3. 配置 Caddy（见下方）
```

### Caddy 配置

```caddyfile
www.catten.cyou {
    root * /var/www
    file_server
    
    # AI助手（支持 WebSocket）
    handle_path /ai/* {
        reverse_proxy localhost:3001 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

## 🎨 设计风格

### 红青配色方案（v2.0.0）
- **主色调**：深红色（#ef4444）
- **点缀色**：青色（#06b6d4）
- **背景**：深色系（#0d0d1a ~ #22223d）
- **风格**：梦幻科技风，柔和边角，发光效果

### 响应式设计
- **桌面端**（≥769px）：侧栏固定显示
- **移动端**（<769px）：侧栏可折叠，点击按钮展开

## 📊 版本历史

### v2.1.0 (2026-05-25)
- ✅ 新增侧栏对话管理
- ✅ 搜索功能（标题 + 内容）
- ✅ 文件夹和标签系统
- ✅ 消息预览和时间戳
- ✅ 移动端适配优化

### v2.0.0 (2026-05-25)
- ✅ 红青配色方案
- ✅ 模型分组修复
- ✅ Vite base 配置修复
- ✅ 稳定版本发布

### v1.0.0
- ✅ 基础对话功能
- ✅ 多模型支持
- ✅ 图片生成

## 📂 项目结构

```
freechat/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx      # 侧栏组件
│   │   └── Sidebar.css      # 侧栏样式
│   ├── hooks/
│   │   └── useSearch.js     # 搜索 Hook
│   └── utils/
│   │   └── storage.js       # localStorage 工具
├── openspec/                # OpenSpec 规范文档
│   └ changes/sidebar-enhancement/
│       ├── proposal.md
│       ├── design.md
│       ├── specs/
│       └── tasks.md
├── App.jsx                  # 主应用组件
├── App.css                  # 主样式文件
├── server.js                # Node.js 后端
├── vite.config.js           # Vite 配置
└── package.json             # 项目配置
```

## 🔧 开发规范

本项目使用 **OpenSpec** 规范化开发流程：

1. **Proposal**：需求提案（为什么做、做什么）
2. **Design**：技术设计（架构决策、技术选型）
3. **Specs**：功能规格（详细需求场景）
4. **Tasks**：实施清单（可追踪的任务）

详见 `openspec/changes/sidebar-enhancement/` 目录。

## 🌐 API 配置

支持的 API 提供商：

| 提供商 | API 端点 | 用途 |
|--------|---------|------|
| OpenRouter | api.openrouter.ai | 免费模型 |
| v3cm | api.v3.cm | 付费模型 |
| Venice | api.venice.ai | 非审查模型 |

API 密钥配置在 `server.js` 中（生产环境建议使用环境变量）。

## 📝 待优化功能

- [ ] 批量操作（删除、移动、归档）
- [ ] 虚拟滚动（react-window）
- [ ] 移动端手势操作
- [ ] localStorage 容量监控
- [ ] 后端数据库存储

## 🐛 已知问题

- 移动端侧栏切换按钮样式需优化
- 搜索历史建议使用 localStorage 持久化
- 大量对话时性能需优化（虚拟滚动）

## 📄 License

MIT

## 👤 Author

catten (吕彦锦)

---

**访问地址**：https://www.catten.cyou/ai/

**GitHub**：https://github.com/catten-ian/freechat