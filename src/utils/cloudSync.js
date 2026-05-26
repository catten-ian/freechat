// cloudSync.js - 云端同步层（纯 REST，不依赖 WebSocket）
//
// 设计理念：localStorage 仍是主存储，云端是镜像备份
// - 开关关闭时：完全使用 localStorage（行为不变）
// - 开关打开时：localStorage + 云端双写
//
// 与服务器交互全部走 REST API（/api/db/*）。
// WebSocket /api/ws 是聊天专用，云端同步不需要。

const API_BASE = (typeof window !== 'undefined' && window.location.pathname.startsWith('/ai/')) ? '/ai' : ''

const SYNC_ENABLED_KEY = 'freechat_cloud_sync_enabled'
const SYNC_ID_MAP_KEY = 'freechat_cloud_id_map'
const HEALTH_CACHE_MS = 10000

let lastHealthOk = false
let lastHealthAt = 0
let healthListeners = new Set()
let healthTimer = null
let lastSyncedMessageCount = new Map()

// ============ 开关 ============

export function isSyncEnabled() {
  return localStorage.getItem(SYNC_ENABLED_KEY) === 'true'
}

export function setSyncEnabled(enabled) {
  localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  if (enabled) {
    initSync()
  } else {
    if (healthTimer) {
      clearInterval(healthTimer)
      healthTimer = null
    }
    lastHealthOk = false
    notifyHealth(false)
  }
}

// ============ 健康检查 ============

async function checkHealth(force = false) {
  const now = Date.now()
  if (!force && now - lastHealthAt < HEALTH_CACHE_MS) {
    return lastHealthOk
  }
  lastHealthAt = now

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${API_BASE}/api/db/conversations?limit=1`, { signal: ctrl.signal })
    clearTimeout(timer)
    const ok = r.ok
    if (ok !== lastHealthOk) {
      lastHealthOk = ok
      notifyHealth(ok)
    }
    return ok
  } catch (e) {
    if (lastHealthOk) {
      lastHealthOk = false
      notifyHealth(false)
    }
    return false
  }
}

function notifyHealth(ok) {
  healthListeners.forEach(fn => {
    try { fn(ok) } catch {}
  })
}

export function initSync() {
  if (!isSyncEnabled()) return false
  if (healthTimer) return true

  checkHealth(true)
  healthTimer = setInterval(() => checkHealth(true), 15000)
  return true
}

export function isOnline() {
  return lastHealthOk
}

export function onHealthChange(listener) {
  healthListeners.add(listener)
  return () => healthListeners.delete(listener)
}

// ============ ID 映射 ============

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

// ============ CRUD（增量同步钩子） ============

export async function syncCreateConversation(conversation) {
  if (!isSyncEnabled() || !isOnline()) return
  try {
    const r = await fetch(`${API_BASE}/api/db/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: conversation.title,
        model: conversation.model || 'gpt-4o'
      })
    })
    const data = await r.json()
    if (data?.conversation?.id) {
      setCloudId(conversation.id, data.conversation.id)
      console.log(`☁️  云端创建: local=${conversation.id} -> cloud=${data.conversation.id}`)
    }
  } catch (e) {
    console.warn('云端创建失败:', e.message)
  }
}

