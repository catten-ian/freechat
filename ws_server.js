import { WebSocketServer } from 'ws';
import db from './database.js';

// 消息类型常量
const MESSAGE_TYPES = {
  // 同步类
  SYNC_CONVERSATIONS: 'sync_conversations',
  SYNC_MESSAGES: 'sync_messages',
  
  // 对话管理类
  CREATE_CONVERSATION: 'create_conversation',
  UPDATE_CONVERSATION: 'update_conversation',
  DELETE_CONVERSATION: 'delete_conversation',
  
  // 聊天类
  CHAT_REQUEST: 'chat_request',
  CHAT_RESPONSE: 'chat_response',
  
  // 网络状态类
  NETWORK_STATUS: 'network_status',
  
  // 错误类
  ERROR: 'error'
};

// API 配置（从 server.js 复制）
const APIs = {
  hizui: {
    url: 'https://newapi.hizui.cn/v1/chat/completions',
    key: 'sk-gsM3EdexRXhdqhWxltk9mRdK58sD4HZI4IPlNlCPkafy9pPh'
  },
  siliconflow: {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    key: 'sk-vplbeiffbvyoajpnzzkhkdxfccogdsypmmjtqzuhjhzdqezk'
  },
  venice: {
    url: 'https://api.venice.ai/api/v1/chat/completions',
    key: 'VENICE_ADMIN_KEY_BGijBQCETUp1Xs_kq6ZgQdCYa2BH8Fn1G6811W4xpD'
  },
  venice_image: {
    url: 'https://api.venice.ai/api/v1/images/generations',
    key: 'VENICE_ADMIN_KEY_BGijBQCETUp1Xs_kq6ZgQdCYa2BH8Fn1G6811W4xpD'
  }
};

const MODEL_API_MAP = {
  'MiniMax-M2.5': 'hizui',
  'MiniMax-M2.7': 'hizui',
  'deepseek-ai/DeepSeek-V4-Flash': 'siliconflow',
  'claude-opus-4-7': 'venice',
  'gpt-5-5': 'venice',
  'deepseek-v4-pro': 'venice',
};

// WebSocket 消息处理器
class WSMessageHandler {
  constructor(ws) {
    this.ws = ws;
  }

  // 发送消息
  send(type, data, requestId = null) {
    const message = {
      type,
      data,
      timestamp: Date.now(),
      request_id: requestId
    };
    
    this.ws.send(JSON.stringify(message));
  }

  // 发送错误
  sendError(error, requestId = null) {
    this.send(MESSAGE_TYPES.ERROR, { error }, requestId);
  }

  // 处理消息
  async handleMessage(message) {
    try {
      const { type, data, request_id } = JSON.parse(message);
      
      switch (type) {
        case MESSAGE_TYPES.SYNC_CONVERSATIONS:
          await this.handleSyncConversations(data, request_id);
          break;
        
        case MESSAGE_TYPES.SYNC_MESSAGES:
          await this.handleSyncMessages(data, request_id);
          break;
        
        case MESSAGE_TYPES.CREATE_CONVERSATION:
          await this.handleCreateConversation(data, request_id);
          break;
        
        case MESSAGE_TYPES.UPDATE_CONVERSATION:
          await this.handleUpdateConversation(data, request_id);
          break;
        
        case MESSAGE_TYPES.DELETE_CONVERSATION:
          await this.handleDeleteConversation(data, request_id);
          break;
        
        case MESSAGE_TYPES.CHAT_REQUEST:
          await this.handleChatRequest(data, request_id);
          break;
        
        default:
          this.sendError(`Unknown message type: ${type}`, request_id);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      this.sendError(error.message);
    }
  }

  // 同步对话列表
  async handleSyncConversations(data, requestId) {
    const { limit = 50, offset = 0 } = data;
    
    const conversations = db.prepare(`
      SELECT c.*, 
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.archived = 0
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    this.send(MESSAGE_TYPES.SYNC_CONVERSATIONS, { conversations }, requestId);
  }

  // 同步消息历史
  async handleSyncMessages(data, requestId) {
    const { conversation_id, limit = 100, offset = 0 } = data;
    
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(conversation_id, limit, offset);
    
    this.send(MESSAGE_TYPES.SYNC_MESSAGES, { messages }, requestId);
  }

  // 创建对话
  async handleCreateConversation(data, requestId) {
    const { title, model = 'gpt-4o' } = data;
    const now = Date.now();
    
    const result = db.prepare(`
      INSERT INTO conversations (title, model, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(title, model, now, now);
    
    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(result.lastInsertRowid);
    
    this.send(MESSAGE_TYPES.CREATE_CONVERSATION, { conversation }, requestId);
  }

  // 更新对话
  async handleUpdateConversation(data, requestId) {
    const { id, title, archived, folder_id } = data;
    const now = Date.now();
    
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
    
    this.send(MESSAGE_TYPES.UPDATE_CONVERSATION, { conversation }, requestId);
  }

  // 删除对话
  async handleDeleteConversation(data, requestId) {
    const { id } = data;
    
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    
    this.send(MESSAGE_TYPES.DELETE_CONVERSATION, { id }, requestId);
  }

  // 处理聊天请求
  async handleChatRequest(data, requestId) {
    const { conversation_id, model, content, thinking = false } = data;
    const now = Date.now();
    
    // 保存用户消息到数据库
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(conversation_id, 'user', content, now);
    
    // 更新对话的 updated_at
    db.prepare(`
      UPDATE conversations 
      SET updated_at = ? 
      WHERE id = ?
    `).run(now, conversation_id);
    
    // 获取对话的所有消息作为上下文
    const messages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation_id);
    
    // 调用 AI API
    const apiName = MODEL_API_MAP[model] || 'hizui';
    const api = APIs[apiName];
    
    const requestBody = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    };
    
    // 处理思考模式
    if (thinking) {
      if (apiName === 'siliconflow') {
        requestBody.thinking = true;
      } else if (apiName === 'venice') {
        requestBody.reasoning = { enabled: true };
      }
    }
    
    try {
      const response = await fetch(api.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + api.key,
        },
        body: JSON.stringify(requestBody),
      });
      
      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                
                // 发送流式响应
                this.send(MESSAGE_TYPES.CHAT_RESPONSE, {
                  conversation_id,
                  content,
                  done: false
                }, requestId);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      // 保存 AI 回复到数据库
      const aiNow = Date.now();
      db.prepare(`
        INSERT INTO messages (conversation_id, role, content, created_at)
        VALUES (?, ?, ?, ?)
      `).run(conversation_id, 'assistant', fullContent, aiNow);
      
      // 更新对话的 updated_at
      db.prepare(`
        UPDATE conversations 
        SET updated_at = ? 
        WHERE id = ?
      `).run(aiNow, conversation_id);
      
      // 发送完成响应
      this.send(MESSAGE_TYPES.CHAT_RESPONSE, {
        conversation_id,
        content: '',
        done: true
      }, requestId);
      
    } catch (error) {
      console.error('AI API error:', error);
      this.sendError(error.message, requestId);
    }
  }
}

// 创建 WebSocket 服务器
export function createWSServer(server) {
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('✅ WebSocket client connected');
    
    const handler = new WSMessageHandler(ws);
    
    ws.on('message', (message) => {
      handler.handleMessage(message);
    });
    
    ws.on('close', () => {
      console.log('❌ WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // 发送连接成功通知
    handler.send(MESSAGE_TYPES.NETWORK_STATUS, { status: 'connected' });
  });
  
  return wss;
}

export { MESSAGE_TYPES };