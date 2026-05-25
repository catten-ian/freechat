## 1. 项目结构调整

- [x] 1.1 创建组件目录结构（src/components/）
- [x] 1.2 创建 Hooks 目录（src/hooks/）
- [x] 1.3 创建工具函数目录（src/utils/）
- [x] 1.4 安装依赖包（react-window, @use-gesture/react）

## 2. 数据结构扩展

- [x] 2.1 扩展 localStorage 数据结构（添加 tags, folders, archived 字段）
- [x] 2.2 创建 storage.js 工具函数（读写 localStorage）
- [x] 2.3 数据迁移脚本（为现有对话添加默认值）

## 3. 搜索功能实现

- [x] 3.1 创建 useSearch Hook（搜索逻辑 + 防抖）
- [ ] 3.2 创建 SearchBar.jsx 组件（已集成到 Sidebar）
- [x] 3.3 实现标题搜索功能
- [x] 3.4 实现内容搜索功能
- [x] 3.5 搜索结果高亮显示
- [x] 3.6 搜索历史记录功能

## 4. 分组功能实现

- [ ] 4.1 创建 useConversations Hook（对话管理逻辑）
- [x] 4.2 创建文件夹管理功能（创建、删除、重命名）
- [x] 4.3 创建标签管理功能（创建、删除、颜色选择）
- [ ] 4.4 创建 FolderList.jsx 组件
- [ ] 4.5 创建 TagManager.jsx 组件
- [ ] 4.6 实现移动对话到文件夹功能
- [ ] 4.7 实现为对话添加标签功能
- [ ] 4.8 实现按文件夹/标签筛选功能

## 5. 批量操作功能实现

- [ ] 5.1 创建 useBatchSelect Hook（批量选择逻辑）
- [ ] 5.2 创建 BatchActions.jsx 组件（工具栏）
- [ ] 5.3 实现多选模式切换
- [ ] 5.4 实现全选/取消全选功能
- [ ] 5.5 实现批量删除功能（确认对话框）
- [ ] 5.6 实现批量移动到文件夹功能
- [ ] 5.7 实现批量归档/取消归档功能
- [ ] 5.8 实现批量添加标签功能

## 6. 视觉优化实现

- [x] 6.1 创建 ConversationCard.jsx 组件（已集成到 Sidebar）
- [x] 6.2 显示消息预览（最后一条消息前 30 字符）
- [x] 6.3 显示时间戳（今天/昨天/星期/日期）
- [x] 6.4 显示标签（彩色小圆点）
- [x] 6.5 侧栏折叠动画（300ms 过渡）
- [x] 6.6 空状态提示（欢迎提示/搜索无结果）
- [ ] 6.7 创建 ConversationList.jsx 组件（使用 react-window 虚拟滚动）

## 7. 移动端手势优化

- [ ] 7.1 集成 @use-gesture/react
- [ ] 7.2 实现左滑删除手势
- [ ] 7.3 实现右滑归档手势
- [ ] 7.4 实现长按进入多选模式
- [ ] 7.5 手势反馈动画

## 8. 后端 API 扩展

- [ ] 8.1 新增搜索 API（GET /api/conversations/search）
- [ ] 8.2 新增批量删除 API（POST /api/conversations/batch-delete）
- [ ] 8.3 新增批量移动 API（POST /api/conversations/batch-move）
- [ ] 8.4 新增文件夹管理 API（GET/POST /api/folders）
- [ ] 8.5 新增标签管理 API（GET/POST /api/tags）

## 9. 组件集成与重构

- [x] 9.1 将现有 App.jsx 侧栏代码迁移到 Sidebar.jsx
- [x] 9.2 在 App.jsx 中集成新组件
- [x] 9.3 保持现有功能不变（兼容性测试）
- [ ] 9.4 清理旧代码

## 10. 测试与优化

- [x] 10.1 本地功能测试（搜索、分组、批量操作）
- [ ] 10.2 性能测试（100+ 对话虚拟滚动）
- [ ] 10.3 移动端测试（Chrome, Safari, Firefox）
- [ ] 10.4 localStorage 容量监控功能
- [ ] 10.5 错误处理与边界情况

## 11. 部署与文档

- [x] 11.1 构建生产版本
- [x] 11.2 部署到服务器
- [x] 11.3 功能验证测试
- [ ] 11.4 更新项目 README
- [x] 11.5 提交 Git 变更
- [ ] 11.6 OpenSpec 归档（openspec archive）
