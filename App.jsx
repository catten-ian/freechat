import { useState, useRef, useEffect } from 'react'
import './App.css'

const MODELS = [
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', desc: '稳定快速', api: 'hizui', group: 'MiniMax' },
  { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', desc: '更强推理', api: 'hizui', group: 'MiniMax' },
  { id: 'deepseek-ai/DeepSeek-V4-Flash', name: 'DeepSeek V4', desc: '硅基流动', api: 'siliconflow', group: 'DeepSeek' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', desc: '无审查', api: 'venice', group: 'Venice' },
  { id: 'gpt-5-5', name: 'GPT-5.5', desc: '无审查', api: 'venice', group: 'Venice' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: '无审查', api: 'venice', group: 'Venice' },
]

const MODEL_GROUPS = [...new Set(MODELS.map(m => m.group))]

const GRADING_PROMPT = `你是一位专业的英语作文批改老师。请按照以下标准批改学生的英语作文：

## 评分标准（总分25分）
1. **内容与思想** (5分)：观点是否明确、论据是否充分、逻辑是否连贯
2. **语言表达** (10分)：词汇丰富度、句式多样性、语法准确性
3. **篇章结构** (5分)：段落组织、过渡衔接、开头结尾
4. **格式规范** (5分)：拼写、标点、格式要求

## 批改要求
- 用中文批改，指出具体问题并给出改进建议
- 标注语法错误、拼写错误、表达不当之处
- 给出每项得分和总分
- 提供一篇修改后的范文`

function App() {
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('MiniMax-M2.5')
  const [showModels, setShowModels] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [showGrading, setShowGrading] = useState(false)
  const [showImageGen, setShowImageGen] = useState(false)
  const [essay, setEssay] = useState('')
  const [gradingResult, setGradingResult] = useState(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState(null)
  
  const messagesEndRef = useRef(null)
  const editInputRef = useRef(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (editingTitle && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTitle])

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data)
      if (data.length > 0 && !currentConversationId) {
        loadConversation(data[0].id)
      }
    } catch (e) {
      console.error('加载对话列表失败:', e)
    }
  }

  const loadConversation = async (id) => {
    try {
      const res = await fetch(`/api/conversations`)
      const data = await res.json()
      const conversation = data.find(c => c.id === id)
      if (conversation) {
        setCurrentConversationId(id)
        setMessages(conversation.messages || [])
        setSidebarOpen(false)
      }
    } catch (e) {
      console.error('加载对话失败:', e)
    }
  }

  const createConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话', messages: [] })
      })
      const conversation = await res.json()
      setConversations(prev => [conversation, ...prev])
      setCurrentConversationId(conversation.id)
      setMessages([])
      setSidebarOpen(false)
    } catch (e) {
      console.error('创建对话失败:', e)
    }
  }

  const saveConversation = async (updatedMessages) => {
    if (!currentConversationId) return
    try {
      const title = messages.length === 0 && updatedMessages.length > 0
        ? updatedMessages[0].content.slice(0, 20) + (updatedMessages[0].content.length > 20 ? '...' : '')
        : undefined
      
      await fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, title })
      })
      
      setConversations(prev => 
        prev.map(c => 
          c.id === currentConversationId 
            ? { ...c, messages: updatedMessages, updatedAt: Date.now(), title: title || c.title }
            : c
        ).sort((a, b) => b.updatedAt - a.updatedAt)
      )
    } catch (e) {
      console.error('保存对话失败:', e)
    }
  }

  const deleteConversation = async (id, e) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个对话吗？')) return
    
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== id))
      
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id)
        if (remaining.length > 0) {
          loadConversation(remaining[0].id)
        } else {
          setCurrentConversationId(null)
          setMessages([])
        }
      }
    } catch (e) {
      console.error('删除对话失败:', e)
    }
  }

  const startEditTitle = (id, currentTitle, e) => {
    e.stopPropagation()
    setEditingTitle(id)
    setEditTitleValue(currentTitle)
  }

  const saveEditTitle = async (id) => {
    if (!editTitleValue.trim()) return
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleValue.trim() })
      })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitleValue.trim() } : c))
      setEditingTitle(null)
    } catch (e) {
      console.error('更新标题失败:', e)
    }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    
    let conversationId = currentConversationId
    if (!conversationId) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话', messages: [] })
      })
      const conversation = await res.json()
      conversationId = conversation.id
      setCurrentConversationId(conversationId)
      setConversations(prev => [conversation, ...prev])
    }
    
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: newMessages, stream: false, thinking }),
      })
      const data = await res.json()
      
      let content = data.choices?.[0]?.message?.content || '（无回复）'
      if (thinking) {
        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
        if (thinkMatch) {
          content = `<details><summary>💭 思考过程</summary><pre>${thinkMatch[1]}</pre></details>\n\n${content.replace(/<think>[\s\S]*?<\/think>/, '').trim()}`
        }
      }
      
      const finalMessages = [...newMessages, { role: 'assistant', content }]
      setMessages(finalMessages)
      await saveConversation(finalMessages)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '错误: ' + e.message }])
    }
    setLoading(false)
  }

  const gradeEssay = async () => {
    if (!essay.trim() || loading) return
    setLoading(true)
    setGradingResult(null)

    try {
      const res = await fetch('/ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: GRADING_PROMPT },
            { role: 'user', content: `请批改以下英语作文：\n\n${essay}` }
          ],
          stream: false,
          thinking: true,
        }),
      })
      const data = await res.json()
      setGradingResult(data.choices?.[0]?.message?.content || '（无结果）')
    } catch (e) {
      setGradingResult('批改失败: ' + e.message)
    }
    setLoading(false)
  }

  const generateImage = async () => {
    if (!imagePrompt.trim() || loading) return
    setLoading(true)
    setGeneratedImage(null)

    try {
      const res = await fetch('/ai/api/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, model: 'flux', size: '1024x1024' }),
      })
      const data = await res.json()
      if (data.data && data.data[0]) {
        setGeneratedImage(data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`)
      } else {
        setGeneratedImage('error')
        alert('生成失败：' + JSON.stringify(data))
      }
    } catch (e) {
      setGeneratedImage('error')
      alert('生成失败: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="app">
      {/* 侧边栏 */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={createConversation}>
            ➕ 新建对话
          </button>
        </div>
        
        <div className="conversation-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => loadConversation(conv.id)}
            >
              {editingTitle === conv.id ? (
                <input
                  ref={editInputRef}
                  className="edit-title-input"
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onBlur={() => saveEditTitle(conv.id)}
                  onKeyDown={e => e.key === 'Enter' && saveEditTitle(conv.id)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="conv-title">{conv.title}</div>
                  <div className="conv-time">{new Date(conv.updatedAt).toLocaleDateString()}</div>
                </>
              )}
              
              {editingTitle !== conv.id && (
                <div className="conv-actions">
                  <button className="edit-btn" onClick={(e) => startEditTitle(conv.id, conv.title, e)}>
                    ✏️
                  </button>
                  <button className="delete-btn" onClick={(e) => deleteConversation(conv.id, e)}>
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="main-content">
        <header>
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <h1>小喵AI助手</h1>
          <div className="controls">
            <label className="toggle">
              <input type="checkbox" checked={showImageGen} onChange={e => setShowImageGen(e.target.checked)} />
              <span>🎨 画图</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showGrading} onChange={e => setShowGrading(e.target.checked)} />
              <span>📝 批改</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={thinking} onChange={e => setThinking(e.target.checked)} />
              <span>💭 思考</span>
            </label>
            
            <div className="model-selector">
              <button onClick={() => setShowModels(!showModels)}>
                {MODELS.find(m => m.id === model)?.name} ▼
              </button>
              {showModels && (
                <div className="model-dropdown">
                  {MODEL_GROUPS.map(group => (
                    <div key={group} className="model-group">
                      <div className="group-title">{group}</div>
                      {MODELS.filter(m => m.group === group).map(m => (
                        <div 
                          key={m.id} 
                          className={`model-item ${model === m.id ? 'selected' : ''}`} 
                          onClick={() => { setModel(m.id); setShowModels(false) }}
                        >
                          <b>{m.name}</b>
                          <span>{m.desc}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {showImageGen ? (
          <div className="panel">
            <h2>🎨 AI 画图</h2>
            <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="描述你想画的图片..." rows={5} />
            <button onClick={generateImage} disabled={loading || !imagePrompt.trim()}>
              {loading ? '生成中...' : '生成图片'}
            </button>
            {generatedImage && generatedImage !== 'error' && (
              <div className="result-image">
                <img src={generatedImage} alt="AI Generated" />
              </div>
            )}
          </div>
        ) : showGrading ? (
          <div className="panel">
            <h2>📝 英语作文批改</h2>
            <textarea value={essay} onChange={e => setEssay(e.target.value)} placeholder="请输入你的英语作文..." rows={10} />
            <button onClick={gradeEssay} disabled={loading || !essay.trim()}>
              {loading ? '批改中...' : '开始批改'}
            </button>
            {gradingResult && (
              <div className="result-text">
                {gradingResult.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={msg.role}>
                  {msg.content.startsWith('<details') 
                    ? <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                    : msg.content
                  }
                </div>
              ))}
              {loading && <div className="assistant loading">{thinking ? '深度思考中...' : '思考中...'}</div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="输入消息..."
              />
              <button onClick={send} disabled={loading}>发送</button>
            </div>
          </>
        )}
      </main>

      {/* 侧边栏遮罩（手机端） */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}

export default App
