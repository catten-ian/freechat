// ws_client.js - WebSocket 客户端

// 消息类型常量（与后端 ws_server.js 同步）
const MESSAGE_TYPES = {
  SYNC_CONVERSATIONS: 'sync_conversations',
  SYNC_MESSAGES: 'sync_messages',
  CREATE_CONVERSATION: 'create_conversation',
  UPDATE_CONVERSATION: 'update_conversation',
  DELETE_CONVERSATION: 'delete_conversation',
  CHAT_REQUEST: 'chat_request',
  CHAT_RESPONSE: 'chat_response',
  NETWORK_STATUS: 'network_status',
  ERROR: 'error'
}

class WebSocketClient {
  constructor(url) {
    this.url = url
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 30
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.requestCallbacks = new Map()
    this.listeners = new Map()
    this.isConnecting = false
    this.offlineQueue = []
  }

  // 连接 WebSocket
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.isConnecting = false
        
        // 发送离线队列中的消息
        this.flushOfflineQueue()
        
        // 通知连接状态
        this.emit('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Message parse error:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.emit('error', error)
      }

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected')
        this.isConnecting = false
        this.emit('disconnected')
        
        // 自动重连
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  // 安排重连
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      this.emit('max_reconnect_failed')
      return
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  // 处理消息
  handleMessage(message) {
    const { type, data, request_id } = message

    // 处理请求-响应匹配
    if (request_id && this.requestCallbacks.has(request_id)) {
      const callback = this.requestCallbacks.get(request_id)
      this.requestCallbacks.delete(request_id)
      callback(data)
      return
    }

    // 处理流式响应
    if (type === MESSAGE_TYPES.CHAT_RESPONSE) {
      this.emit('chat_response', data)
      return
    }

    // 处理其他消息
    this.emit(type, data)
  }

  // 发送消息
  send(type, data, callback = null) {
    const request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const message = {
      type,
      data,
      timestamp: Date.now(),
      request_id
    }

    // 如果未连接，加入离线队列
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, adding to offline queue')
      this.offlineQueue.push({ message, callback })
      return
    }

    // 注册回调
    if (callback) {
      this.requestCallbacks.set(request_id, callback)
    }

    // 发送消息
    this.ws.send(JSON.stringify(message))
  }

  // 发送离线队列
  flushOfflineQueue() {
    while (this.offlineQueue.length > 0) {
      const { message, callback } = this.offlineQueue.shift()
      
      if (callback) {
        this.requestCallbacks.set(message.request_id, callback)
      }
      
      this.ws.send(JSON.stringify(message))
    }
  }

  // 事件监听
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

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  // 获取连接状态
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // API 封装
  // 同步对话列表
  syncConversations(callback) {
    this.send(MESSAGE_TYPES.SYNC_CONVERSATIONS, {}, callback)
  }

  // 同步消息历史
  syncMessages(conversationId, callback) {
    this.send(MESSAGE_TYPES.SYNC_MESSAGES, { conversation_id: conversationId }, callback)
  }

  // 创建对话
  createConversation(title, model, callback) {
    this.send(MESSAGE_TYPES.CREATE_CONVERSATION, { title, model }, callback)
  }

  // 更新对话
  updateConversation(id, updates, callback) {
    this.send(MESSAGE_TYPES.UPDATE_CONVERSATION, { id, ...updates }, callback)
  }

  // 删除对话
  deleteConversation(id, callback) {
    this.send(MESSAGE_TYPES.DELETE_CONVERSATION, { id }, callback)
  }

  // 发送聊天请求
  sendChatRequest(conversationId, model, content, thinking = false) {
    this.send(MESSAGE_TYPES.CHAT_REQUEST, {
      conversation_id: conversationId,
      model,
      content,
      thinking
    })
  }
}

// 创建单例
let wsClient = null

export function getWSClient() {
  if (!wsClient) {
    // WebSocket URL（与 HTTP 服务器同一端口）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}`
    
    wsClient = new WebSocketClient(url)
    wsClient.connect()
  }
  
  return wsClient
}

export { MESSAGE_TYPES }