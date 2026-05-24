## Why

当前小喵AI助手已具备基础对话功能，但缺少高级侧栏交互能力：
1. **对话搜索功能缺失**：用户无法快速查找历史对话内容
2. **对话分组管理不完善**：没有标签/文件夹等分类机制
3. **批量操作受限**：无法多选删除、批量移动对话
4. **侧栏视觉体验不佳**：对话列表信息密度低，缺少视觉层次

这些问题影响用户管理大量对话的效率，尤其是在长期使用后对话数量累积的场景下。

## What Changes

### 新增功能
- ✅ **对话搜索**：支持关键词搜索对话标题和内容
- ✅ **对话分组**：支持自定义标签和文件夹分类
- ✅ **批量操作**：多选删除、批量移动、批量归档
- ✅ **视觉优化**：对话卡片增加预览、时间戳、标签显示

### 改进功能
- ✅ **侧栏折叠动画优化**：平滑过渡动画
- ✅ **对话列表滚动性能优化**：虚拟滚动支持长列表
- ✅ **移动端适配优化**：侧栏手势操作

## Capabilities

### New Capabilities
- `conversation-search`: 对话搜索功能（关键词搜索标题和内容）
- `conversation-groups`: 对话分组管理（标签和文件夹系统）
- `batch-operations`: 批量操作功能（多选删除、移动、归档）
- `sidebar-visual-enhancement`: 侧栏视觉优化（预览、标签、时间显示）

### Modified Capabilities
- `conversation-management`: 扩展对话管理能力（增加分组和批量操作）

## Impact

### 前端代码影响
- `App.jsx`: 增加搜索、分组、批量操作组件
- `App.css`: 新增侧栏样式和动画
- 状态管理：新增 `searchQuery`, `groups`, `selectedConversations` 等状态

### 后端 API 影响
- `server.js`: 新增 API 端点
  - `GET /api/conversations/search?q=keyword`
  - `POST /api/conversations/batch-delete`
  - `POST /api/conversations/batch-move`
  - `GET/POST /api/groups`

### 数据结构影响
- 对话数据增加 `tags`, `folderId`, `archived` 字段
- 新增 `groups` 数据存储（文件夹和标签）

### 性能影响
- 长列表需考虑虚拟滚动
- 搜索需考虑性能优化（索引或缓存）