export async function syncUpdateConversation(localId, updates) {
  if (!isSyncEnabled() || !isOnline()) return
  const cloudId = getCloudId(localId)
  if (!cloudId) return

  const metaUpdates = {}
  if (updates.title !== undefined) metaUpdates.title = updates.title
  if (updates.archived !== undefined) metaUpdates.archived = updates.archived
  if (updates.folderId !== undefined) metaUpdates.folder_id = updates.folderId
  if (Object.keys(metaUpdates).length === 0) return

  try {
    await fetch(`${API_BASE}/api/db/conversations/${cloudId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaUpdates)
    })
    console.log(`☁️  云端更新: cloud=${cloudId}`)
  } catch (e) {
    console.warn('云端更新失败:', e.message)
  }
}

export async function syncDeleteConversation(localId) {
  if (!isSyncEnabled() || !isOnline()) return
  const cloudId = getCloudId(localId)
  if (!cloudId) return

  try {
    await fetch(`${API_BASE}/api/db/conversations/${cloudId}`, { method: 'DELETE' })
    const map = getIdMap()
    delete map[localId]
    saveIdMap(map)
    console.log(`☁️  云端删除: cloud=${cloudId}`)
  } catch (e) {
    console.warn('云端删除失败:', e.message)
  }
}

export async function syncMessages(localId, messages) {
  if (!isSyncEnabled() || !isOnline()) return
  if (!messages || messages.length === 0) return
  const cloudId = getCloudId(localId)
  if (!cloudId) return

  const lastCount = lastSyncedMessageCount.get(localId) || 0
  const newMessages = messages.slice(lastCount)
  if (newMessages.length === 0) return

  try {
    for (const msg of newMessages) {
      if (!msg.role || !msg.content) continue
      await fetch(`${API_BASE}/api/db/conversations/${cloudId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        })
      })
    }
    lastSyncedMessageCount.set(localId, messages.length)
    console.log(`☁️  云端同步 ${newMessages.length} 条新消息: cloud=${cloudId}`)
  } catch (e) {
    console.warn('云端消息同步失败:', e.message)
  }
}

// ============ 备份管理（查看 / 全量推 / 跨设备恢复） ============

export async function fetchCloudConversations() {
  const r = await fetch(`${API_BASE}/api/db/conversations`)
  const data = await r.json()
  return data.conversations || []
}

export async function fetchCloudMessages(cloudId) {
  const r = await fetch(`${API_BASE}/api/db/conversations/${cloudId}/messages`)
  const data = await r.json()
  return data.messages || []
}

export async function pushAllToCloud(localConversations) {
  if (!isSyncEnabled()) throw new Error('云端同步未启用')

  let pushed = 0
  let skipped = 0
  let messagesPushed = 0
  const errors = []

  for (const conv of localConversations) {
    try {
      if (getCloudId(conv.id)) { skipped++; continue }

      const createRes = await fetch(`${API_BASE}/api/db/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: conv.title || '未命名对话',
          model: conv.model || 'gpt-4o'
        })
      })
      const createData = await createRes.json()
      if (!createData.success) { errors.push(`${conv.title}: 创建失败`); continue }

      const cloudId = createData.conversation.id
      setCloudId(conv.id, cloudId)
      pushed++

      const messages = conv.messages || []
      for (const msg of messages) {
        if (!msg.role || !msg.content) continue
        await fetch(`${API_BASE}/api/db/conversations/${cloudId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          })
        })
        messagesPushed++
      }
      lastSyncedMessageCount.set(conv.id, messages.length)
      console.log(`☁️  全量推送: ${conv.title} (${messages.length} 条消息)`)
    } catch (e) {
      errors.push(`${conv.title}: ${e.message}`)
    }
  }
  return { pushed, skipped, messagesPushed, errors }
}

export async function pullCloudConversation(cloudId) {
  const [convRes, msgsRes] = await Promise.all([
    fetch(`${API_BASE}/api/db/conversations`).then(r => r.json()),
    fetch(`${API_BASE}/api/db/conversations/${cloudId}/messages`).then(r => r.json())
  ])

  const cloudConv = (convRes.conversations || []).find(c => c.id === cloudId)
  if (!cloudConv) throw new Error('云端对话不存在')

  const localId = Date.now()
  const localConv = {
    id: localId,
    title: cloudConv.title,
    model: cloudConv.model,
    messages: (msgsRes.messages || []).map(m => ({ role: m.role, content: m.content })),
    tags: [],
    folderId: null,
    archived: Boolean(cloudConv.archived),
    createdAt: cloudConv.created_at || localId,
    updatedAt: cloudConv.updated_at || localId
  }

  setCloudId(localId, cloudId)
  lastSyncedMessageCount.set(localId, localConv.messages.length)
  return localConv
}
