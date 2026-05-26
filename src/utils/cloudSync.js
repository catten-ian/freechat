// cloudSync.js - 云端同步层（包装现有 localStorage 操作）
//
// 设计理念：localStorage 仍是主存储，云端是镜像备份
// - 开关关闭时：完全使用 localStorage（行为不变）
// - 开关打开时：localStorage + 云端双写，保证向后兼容

import { getStorageAdapter } from './storage_adapter'

const SYNC_ENABLED_KEY = 'freechat_cloud_sync_enabled'
const SYNC_ID_MAP_KEY = 'freechat_cloud_id_map' // 本地 id -> 云端 id 映射

let adapter = null
let initialized = false

// 获取同步开关状态
export function isSyncEnabled() {
  return localStorage.getItem(SYNC_ENABLED_KEY) === 'true'
}

// 设置同步开关
export function setSyncEnabled(enabled) {
  localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  if (enabled) {
    initSync()
  }
}

// 初始化同步
export function initSync() {
  if (initialized) return adapter
  if (!isSyncEnabled()) return null
  
  adapter = getStorageAdapter()
  initialized = true
  return adapter
}

// 获取连接状态
export function isOnline() {
  return adapter?.isOnline() || false
}

// ID 映射管理
function getIdMap() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_ID_MAP_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveIdMap(map) {
  localStorage.setItem(SYNC_ID_MAP_KEY, JSON.stringify(map))
}

function setCloudId(localId, cloudId) {
  const map = getIdMap()
  map[localId] = cloudId
  saveIdMap(map)
}

function getCloudId(localId) {
  return getIdMap()[localId]
}

// ============ 包装方法（与原 storage.js API 一致）============

// 同步创建对话到云端
export function syncCreateConversation(conversation) {
  if (!isSyncEnabled() || !adapter || !adapter.isOnline()) return
  
  adapter.createConversation(
    conversation.title,
    conversation.model || 'gpt-4o',
    ({ conversation: cloudConv }) => {
      if (cloudConv?.id) {
        setCloudId(conversation.id, cloudConv.id)
        console.log(`☁️  云端创建对话: local=${conversation.id} -> cloud=${cloudConv.id}`)
      }
    }
  )
}

// 同步更新对话到云端
export function syncUpdateConversation(localId, updates) {
  if (!isSyncEnabled() || !adapter || !adapter.isOnline()) return
  
  const cloudId = getCloudId(localId)
  if (!cloudId) return // 未同步过，跳过
  
  // 只同步元数据（title, archived, folder_id），消息单独同步
  const metaUpdates = {}
  if (updates.title !== undefined) metaUpdates.title = updates.title
  if (updates.archived !== undefined) metaUpdates.archived = updates.archived
  if (updates.folderId !== undefined) metaUpdates.folder_id = updates.folderId
  
  if (Object.keys(metaUpdates).length > 0) {
    adapter.updateConversation(cloudId, metaUpdates, () => {
      console.log(`☁️  云端更新对话: cloud=${cloudId}`)
    })
  }
}

// 同步删除对话到云端
export function syncDeleteConversation(localId) {
  if (!isSyncEnabled() || !adapter || !adapter.isOnline()) return
  
  const cloudId = getCloudId(localId)
  if (!cloudId) return
  
  adapter.deleteConversation(cloudId, () => {
    console.log(`☁️  云端删除对话: cloud=${cloudId}`)
    // 清理映射
    const map = getIdMap()
    delete map[localId]
    saveIdMap(map)
  })
}

// 同步新消息到云端（增量）
let lastSyncedMessageCount = new Map() // localId -> 已同步的消息数

