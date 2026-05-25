import express from 'express';
import db from './database.js';

const router = express.Router();

// 获取对话列表
router.get('/conversations', (req, res) => {
  try {
    const { limit = 50, offset = 0, archived = 0 } = req.query;
    
    const conversations = db.prepare(`
      SELECT c.*, 
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.archived = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(Number(archived), Number(limit), Number(offset));

    res.json({ 
      success: true, 
      conversations 
    });
  } catch (error) {
    console.error('获取对话列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 创建对话
router.post('/conversations', (req, res) => {
  try {
    const { title, model = 'gpt-4o' } = req.body;
    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO conversations (title, model, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(title, model, now, now);

    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ 
      success: true, 
      conversation 
    });
  } catch (error) {
    console.error('创建对话失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 更新对话
router.put('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, archived, folder_id } = req.body;
    const now = Date.now();

    // 构建动态更新语句
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (archived !== undefined) {
      updates.push('archived = ?');
      values.push(Number(archived));
    }
    if (folder_id !== undefined) {
      updates.push('folder_id = ?');
      values.push(folder_id);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`
      UPDATE conversations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id);

    res.json({ 
      success: true, 
      conversation 
    });
  } catch (error) {
    console.error('更新对话失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 删除对话
router.delete('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;

    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);

    res.json({ 
      success: true 
    });
  } catch (error) {
    console.error('删除对话失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 获取消息历史
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(Number(id), Number(limit), Number(offset));

    res.json({ 
      success: true, 
      messages 
    });
  } catch (error) {
    console.error('获取消息历史失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 添加消息
router.post('/conversations/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const { role, content } = req.body;
    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(Number(id), role, content, now);

    // 更新对话的 updated_at
    db.prepare(`
      UPDATE conversations 
      SET updated_at = ? 
      WHERE id = ?
    `).run(now, Number(id));

    const message = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ 
      success: true, 
      message 
    });
  } catch (error) {
    console.error('添加消息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 获取文件夹列表
router.get('/folders', (req, res) => {
  try {
    const folders = db.prepare(`
      SELECT * FROM folders
      ORDER BY created_at DESC
    `).all();

    res.json({ 
      success: true, 
      folders 
    });
  } catch (error) {
    console.error('获取文件夹列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 创建文件夹
router.post('/folders', (req, res) => {
  try {
    const { name, color = '#3b82f6' } = req.body;
    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO folders (name, color, created_at)
      VALUES (?, ?, ?)
    `).run(name, color, now);

    const folder = db.prepare(`
      SELECT * FROM folders WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ 
      success: true, 
      folder 
    });
  } catch (error) {
    console.error('创建文件夹失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 获取标签列表
router.get('/tags', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT * FROM tags
      ORDER BY created_at DESC
    `).all();

    res.json({ 
      success: true, 
      tags 
    });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 创建标签
router.post('/tags', (req, res) => {
  try {
    const { name, color = '#10b981' } = req.body;
    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO tags (name, color, created_at)
      VALUES (?, ?, ?)
    `).run(name, color, now);

    const tag = db.prepare(`
      SELECT * FROM tags WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ 
      success: true, 
      tag 
    });
  } catch (error) {
    console.error('创建标签失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 为对话添加标签
router.post('/conversations/:id/tags', (req, res) => {
  try {
    const { id } = req.params;
    const { tag_id } = req.body;

    db.prepare(`
      INSERT OR IGNORE INTO conversation_tags (conversation_id, tag_id)
      VALUES (?, ?)
    `).run(Number(id), Number(tag_id));

    res.json({ 
      success: true 
    });
  } catch (error) {
    console.error('添加标签失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
