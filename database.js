import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库目录
const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// 数据库文件（单用户模式）
const DB_PATH = path.join(DB_DIR, 'chat.db');
const db = new Database(DB_PATH);

// 启用 WAL 模式（提高并发性能）
db.pragma('journal_mode = WAL');

// 创建表结构
const initSchema = db.transaction(() => {
  // conversations 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived BOOLEAN DEFAULT 0,
      folder_id INTEGER,
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    )
  `);

  // messages 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // folders 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // tags 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // conversation_tags 关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_tags (
      conversation_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (conversation_id, tag_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation 
    ON messages(conversation_id, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_updated 
    ON conversations(updated_at DESC)
  `);

  console.log('✅ 数据库表结构创建成功');
});

// 执行初始化
initSchema();

// 导出数据库实例
export default db;
