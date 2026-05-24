## Context

### 当前架构
- **前端**：React + Vite，单文件组件架构（App.jsx + App.css）
- **状态管理**：React useState，无全局状态管理库
- **后端**：Express.js，内存存储（无数据库，重启后数据丢失）
- **部署**：服务器 217.69.4.85，PM2 管理

### 约束条件
1. **无数据库**：当前使用内存存储，新增的分组、标签数据需持久化方案
2. **单文件组件**：App.jsx 已有 550+ 行，需考虑代码组织
3. **性能要求**：支持 100+ 对话流畅运行
4. **移动端优先**：70% 用户来自移动端

## Goals / Non-Goals

**Goals:**
- 实现对话搜索、分组、批量操作、视觉优化
- 保持现有功能稳定，不破坏用户体验
- 优化长列表性能，支持 100+ 对话
- 提升移动端操作体验

**Non-Goals:**
- 不引入复杂状态管理库（Redux/MobX）
- 不迁移到数据库存储（继续使用 localStorage + 内存）
- 不重构现有代码架构
- 不实现云端同步功能

## Decisions

### 决策 1：数据存储方案
**选择**：扩展 localStorage 存储结构
**理由**：
- 当前使用 localStorage，继续沿用无需引入数据库
- 用户数据量可控（单个对话 < 50KB，100 个对话 < 5MB）
- 简化部署，无需数据库迁移

**数据结构**：
```javascript
// localStorage 结构
{
  conversations: [
    {
      id, title, messages, createdAt, updatedAt,
      tags: ['work', 'important'],  // 新增：标签
      folderId: 'folder-123',       // 新增：所属文件夹
      archived: false               // 新增：归档状态
    }
  ],
  folders: [                        // 新增：文件夹列表
    { id, name, color, createdAt }
  ],
  tags: [                           // 新增：标签列表
    { id, name, color, createdAt }
  ],
  searchHistory: []                 // 新增：搜索历史
}
```

**替代方案**：
- IndexedDB：更强大，但增加复杂度
- 后端数据库：需要迁移现有数据，影响部署

### 决策 2：搜索实现方案
**选择**：前端全文搜索（Array.filter + includes）
**理由**：
- 对话数量 < 1000，性能可接受
- 实现简单，无需额外依赖
- 可后续优化为 Web Worker + 索引

**优化策略**：
- 防抖搜索（300ms）
- 仅搜索最近 100 条对话的消息内容
- 标题搜索优先级高于内容搜索

**替代方案**：
- Fuse.js 模糊搜索：更智能，但增加包体积
- 后端搜索：需要数据库支持

### 决策 3：长列表渲染方案
**选择**：react-window 虚拟滚动库
**理由**：
- 成熟稳定，社区活跃
- 支持动态高度
- 包体积小（6KB gzipped）

**替代方案**：
- react-virtualized：功能更全，但包体积更大（30KB）
- 手写虚拟滚动：控制力强，但开发成本高

### 决策 4：代码组织方案
**选择**：组件拆分 + Hooks
**理由**：
- App.jsx 已 550+ 行，继续添加会难以维护
- 拆分为小组件，提升可读性
- 使用自定义 Hooks 封装状态逻辑

**组件拆分**：
```
src/
├── App.jsx              # 主组件（状态管理）
├── components/
│   ├── Sidebar.jsx      # 侧栏组件
│   ├── ConversationList.jsx  # 对话列表
│   ├── ConversationCard.jsx  # 对话卡片
│   ├── SearchBar.jsx    # 搜索栏
│   ├── FolderList.jsx   # 文件夹列表
│   ├── TagManager.jsx   # 标签管理
│   └── BatchActions.jsx # 批量操作工具栏
├── hooks/
│   ├── useConversations.js  # 对话管理 Hook
│   ├── useSearch.js     # 搜索 Hook
│   └── useBatchSelect.js # 批量选择 Hook
└── utils/
    ├── storage.js       # localStorage 操作
    └── format.js        # 格式化工具函数
```

**替代方案**：
- 继续单文件：简单，但难以维护
- 引入状态管理库：过重，不符合项目规模

### 决策 5：移动端手势方案
**选择**：react-use-gesture 手势库
**理由**：
- 支持滑动、长按、拖拽等手势
- 体积小（5KB gzipped）
- API 简洁易用

**替代方案**：
- 原生 TouchEvent：控制力强，但代码复杂
- Hammer.js：功能全面，但包体积大（20KB）

## Risks / Trade-offs

### 风险 1：localStorage 容量限制
**风险**：localStorage 通常限制 5-10MB，大量对话可能超限
**缓解**：
- 监控存储使用量，超过 80% 时提示用户
- 提供"导出对话"功能
- 未来可迁移到 IndexedDB

### 风险 2：搜索性能问题
**风险**：搜索大量对话消息内容可能卡顿
**缓解**：
- 添加防抖（300ms）
- 限制搜索范围（仅最近 100 条对话）
- Web Worker 后台搜索

### 风险 3：组件拆分影响现有功能
**风险**：重构可能破坏现有功能
**缓解**：
- 渐进式重构，先拆分新功能组件
- 保持现有 API 不变
- 充分测试后再替换旧组件

### 风险 4：移动端兼容性
**风险**：不同浏览器手势表现不一致
**缓解**：
- 使用成熟的手势库（react-use-gesture）
- 充分测试主流浏览器（Chrome, Safari, Firefox）
- 提供降级方案（按钮操作）

## Migration Plan

### 阶段 1：数据结构迁移（无破坏性）
1. 新增 localStorage 字段（tags, folders, archived）
2. 保持现有数据兼容
3. 默认值为空数组/false

### 阶段 2：组件拆分（渐进式）
1. 创建新组件文件
2. 在 App.jsx 中引入新组件
3. 验证功能正常后移除旧代码

### 阶段 3：功能实现（按优先级）
1. 搜索功能（高优先级，用户最需要）
2. 视觉优化（高优先级，影响体验）
3. 分组功能（中优先级）
4. 批量操作（低优先级）

### 阶段 4：部署验证
1. 本地测试所有功能
2. 部署到测试环境
3. 灰度发布（先开放给部分用户）
4. 监控错误日志
5. 全量发布

### 回滚策略
- Git 版本回退
- localStorage 数据迁移脚本（删除新增字段）
- 保留旧版本部署包

## Open Questions

1. **搜索历史保存数量**：保存最近 5 条还是 10 条？
   - 建议：5 条，避免占用过多空间

2. **文件夹嵌套层级**：支持多级嵌套还是仅一级？
   - 建议：仅一级，简化实现和用户操作

3. **标签颜色方案**：预设颜色还是自定义？
   - 建议：预设 8 种颜色，简化选择

4. **批量操作最大数量**：限制一次选择多少条？
   - 建议：不限制，但超过 50 条时显示警告

5. **归档对话的存储位置**：是否从 localStorage 移除？
   - 建议：保留在 localStorage，仅标记为 archived=true
