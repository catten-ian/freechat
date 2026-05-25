// useChat.js - WebSocket 聊天 Hook

import { useState, useEffect, useCallback, useRef } from 'react'
import { getStorageAdapter, MESSAGE_TYPES } from '../utils/storage_adapter'

export function useChat() {
  const [conversations, setConversations] = useState([])
  const [currentConversation, setCurrentConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  
  const storageAdapter = useRef(null)
  const streamingContentRef = useRef('')

  // 初始化
  useEffect(() => {
    storageAdapter.current = getStorageAdapter()
    
    // 监听连接状态
    storageAdapter.current.on('connected', () => {
      setIsOnline(true)
      loadConversations()
    })
    
    storageAdapter.current.on('disconnected', () => {
      setIsOnline(false)
    })
    
    // 监听 AI 响应
    storageAdapter.current.on('chat_response', (data) => {
      if (data.done) {
        // 流式响应完成
        setLoading(false)
        streamingContentRef.current = ''
      } else {
        // 流式响应进行中
        streamingContentRef.current += data.content
        
        // 更新消息列表
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage?.role === 'assistant' && lastMessage?.streaming) {
            // 更新最后一条消息
            return [...prev.slice(0, -1), {
              ...lastMessage,
              content: streamingContentRef.current
            }]
          } else {
            // 添加新的 AI 消息
            return [...prev, {
              id: Date.now(),
              role: 'assistant',
              content: data.content,
              streaming: true,
              created_at: Date.now()
            }]
          }
        })
      }
    })
    
    // 监听错误
    storageAdapter.current.on('error', (err) => {
      setError(err.message)
      setLoading(false)
    })
    
    // 监听对话创建
    storageAdapter.current.on('conversation_created', (conversation) => {
      setConversations(prev => [conversation, ...prev])
    })
    
    // 监听对话更新
    storageAdapter.current.on('conversation_updated', (conversation) => {
      setConversations(prev => 
        prev.map(c => c.id === conversation.id ? conversation : c)
      )
    })
    
    // 监听对话删除
    storageAdapter.current.on('conversation_deleted', (id) => {
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversation?.id === id) {
        setCurrentConversation(null)
        setMessages([])
      }
    })
    
    // 初始加载对话列表
    setTimeout(loadConversations, 500)
    
    return () => {
      storageAdapter.current?.disconnect()
    }
  }, [])

  // 加载对话列表
  const loadConversations = useCallback(() => {
    if (!storageAdapter.current) return
    
    storageAdapter.current.getConversations(({ conversations }) => {
      setConversations(conversations || [])
      
      // 如果没有当前对话，选择第一个
      if (!currentConversation && conversations?.length > 0) {
        selectConversation(conversations[0])
      }
    })
  }, [currentConversation])

  // 选择对话
  const selectConversation = useCallback((conversation) => {
    setCurrentConversation(conversation)
    
    // 加载消息历史
    if (storageAdapter.current) {
      storageAdapter.current.getMessages(conversation.id, ({ messages }) => {
        setMessages(messages || [])
      })
    }
  }, [])

  // 创建新对话
  const createConversation = useCallback((title, model) => {
    if (!storageAdapter.current) return
    
    storageAdapter.current.createConversation(title, model, ({ conversation }) => {
      setCurrentConversation(conversation)
      setMessages([])
      setConversations(prev => [conversation, ...prev])
    })
  }, [])

  // 更新对话
  const updateConversation = useCallback((id, updates) => {
    if (!storageAdapter.current) return
    
    storageAdapter.current.updateConversation(id, updates, ({ conversation }) => {
      setConversations(prev =>
        prev.map(c => c.id === id ? conversation : c)
      )
    })
  }, [])

  // 删除对话
  const deleteConversation = useCallback((id) => {
    if (!storageAdapter.current) return
    
    storageAdapter.current.deleteConversation(id, () => {
      setConversations(prev => prev.filter(c => c.id !== id))
      
      if (currentConversation?.id === id) {
        setCurrentConversation(null)
        setMessages([])
      }
    })
  }, [currentConversation])

  // 发送消息
  const sendMessage = useCallback((content, model, thinking = false) => {
    if (!storageAdapter.current || !currentConversation) return
    
    // 添加用户消息
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content,
      created_at: Date.now()
    }
    
    setMessages(prev => [...prev, userMessage])
    setLoading(true)
    setError(null)
    
    // 发送到后端
    storageAdapter.current.sendChatRequest(
      currentConversation.id,
      model,
      content,
      thinking
    )
  }, [currentConversation])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    error,
    isOnline,
    
    // 操作方法
    loadConversations,
    selectConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    sendMessage,
    clearError
  }
}