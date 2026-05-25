// storage.js - localStorage 操作工具函数

const STORAGE_KEY = 'freechat_data'

// 默认数据结构
const defaultData = {
  conversations: [],
  folders: [],
  tags: [],
  searchHistory: []
}

// 获取所有数据
export function getData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return { ...defaultData }

    const parsed = JSON.parse(data)
    // 合并默认值，确保新字段存在
    return {
      ...defaultData,
      ...parsed
    }
  } catch (e) {
    console.error('读取 localStorage 失败:', e)
    return { ...defaultData }
  }
}

// 保存所有数据
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('保存 localStorage 失败:', e)
    return false
  }
}

// 获取对话列表
export function getConversations() {
  return getData().conversations
}

// 保存对话列表
export function saveConversations(conversations) {
  const data = getData()
  data.conversations = conversations
  return saveData(data)
}

// 创建新对话
export function createConversation(title = '新对话', messages = []) {
  const data = getData()
  const id = Date.now()

  const conversation = {
    id,
    title,
    messages,
    tags: [],
    folderId: null,
    archived: false,
    createdAt: id,
    updatedAt: id
  }

  data.conversations.unshift(conversation)
  saveData(data)

  return conversation
}

// 更新对话
export function updateConversation(id, updates) {
  const data = getData()
  const index = data.conversations.findIndex(c => c.id === id)

  if (index === -1) return null

  data.conversations[index] = {
    ...data.conversations[index],
    ...updates,
    updatedAt: Date.now()
  }

  saveData(data)
  return data.conversations[index]
}

// 删除对话
export function deleteConversation(id) {
  const data = getData()
  data.conversations = data.conversations.filter(c => c.id !== id)
  return saveData(data)
}

// 批量删除对话
export function batchDeleteConversations(ids) {
  const data = getData()
  data.conversations = data.conversations.filter(c => !ids.includes(c.id))
  return saveData(data)
}

// 搜索对话
export function searchConversations(query) {
  const data = getData()
  const lowerQuery = query.toLowerCase()

  return data.conversations.filter(c => {
    // 搜索标题
    if (c.title.toLowerCase().includes(lowerQuery)) return true

    // 搜索消息内容
    return c.messages.some(m =>
      m.content.toLowerCase().includes(lowerQuery)
    )
  })
}

// 文件夹管理
export function createFolder(name, color = '#667eea') {
  const data = getData()
  const id = Date.now()

  const folder = {
    id,
    name,
    color,
    createdAt: id
  }

  data.folders.push(folder)
  saveData(data)

  return folder
}

export function deleteFolder(id) {
  const data = getData()

  // 移动文件夹内的对话到根目录
  data.conversations = data.conversations.map(c =>
    c.folderId === id ? { ...c, folderId: null } : c
  )

  // 删除文件夹
  data.folders = data.folders.filter(f => f.id !== id)

  return saveData(data)
}

// 标签管理
export function createTag(name, color = '#22d3ee') {
  const data = getData()
  const id = Date.now()

  const tag = {
    id,
    name,
    color,
    createdAt: id
  }

  data.tags.push(tag)
  saveData(data)

  return tag
}

export function deleteTag(id) {
  const data = getData()

  // 从所有对话中移除该标签
  data.conversations = data.conversations.map(c => ({
    ...c,
    tags: c.tags.filter(t => t !== id)
  }))

  // 删除标签
  data.tags = data.tags.filter(t => t.id !== id)

  return saveData(data)
}

// 搜索历史
export function addSearchHistory(query) {
  const data = getData()

  // 移除重复项
  data.searchHistory = data.searchHistory.filter(h => h !== query)

  // 添加到开头
  data.searchHistory.unshift(query)

  // 最多保留 10 条
  if (data.searchHistory.length > 10) {
    data.searchHistory = data.searchHistory.slice(0, 10)
  }

  return saveData(data)
}

export function getSearchHistory() {
  return getData().searchHistory
}

export function clearSearchHistory() {
  const data = getData()
  data.searchHistory = []
  return saveData(data)
}

// 数据迁移：为现有对话添加新字段
export function migrateData() {
  const data = getData()

  data.conversations = data.conversations.map(c => ({
    ...c,
    tags: c.tags || [],
    folderId: c.folderId || null,
    archived: c.archived || false
  }))

  return saveData(data)
}

// 初始化时执行迁移
migrateData()
