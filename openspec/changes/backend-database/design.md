# Design: 后端数据库存储 + WebSocket 实时传输

## 架构决策

### 1. 数据库选择：SQLite

**理由**：
- ✅ 轻量级，无需额外服务器
- ✅ 与 Node.js 集成简单（better-sqlite3）
- ✅ 文件存储，备份方便
- ✅ 足够支撑单用户场景（对话数 < 10,000）

**替代方案**：
- PostgreSQL：功能强大，但部署复杂
- MongoDB：灵活，但需要额外服务
- MySQL：成熟，但配置繁琐

**最终选择**：SQLite（最佳平衡）

### 2. 实时通信：WebSocket

**理由**：
- ✅ 已有 WebSocket 基础（用于 API 调用）
- ✅ 双向通信，实时性好
- ✅ 断线重连机制成熟
- ✅ 节省 HTTP 请求开销

**消息类型扩展**：
```
现有：
- chat_request：发送聊天请求
- chat_response：接收聊天响应

新增：
- sync_conversations：同步对话列表
- sync_messages：同步消息历史
- create_conversation：创建新对话
- update_conversation：更新对话
- delete_conversation：删除对话
- network_status：网络状态通知
```

### 3. 离线处理：IndexedDB

**理由**：
- ✅ 浏览器原生支持
- ✅ 容量大（存储对话历史）
- ✅ 异步 API，不阻塞主线程
- ✅ 持久化存储，清除缓存不丢失

**流程**：
1. 发送消息时，先存 IndexedDB
2. WebSocket 发送成功后，删除 IndexedDB 记录
3. WebSocket 断开时，IndexedDB 作为离线队列
4. 重连后，从 IndexedDB 恢复未发送消息

## 技术选型

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| better-sqlite3 | 9.x | SQLite 数据库 |
| ws | 8.x | WebSocket 服务器 |
| express | 4.x | REST API |

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| idb | 7.x | IndexedDB 封装 |
| ReconnectingWebSocket | 4.x | WebSocket 自动重连 |

## 数据库设计

### 表结构

#### conversations 表
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  model TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  archived BOOLEAN DEFAULT 0,
  folder_id INTEGER,
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);
```

#### messages 表
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

#### folders 表
```sql
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT,
  created_at INTEGER
);
```

#### tags 表
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT,
  created_at INTEGER
);
```

#### conversation_tags 表
```sql
CREATE TABLE conversation_tags (
  conversation_id INTEGER,
  tag_id INTEGER,
  PRIMARY KEY (conversation_id, tag_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

## WebSocket 消息协议

### 消息格式
```json
{
  "type": "message_type",
  "data": { ... },
  "timestamp": 1234567890,
  "request_id": "uuid" // 用于追踪
}
```

### 消息类型

#### 1. 同步对话列表
```json
// 客户端请求
{
  "type": "sync_conversations",
  "data": {}
}

// 服务器响应
{
  "type": "sync_conversations",
  "data": {
    "conversations": [...]
  },
  "request_id": "uuid"
}
```

#### 2. 创建对话
```json
// 客户端请求
{
  "type": "create_conversation",
  "data": {
    "title": "新对话",
    "model": "gpt-4o"
  }
}

// 服务器响应
{
  "type": "create_conversation",
  "data": {
    "id": 1,
    "title": "新对话",
    ...
  },
  "request_id": "uuid"
}
```

#### 3. 发送消息
```json
// 客户端请求
{
  "type": "chat_request",
  "data": {
    "conversation_id": 1,
    "model": "gpt-4o",
    "content": "你好",
    "thinking": false
  }
}

// 服务器响应（流式）
{
  "type": "chat_response",
  "data": {
    "conversation_id": 1,
    "content": "你好！",
    "done": false
  }
}
```

## 重连机制

### 指数退避策略
```
第1次：立即重连
第2次：1秒后
第3次：2秒后
第4次：4秒后
第5次：8秒后
最大：30秒
```

### 重连流程
```
1. WebSocket 断开
2. 显示"连接中断"提示
3. 指数退避重连
4. 重连成功后：
   - 同步对话列表
   - 发送 IndexedDB 中的离线消息
5. 更新网络状态 UI
```

## 安全考虑

### 1. 数据隔离
- 每个用户独立数据库文件
- 文件名：`/data/{user_id}.db`

### 2. WebSocket 认证
- 连接时验证 token
- 无效 token 断开连接

### 3. 数据加密
- 数据库文件加密（SQLCipher）
- WebSocket TLS（已有）

## 性能优化

### 1. 分页加载
- 对话列表：每页 50 条
- 消息历史：每页 100 条

### 2. 消息压缩
- 大文本消息压缩（gzip）
- WebSocket 消息压缩

### 3. 索引优化
- messages 表：conversation_id + created_at
- conversations 表：updated_at

## 风险分析

### 高风险
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 数据库文件损坏 | 数据丢失 | 定期备份 + WAL 模式 |
| WebSocket 频繁断开 | 用户体验差 | 离线队列 + 重连机制 |

### 中风险
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| IndexedDB 容量限制 | 无法存储 | 定期清理已发送消息 |
| 网络延迟 | UI 卡顿 | Loading 提示 + 节流 |

## 迁移计划

### Phase 1：后端数据库
- 安装 SQLite
- 创建表结构
- 实现 CRUD API

### Phase 2：WebSocket 扩展
- 扩展消息类型
- 实现同步逻辑
- 测试重连机制

### Phase 3：前端迁移
- 移除 localStorage
- 实现 IndexedDB
- 集成 WebSocket 同步

### Phase 4：离线处理
- 实现离线队列
- 网络状态监控
- 测试恢复机制

## 参考资料

- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [WebSocket 协议](https://datatracker.ietf.org/doc/html/rfc6455)