export function syncMessages(localId, messages) {
  if (!isSyncEnabled() || !adapter || !adapter.isOnline()) return
  if (!messages || messages.length === 0) return
  
  const cloudId = getCloudId(localId)
  if (!cloudId) return
  
  // 只同步新增的消息
  const lastCount = lastSyncedMessageCount.get(localId) || 0
  const newMessages = messages.slice(lastCount)
  
  if (newMessages.length === 0) return
  
  // 通过 REST API 批量添加消息（避免触发 AI 回复）
  newMessages.forEach((msg, idx) => {
    if (!msg.role || !msg.content) return
    
    fetch(`/api/db/conversations/${cloudId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })
    }).then(() => {
      if (idx === newMessages.length - 1) {
        lastSyncedMessageCount.set(localId, messages.length)
        console.log(`☁️  云端同步 ${newMessages.length} 条新消息: cloud=${cloudId}`)
      }
    }).catch(err => {
      console.warn('云端消息同步失败:', err.message)
    })
  })
}

// 获取云端对话列表（用于"恢复云端备份"功能）
export function fetchCloudConversations() {
  return new Promise((resolve, reject) => {
    if (!isSyncEnabled() || !adapter) {
      reject(new Error('云端同步未启用'))
      return
    }
    
    if (!adapter.isOnline()) {
      // 用 REST API 兜底
      fetch('/api/db/conversations')
        .then(r => r.json())
        .then(data => resolve(data.conversations || []))
        .catch(reject)
      return
    }
    
    adapter.getConversations(({ conversations }) => {
      resolve(conversations || [])
    })
  })
}

// 获取云端消息（用于恢复某个对话）
export function fetchCloudMessages(cloudId) {
  return fetch(`/api/db/conversations/${cloudId}/messages`)
    .then(r => r.json())
    .then(data => data.messages || [])
}

// 首次全量同步：把本地所有对话推送到云端
export async function pushAllToCloud(localConversations) {
  if (!isSyncEnabled() || !adapter) {
    throw new Error('云端同步未启用')
  }
  
  let pushed = 0
  let skipped = 0
  let messagesPushed = 0
  const errors = []
  
  for (const conv of localConversations) {
    try {
      // 已映射过的跳过
      if (getCloudId(conv.id)) {
        skipped++
        continue
      }
      
      // 1. 创建云端对话（用 REST 同步，便于按序）
      const createRes = await fetch('/api/db/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: conv.title || '未命名对话',
          model: conv.model || 'gpt-4o'
        })
      })
      const createData = await createRes.json()
      
      if (!createData.success) {
        errors.push(`${conv.title}: 创建失败`)
        continue
      }
      
      const cloudId = createData.conversation.id
      setCloudId(conv.id, cloudId)
      pushed++
      
      // 2. 推送所有历史消息
      const messages = conv.messages || []
      for (const msg of messages) {
        if (!msg.role || !msg.content) continue
        
        await fetch(`/api/db/conversations/${cloudId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          })
        })
        messagesPushed++
      }
      
      // 标记已同步的消息数
      lastSyncedMessageCount.set(conv.id, messages.length)
      
      console.log(`☁️  全量推送: ${conv.title} (${messages.length} 条消息)`)
    } catch (e) {
      errors.push(`${conv.title}: ${e.message}`)
    }
  }
  
  return { pushed, skipped, messagesPushed, errors }
}

// 跨设备恢复：从云端拉取一个对话到本地格式
export async function pullCloudConversation(cloudId) {
  const [convRes, msgsRes] = await Promise.all([
    fetch(`/api/db/conversations`).then(r => r.json()),
    fetch(`/api/db/conversations/${cloudId}/messages`).then(r => r.json())
  ])
  
  const cloudConv = (convRes.conversations || []).find(c => c.id === cloudId)
  if (!cloudConv) throw new Error('云端对话不存在')
  
  // 转为本地格式（与 storage.js createConversation 一致）
  const localId = Date.now()
  const localConv = {
    id: localId,
    title: cloudConv.title,
    model: cloudConv.model,
    messages: (msgsRes.messages || []).map(m => ({
      role: m.role,
      content: m.content
    })),
    tags: [],
    folderId: null,
    archived: Boolean(cloudConv.archived),
    createdAt: cloudConv.created_at || localId,
    updatedAt: cloudConv.updated_at || localId
  }
  
  // 建立映射，避免下次重复推送
  setCloudId(localId, cloudId)
  lastSyncedMessageCount.set(localId, localConv.messages.length)
  
  return localConv
}