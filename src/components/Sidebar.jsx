// Sidebar.jsx - 侧栏组件

import { useState, useEffect } from 'react'
import { useSearch } from '../hooks/useSearch'
import {
  getConversations,
  createConversation,
  deleteConversation,
  updateConversation,
  createFolder,
  deleteFolder,
  createTag,
  deleteTag
} from '../utils/storage'

export function Sidebar({ onSelectConversation, currentConversationId }) {
  const [conversations, setConversations] = useState([])
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [editingTitle, setEditingTitle] = useState(null)
  const [editTitleValue, setEditTitleValue] = useState('')

  const {
    query,
    setQuery,
    results,
    searchHistory,
    isSearching,
    clearSearch,
    highlightMatch,
    hasResults
  } = useSearch(conversations)

  // 加载数据
  useEffect(() => {
    const data = getConversations()
    setConversations(data)

    // TODO: 加载文件夹和标签
  }, [])

  // 创建新对话
  const handleNewConversation = () => {
    const conversation = createConversation('新对话', [])
    setConversations([conversation, ...conversations])
    onSelectConversation(conversation)
  }

  // 删除对话
  const handleDelete = (id, e) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个对话吗？')) return

    deleteConversation(id)
    setConversations(conversations.filter(c => c.id !== id))
  }

  // 开始编辑标题
  const startEditTitle = (id, currentTitle, e) => {
    e.stopPropagation()
    setEditingTitle(id)
    setEditTitleValue(currentTitle)
  }

  // 保存编辑标题
  const saveEditTitle = (id) => {
    if (!editTitleValue.trim()) return

    updateConversation(id, { title: editTitleValue.trim() })
    setConversations(conversations.map(c =>
      c.id === id ? { ...c, title: editTitleValue.trim() } : c
    ))
    setEditingTitle(null)
  }

  // 创建文件夹
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return

    const folder = createFolder(newFolderName.trim())
    setFolders([...folders, folder])
    setNewFolderName('')
    setShowNewFolder(false)
  }

  // 创建标签
  const handleCreateTag = () => {
    if (!newTagName.trim()) return

    const tag = createTag(newTagName.trim())
    setTags([...tags, tag])
    setNewTagName('')
    setShowNewTag(false)
  }

  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  // 获取消息预览
  const getMessagePreview = (messages) => {
    if (!messages || messages.length === 0) return '暂无消息'

    const lastMessage = messages[messages.length - 1]
    const preview = lastMessage.content.slice(0, 30)
    return preview + (lastMessage.content.length > 30 ? '...' : '')
  }

  // 显示的对话列表（搜索结果或全部）
  const displayConversations = query.trim() ? results : conversations.filter(c => !c.archived)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={handleNewConversation}>
          ➕ 新建对话
        </button>
      </div>

      {/* 搜索栏 */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索对话..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {query && (
          <button className="clear-search" onClick={clearSearch}>
            ✕
          </button>
        )}
      </div>

      {/* 搜索历史 */}
      {!query && searchHistory.length > 0 && (
        <div className="search-history">
          {searchHistory.slice(0, 5).map((h, i) => (
            <button
              key={i}
              className="history-item"
              onClick={() => setQuery(h)}
            >
              🔍 {h}
            </button>
          ))}
        </div>
      )}

      {/* 文件夹和标签管理 */}
      <div className="sidebar-tools">
        <button onClick={() => setShowNewFolder(!showNewFolder)}>
          📁 新建文件夹
        </button>
        <button onClick={() => setShowNewTag(!showNewTag)}>
          🏷️ 新建标签
        </button>
      </div>

      {/* 新建文件夹输入框 */}
      {showNewFolder && (
        <div className="new-folder-input">
          <input
            type="text"
            placeholder="文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <button onClick={handleCreateFolder}>确定</button>
        </div>
      )}

      {/* 新建标签输入框 */}
      {showNewTag && (
        <div className="new-tag-input">
          <input
            type="text"
            placeholder="标签名称"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />
          <button onClick={handleCreateTag}>确定</button>
        </div>
      )}

      {/* 对话列表 */}
      <div className="conversation-list">
        {isSearching && <div className="searching">搜索中...</div>}

        {query && !hasResults && !isSearching && (
          <div className="no-results">未找到匹配的对话</div>
        )}

        {!query && displayConversations.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-text">暂无对话</div>
            <div className="empty-hint">点击上方按钮新建对话</div>
          </div>
        )}

        {displayConversations.map(conv => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv)}
          >
            {editingTitle === conv.id ? (
              <input
                className="edit-title-input"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={() => saveEditTitle(conv.id)}
                onKeyDown={(e) => e.key === 'Enter' && saveEditTitle(conv.id)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <>
                <div className="conv-title">
                  {query ? (
                    <span dangerouslySetInnerHTML={{
                      __html: highlightMatch(conv.title, query)
                    }} />
                  ) : conv.title}
                </div>
                <div className="conv-preview">{getMessagePreview(conv.messages)}</div>
                <div className="conv-time">{formatTime(conv.updatedAt)}</div>

                {/* 标签显示 */}
                {conv.tags && conv.tags.length > 0 && (
                  <div className="conv-tags">
                    {conv.tags.slice(0, 3).map((tagId, i) => (
                      <span key={i} className="tag-dot" />
                    ))}
                    {conv.tags.length > 3 && (
                      <span className="tag-more">+{conv.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="conv-actions">
              <button
                className="edit-btn"
                onClick={(e) => startEditTitle(conv.id, conv.title, e)}
              >
                ✏️
              </button>
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(conv.id, e)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}