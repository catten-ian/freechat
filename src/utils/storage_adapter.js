// storage_adapter.js - 存储适配器（localStorage + WebSocket）

import { getWSClient, MESSAGE_TYPES } from './ws_client.js'

// 存储模式
const STORAGE_MODE = {
  LOCAL: 'local',    // localStorage（离线模式）
  REMOTE: 'remote'   // WebSocket + SQLite（在线模式）
}

class StorageAdapter {
  constructor() {
    this.wsClient = null
    this.mode = STORAGE_MODE.LOCAL
    this.syncEnabled = false
  }

  // 初始化
  init() {
    this.wsClient = getWSClient()

    // 监听连接状态
    this.wsClient.on('connected', () => {
      this.mode = STORAGE_MODE.REMOTE
      this.syncEnabled = true
      console.log('✅ Remote storage enabled')
    })

    this.wsClient.on('disconnected', () => {
      this.mode = STORAGE_MODE.LOCAL
      this.syncEnabled = false
      console.log('⚠️  Offline mode, using localStorage')
    })

    // 监听服务器推送的更新
    this.wsClient.on(MESSAGE_TYPES.CREATE_CONVERSATION, (data) => {
      if (data.conversation) {
        this.emit('conversation_created', data.conversation)
      }
    })

    this.wsClient.on(MESSAGE_TYPES.UPDATE_CONVERSATION, (data) => {
      if (data.conversation) {
        this.emit('conversation_updated', data.conversation)
      }
    })

    this.wsClient.on(MESSAGE_TYPES.DELETE_CONVERSATION, (data) => {
      if (data.id) {
        this.emit('conversation_deleted', data.id)
      }
    })
  }

  // 获取存储模式
  getMode() {
    return this.mode
  }

  // 是否在线
  isOnline() {
    return this.mode === STORAGE_MODE.REMOTE
  }

  // ========== 对话管理 ==========

  // 获取对话列表
  getConversations(callback) {
    if (this.isOnline()) {
      this.wsClient.syncConversations(callback)
    } else {
      // 离线模式：从 localStorage 获取
      const conversations = this.getLocalConversations()
      callback({ conversations })
    }
  }

  // 创建对话
  createConversation(title, model, callback) {
    if (this.isOnline()) {
      this.wsClient.createConversation(title, model, callback)
    } else {
      // 离线模式：保存到 localStorage
      const conversation = this.createLocalConversation(title, model)
      callback({ conversation })
    }
  }

  // 更新对话
  updateConversation(id, updates, callback) {
    if (this.isOnline()) {
      this.wsClient.updateConversation(id, updates, callback)
    } else {
      // 离线模式：更新 localStorage
      const conversation = this.updateLocalConversation(id, updates)
      callback({ conversation })
    }
  }

  // 删除对话
  deleteConversation(id, callback) {
    if (this.isOnline()) {
      this.wsClient.deleteConversation(id, callback)
    } else {
      // 离线模式：从 localStorage 删除
      this.deleteLocalConversation(id)
      callback({ id })
    }
  }

  // ========== 消息管理 ==========

  // 获取消息历史
  getMessages(conversationId, callback) {
    if (this.isOnline()) {
      this.wsClient.syncMessages(conversationId, callback)
    } else {
      // 离线模式：从 localStorage 获取
      const messages = this.getLocalMessages(conversationId)
      callback({ messages })
    }
  }

  // ========== 聊天功能 ==========

  // 发送聊天请求
  sendChatRequest(conversationId, model, content, thinking = false) {
    if (this.isOnline()) {
      this.wsClient.sendChatRequest(conversationId, model, content, thinking)
    } else {
      // 离线模式：无法发送
      console.warn('Offline mode, cannot send chat request')
      this.emit('error', { message: '离线模式，无法发送消息' })
    }
  }

  // ========== localStorage 操作（离线模式） ==========

  // 从 localStorage 获取对话列表
  getLocalConversations() {
    const data = localStorage.getItem('freechat_offline_data')
    if (!data) return []
    
    try {
      return JSON.parse(data).conversations || []
    } catch {
      return []
    }
  }

  // 创建本地对话
  createLocalConversation(title, model) {
    const conversations = this.getLocalConversations()
    const id = Date.now()
    
    const conversation = {
      id,
      title,
      model,
      messages: [],
      createdAt: id,
      updatedAt: id
    }
    
    conversations.unshift(conversation)
    localStorage.setItem('freechat_offline_data', JSON.stringify({ conversations }))
    
    return conversation
  }

  // 更新本地对话
  updateLocalConversation(id, updates) {
    const conversations = this.getLocalConversations()
    const index = conversations.findIndex(c => c.id === id)
    
    if (index === -1) return null
    
    conversations[index] = {
      ...conversations[index],
      ...updates,
      updatedAt: Date.now()
    }
    
    localStorage.setItem('freechat_offline_data', JSON.stringify({ conversations }))
    
    return conversations[index]
  }

  // 删除本地对话
  deleteLocalConversation(id) {
    const conversations = this.getLocalConversations()
    const filtered = conversations.filter(c => c.id !== id)
    localStorage.setItem('freechat_offline_data', JSON.stringify({ conversations: filtered }))
  }

  // 从 localStorage 获取消息
  getLocalMessages(conversationId) {
    const conversations = this.getLocalConversations()
    const conversation = conversations.find(c => c.id === conversationId)
    return conversation?.messages || []
  }

  // ========== 事件系统 ==========

  listeners = new Map()

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(listener)
  }

  off(event, listener) {
    if (!this.listeners.has(event)) return
    const listeners = this.listeners.get(event)
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return
    this.listeners.get(event).forEach(listener => listener(data))
  }
}

// 创建单例
let storageAdapter = null

export function getStorageAdapter() {
  if (!storageAdapter) {
    storageAdapter = new StorageAdapter()
    storageAdapter.init()
  }
  
  return storageAdapter
}