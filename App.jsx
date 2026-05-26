import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import "./App.css"
import { Sidebar } from './src/components/Sidebar'
import './src/components/Sidebar.css'
import { getConversations, createConversation, updateConversation, deleteConversation } from './src/utils/storage'
import { 
  isSyncEnabled as cloudIsSyncEnabled, 
  setSyncEnabled as cloudSetSyncEnabled, 
  initSync as cloudInitSync,
  isOnline as cloudIsOnline,
  onHealthChange as cloudOnHealthChange,
  syncCreateConversation,
  syncUpdateConversation,
  syncDeleteConversation,
  syncMessages as cloudSyncMessages,
  fetchCloudConversations,
  fetchCloudMessages,
  pushAllToCloud,
  pullCloudConversation
} from './src/utils/cloudSync'

const models = [
  { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B", desc: "轻量快速", api: "openrouter", vision: false, thinking: false },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", desc: "Meta旗舰", api: "openrouter", vision: false, thinking: false },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B", desc: "Google·多模态", api: "openrouter", vision: true, thinking: false },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", desc: "Google旗舰", api: "openrouter", vision: true, thinking: false },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron 12B", desc: "NVIDIA·多模态", api: "openrouter", vision: true, thinking: false },
  { id: "arcee-ai/trinity-large-thinking:free", name: "Trinity Thinking", desc: "思考模型", api: "openrouter", vision: false, thinking: true },
  { id: "liquid/lfm-2.5-1.2b-thinking:free", name: "LFM2.5 Thinking", desc: "轻量思考", api: "openrouter", vision: false, thinking: true },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen3 80B", desc: "阿里旗舰", api: "openrouter", vision: false, thinking: false },
  { id: "deepseek/deepseek-v4-flash:free", name: "DeepSeek V4", desc: "国产之光", api: "openrouter", vision: false, thinking: false },
  { id: "gemma-4-uncensored", name: "Gemma 4 非审查版", desc: "Venice·无限制", api: "venice", vision: false, thinking: false },
  { id: "gpt-4o", name: "GPT-4o", desc: "最强多模态", api: "v3cm", vision: true, thinking: false },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "编程最强", api: "v3cm", vision: false, thinking: false },
{ id: "e2ee-qwen3-30b-a3b-p", name: "Qwen3 30B 非审查", desc: "Venice·最强", api: "venice", vision: false, thinking: false },  { id: "e2ee-qwen3-5-122b-a10b", name: "Qwen3 122B 非审查", desc: "Venice·超大", api: "venice", vision: false, thinking: false },  { id: "e2ee-gpt-oss-120b-p", name: "GPT OSS 120B 非审查", desc: "Venice·GPT系", api: "venice", vision: false, thinking: false },  { id: "e2ee-qwen3-vl-30b-a3b-p", name: "Qwen3 VL 30B 非审查", desc: "Venice·多模态", api: "venice", vision: true, thinking: false },  { id: "e2ee-glm-5-1", name: "GLM 5.1 非审查", desc: "Venice·智谱", api: "venice", vision: false, thinking: false },  { id: "venice-uncensored-1-2", name: "Venice 非审查 1.2", desc: "Venice原生", api: "venice", vision: false, thinking: false },  { id: "venice-uncensored-role-play", name: "Venice 角色扮演", desc: "Venice·RP", api: "venice", vision: false, thinking: false },
]

const imageModels = [
  { id: "nano-banana-2-2k", name: "Nano Banana 2K", desc: "生物结构图", type: "nano" },
  { id: "nano-banana-2-4k", name: "Nano Banana 4K", desc: "高清版", type: "nano" },
  { id: "nano-banana-pro-2k", name: "Nano Banana Pro 2K", desc: "专业版", type: "nano" },
  { id: "nano-banana-pro-4k", name: "Nano Banana Pro 4K", desc: "专业高清", type: "nano" },
  { id: "dall-e-3", name: "DALL-E 3", desc: "OpenAI", type: "dalle" },
  { id: "gpt-image-2", name: "GPT Image 2", desc: "OpenAI最新", type: "dalle" },
  { id: "flux-1-schnell", name: "Flux 1 Schnell", desc: "快速生成", type: "flux" },
  { id: "imagen-4.0-generate-001", name: "Imagen 4.0", desc: "Google", type: "imagen" },
  { id: "gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash", desc: "Google多模态", type: "gemini" },
  { id: "jimeng-image", name: "即梦", desc: "字节跳动", type: "jimeng" },
  // Venice 无审查图片模型
  { id: "venice-sd35", name: "Venice SD35", desc: "无审查·默认", type: "venice" },
  { id: "flux-2-pro", name: "Flux 2 Pro", desc: "无审查·高质量", type: "venice" },
  { id: "flux-2-max", name: "Flux 2 Max", desc: "无审查·顶级", type: "venice" },
  { id: "qwen-image-2", name: "Qwen Image 2", desc: "无审查·阿里", type: "venice" },
  { id: "grok-imagine-image", name: "Grok Imagine", desc: "无审查·马斯克", type: "venice" },
  { id: "hunyuan-image-v3", name: "混元 3.0", desc: "无审查·腾讯", type: "venice" },
  { id: "chroma", name: "Chroma", desc: "无审查·艺术", type: "venice" },
  { id: "lustify-v8", name: "Lustify V8", desc: "无审查·写实", type: "venice" },
  { id: "wai-Illustrious", name: "WAI Anime", desc: "无审查·动漫", type: "venice" },
]

const imageSizes = [
  { id: "auto", name: "自动（推荐）" },
  { id: "512x512", name: "512×512 小图" },
  { id: "1024x1024", name: "1024×1024 方形" },
  { id: "1024x1536", name: "1024×1536 竖版 2:3" },
  { id: "1536x1024", name: "1536×1024 横版 3:2" },
  { id: "1024x1792", name: "1024×1792 竖版 9:16" },
  { id: "1792x1024", name: "1792×1024 横版 16:9" },
  { id: "2048x2048", name: "2048×2048 超大" },
  { id: "2560x1440", name: "2560×1440 2K横版" },
  { id: "3840x2160", name: "3840×2160 4K横版" },
]

const setCookie = (name, value, days = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) + '; expires=' + expires + '; path=/; SameSite=Strict'
}

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]))
    } catch {
      return null
    }
  }
  return null
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState("google/gemma-4-26b-a4b-it:free")
  const [showModels, setShowModels] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [showThinking, setShowThinking] = useState(false)
  const [showImageGen, setShowImageGen] = useState(false)
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageModel, setImageModel] = useState("nano-banana-2-2k")
  const [imageSize, setImageSize] = useState("auto")
  const [imageCount, setImageCount] = useState(1)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [refImage, setRefImage] = useState(null)
  const [refImagePreview, setRefImagePreview] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const refImageRef = useRef(null)
  const thinkingStateRef = useRef({ inThinking: false, buffer: "" })
  
  // 侧栏相关状态 - 移动端默认收起，桌面端默认显示
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 769
    }
    return true
  })
  const [currentConversation, setCurrentConversation] = useState(null)
  const [conversations, setConversations] = useState([])
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(() => cloudIsSyncEnabled())
  const [cloudOnline, setCloudOnline] = useState(false)
  const [showCloudPanel, setShowCloudPanel] = useState(false)
  const [cloudBackups, setCloudBackups] = useState([])
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('')

  // 初始化云端同步
  useEffect(() => {
    if (!cloudSyncEnabled) {
      setCloudOnline(false)
      return
    }
    cloudInitSync()
    setCloudOnline(cloudIsOnline())
    const unsubscribe = cloudOnHealthChange((ok) => setCloudOnline(ok))
    return unsubscribe
  }, [cloudSyncEnabled])

  useEffect(() => {
    const saved = getCookie('chat_history')
    if (saved && Array.isArray(saved)) {
      setMessages(saved)
    }
    
    // 加载对话列表
    const savedConversations = getConversations()
    setConversations(savedConversations)
    
    // 监听窗口大小变化
    const handleResize = () => {
      if (window.innerWidth >= 769) {
        setShowSidebar(true) // 桌面端自动展开
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.slice(-50)
      setCookie('chat_history', toSave, 7)
      
      // 保存到当前对话
      if (currentConversation) {
        updateConversation(currentConversation.id, { messages: toSave })
        // 云端同步新增消息
        cloudSyncMessages(currentConversation.id, toSave)
      }
    }
  }, [messages, currentConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])
  
  // 选择对话
  const handleSelectConversation = (conversation) => {
    setCurrentConversation(conversation)
    setMessages(conversation.messages || [])
  }
  
  // 新建对话
  const handleNewConversation = () => {
    const conversation = createConversation('新对话', [])
    setConversations([conversation, ...conversations])
    setCurrentConversation(conversation)
    setMessages([])
    setCookie('chat_history', [], 7)
    // 云端同步
    syncCreateConversation(conversation)
  }
  
  // 删除对话
  const handleDeleteConversation = (id) => {
    deleteConversation(id)
    setConversations(conversations.filter(c => c.id !== id))
    if (currentConversation && currentConversation.id === id) {
      setCurrentConversation(null)
      setMessages([])
    }
    // 云端同步
    syncDeleteConversation(id)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB")
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageBase64(e.target.result)
      setImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRefImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB")
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setRefImage(e.target.result)
      setRefImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    setImageBase64(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeRefImage = () => {
    setRefImage(null)
    setRefImagePreview(null)
    if (refImageRef.current) refImageRef.current.value = ""
  }

  const parseThinkingTags = (text, state) => {
    let thinking = ""
    let content = ""
    let buffer = state.buffer + text
    let i = 0
    
    while (i < buffer.length) {
      if (state.inThinking) {
        const endIdx = buffer.indexOf("</thinking>", i)
        if (endIdx === -1) {
          thinking += buffer.slice(i)
          state.buffer = ""
          break
        } else {
          thinking += buffer.slice(i, endIdx)
          state.inThinking = false
          i = endIdx + "</thinking>".length
        }
      } else {
        const startIdx = buffer.indexOf("<thinking>", i)
        if (startIdx === -1) {
          const lastChars = buffer.slice(-10)
          if ("<thinking>".startsWith(lastChars) || lastChars.includes("<")) {
            const safeIdx = Math.max(i, buffer.length - 10)
            content += buffer.slice(i, safeIdx)
            state.buffer = buffer.slice(safeIdx)
            break
          } else {
            content += buffer.slice(i)
            state.buffer = ""
            break
          }
        } else {
          content += buffer.slice(i, startIdx)
          state.inThinking = true
          i = startIdx + "<thinking>".length
        }
      }
    }
    
    return { thinking, content }
  }

  const send = () => {
    if ((!input.trim() && !imageBase64) || loading) return
    
    const userMsg = input.trim()
    const currentImage = imageBase64
    
    let messageContent
    if (currentImage) {
      messageContent = [
        { type: "text", text: userMsg || "请描述这张图片" },
        { type: "image_url", image_url: { url: currentImage } }
      ]
    } else {
      messageContent = userMsg
    }
    
    setInput("")
    setImagePreview(null)
    setImageBase64(null)
    
    setMessages(prev => [...prev, { 
      role: "user", 
      content: userMsg || "请描述这张图片",
      image: currentImage
    }])
    setLoading(true)
    
    thinkingStateRef.current = { inThinking: false, buffer: "" }
    
    setMessages(prev => [...prev, { role: "assistant", content: "", thinking: "", streaming: true }])
    const assistantIndex = messages.length + 1

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = wsProtocol + "//" + window.location.host + "/ai/api/ws"
    
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        model, 
        messages: [...messages, { role: "user", content: messageContent }],
        showThinking 
      }))
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "content") {
        const parsed = parseThinkingTags(data.content, thinkingStateRef.current)
        
        setMessages(prev => {
          const newMsgs = [...prev]
          if (newMsgs[assistantIndex]) {
            newMsgs[assistantIndex] = {
              ...newMsgs[assistantIndex],
              content: newMsgs[assistantIndex].content + parsed.content,
              thinking: (newMsgs[assistantIndex].thinking || "") + parsed.thinking
            }
          }
          return newMsgs
        })
      } else if (data.type === "thinking") {
        setMessages(prev => {
          const newMsgs = [...prev]
          if (newMsgs[assistantIndex]) {
            newMsgs[assistantIndex] = {
              ...newMsgs[assistantIndex],
              thinking: (newMsgs[assistantIndex].thinking || "") + data.content
            }
          }
          return newMsgs
        })
      } else if (data.type === "done") {
        if (thinkingStateRef.current.buffer) {
          setMessages(prev => {
            const newMsgs = [...prev]
            if (newMsgs[assistantIndex]) {
              newMsgs[assistantIndex] = {
                ...newMsgs[assistantIndex],
                content: newMsgs[assistantIndex].content + thinkingStateRef.current.buffer
              }
            }
            return newMsgs
          })
        }
        
        setMessages(prev => {
          const newMsgs = [...prev]
          if (newMsgs[assistantIndex]) {
            newMsgs[assistantIndex] = { ...newMsgs[assistantIndex], streaming: false }
          }
          return newMsgs
        })
        setLoading(false)
        ws.close()
      } else if (data.type === "error") {
        setMessages(prev => {
          const newMsgs = [...prev]
          if (newMsgs[assistantIndex]) {
            newMsgs[assistantIndex] = { role: "assistant", content: "错误: " + data.message, streaming: false }
          }
          return newMsgs
        })
        setLoading(false)
        ws.close()
      }
    }
    
    ws.onerror = () => {
      setMessages(prev => {
        const newMsgs = [...prev]
        if (newMsgs[assistantIndex]) {
          newMsgs[assistantIndex] = { role: "assistant", content: "WebSocket 连接失败", streaming: false }
        }
        return newMsgs
      })
      setLoading(false)
    }
  }

  const generateImage = async () => {
    if (!imagePrompt.trim() || generatingImage) return
    
    setGeneratingImage(true)
    setMessages(prev => [...prev, { 
      role: "user", 
      content: "🎨 生成图片: " + imagePrompt + (refImage ? " (带参考图)" : "")
    }])
    
    try {
      const res = await fetch("/ai/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: imagePrompt, 
          model: imageModel,
          size: imageSize === "auto" ? undefined : imageSize,
          n: imageCount,
          referenceImage: refImage
        })
      })
      
      const data = await res.json()
      
      if (data.error) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "❌ 生成失败: " + data.error 
        }])
      } else {
        const images = data.images || [data]
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "🎨 已生成 " + images.length + " 张图片",
          generatedImages: images.map(img => img.url || img.image)
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "❌ 生成失败: " + e.message 
      }])
    }
    
    setImagePrompt("")
    setRefImage(null)
    setRefImagePreview(null)
    setShowImageGen(false)
    setShowMenu(false)
    setGeneratingImage(false)
  }

  // 导出图片
  const downloadImage = async (imageData, filename) => {
    const link = document.createElement('a')
    link.href = imageData
    link.download = filename || 'generated-image.png'
    link.click()
  }

  // 导出对话记录
  const exportChat = () => {
    const exportData = messages.map(msg => {
      let text = msg.role === 'user' ? '## 用户\n' : '## 小喵\n'
      if (msg.thinking) text += '🧠 思考过程:\n' + msg.thinking + '\n\n'
      text += msg.content + '\n\n---\n\n'
      return text
    }).join('')
    
    const blob = new Blob(['# 小喵AI对话记录\n\n' + exportData], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'chat-' + new Date().toISOString().slice(0, 10) + '.md'
    link.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearHistory = () => {
    if (confirm("确定要清空所有对话记录吗？")) {
      setMessages([])
      document.cookie = 'chat_history=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    }
    setShowMenu(false)
  }

  const currentModel = models.find(m => m.id === model)
  const currentImageModel = imageModels.find(m => m.id === imageModel)

  return (
    <div className="app">
      {/* 侧栏 */}
      <Sidebar
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversation?.id}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
      />
      
      {/* 移动端遮罩层 */}
      {showSidebar && typeof window !== 'undefined' && window.innerWidth < 769 && (
        <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />
      )}
      
      {/* 主内容区 */}
      <div className="main-container">
        <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="title-icon">🐱</span>
            <span className="title-text">小喵AI</span>
          </h1>
          <div className="controls">
            <button className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
              ☰
            </button>
            <button className="model-button" onClick={() => setShowModels(!showModels)}>
              <span className="model-name">{currentModel?.name}</span>
              <span className="model-arrow">▼</span>
            </button>
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
              ⋮
            </button>
          </div>
        </div>
        
        {showMenu && (
          <div className="dropdown-menu">
            <label className="menu-item toggle-item">
              <input 
                type="checkbox" 
                checked={showThinking} 
                onChange={(e) => setShowThinking(e.target.checked)}
              />
              <span>🧠 思考模式</span>
            </label>
            <label className="menu-item toggle-item">
              <input 
                type="checkbox" 
                checked={cloudSyncEnabled} 
                onChange={(e) => {
                  cloudSetSyncEnabled(e.target.checked)
                  setCloudSyncEnabled(e.target.checked)
                  if (e.target.checked) {
                    cloudInitSync()
                  }
                }}
              />
              <span>☁️ 云端同步 {cloudSyncEnabled && (cloudOnline ? '🟢' : '🔴')}</span>
            </label>
            {cloudSyncEnabled && (
              <button onClick={() => { setShowCloudPanel(true); setShowMenu(false) }} className="menu-item">
                💾 云端备份管理
              </button>
            )}
            <button onClick={() => { setShowImageGen(true); setShowMenu(false) }} className="menu-item">
              🎨 图片生成
            </button>
            <button onClick={exportChat} className="menu-item" disabled={messages.length === 0}>
              📥 导出对话
            </button>
            <button onClick={clearHistory} className="menu-item danger">
              🗑 清空记录
            </button>
          </div>
        )}
        
        {showModels && (
          <div className="model-dropdown">
            <div className="model-group-label">免费模型</div>
            {models.filter(m => m.api === 'openrouter').map(m => (
              <button
                key={m.id}
                className={"model-option " + (m.id === model ? "active" : "")}
                onClick={() => { setModel(m.id); setShowModels(false) }}
              >
                <span className="option-name">{m.name}</span>
                <span className="option-desc">{m.desc}</span>
              </button>
            ))}
            <div className="model-group-label">付费模型</div>
            {models.filter(m => m.api === 'v3cm').map(m => (
              <button
                key={m.id}
                className={"model-option " + (m.id === model ? "active" : "")}
                onClick={() => { setModel(m.id); setShowModels(false) }}
              >
                <span className="option-name">{m.name}</span>
                <span className="option-desc">{m.desc}</span>
              </button>
            ))}
            <div className="model-group-label">非审查模型</div>
            {models.filter(m => m.api === 'venice').map(m => (
              <button
                key={m.id}
                className={"model-option " + (m.id === model ? "active" : "")}
                onClick={() => { setModel(m.id); setShowModels(false) }}
              >
                <span className="option-name">{m.name}</span>
                <span className="option-desc">{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {showCloudPanel && (
        <div className="modal-overlay" onClick={() => setShowCloudPanel(false)}>
          <div className="image-gen-panel" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, maxHeight: '85vh', overflowY: 'auto'}}>
            <div className="image-gen-header">
              <span>☁️ 云端备份管理</span>
              <button onClick={() => setShowCloudPanel(false)} className="close-panel">×</button>
            </div>
            <div style={{padding: '16px', color: '#e0e0e0', fontSize: 14, lineHeight: 1.7}}>
              <p>状态：{cloudOnline ? '🟢 已连接云端' : '🔴 未连接'}</p>
              {cloudStatus && (
                <p style={{padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 6, fontSize: 13}}>
                  {cloudStatus}
                </p>
              )}
              <p style={{opacity: 0.7, fontSize: 12}}>
                · 本地数据仍是主存储，云端作为镜像备份<br/>
                · 新建/删除对话会自动同步到云端<br/>
                · 消息增量同步（仅添加新消息）
              </p>
              
              <div style={{display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
                <button 
                  disabled={cloudBusy}
                  onClick={async () => {
                    setCloudBusy(true)
                    setCloudStatus('正在推送本地对话到云端...')
                    try {
                      const localConvs = getConversations()
                      const result = await pushAllToCloud(localConvs)
                      setCloudStatus(`✅ 推送完成：新增 ${result.pushed} 个对话、${result.skipped} 个已同步、${result.messagesPushed} 条消息${result.errors.length ? ` (${result.errors.length} 个错误)` : ''}`)
                    } catch (e) {
                      setCloudStatus('❌ ' + e.message)
                    } finally {
                      setCloudBusy(false)
                    }
                  }}
                  className="image-gen-btn"
                >
                  ⬆️ 首次全量推送本地→云端
                </button>
                
                <button 
                  disabled={cloudBusy}
                  onClick={async () => {
                    setCloudBusy(true)
                    setCloudStatus('正在获取云端备份...')
                    try {
                      const list = await fetchCloudConversations()
                      setCloudBackups(list)
                      setCloudStatus(`云端共 ${list.length} 个备份`)
                    } catch (e) {
                      setCloudStatus('❌ ' + e.message)
                    } finally {
                      setCloudBusy(false)
                    }
                  }}
                  className="image-gen-btn"
                >
                  🔄 刷新备份列表
                </button>
              </div>
              
              {cloudBackups.length > 0 && (
                <div style={{marginTop: 16, borderTop: '1px solid #333', paddingTop: 12}}>
                  <p style={{marginBottom: 8, fontWeight: 'bold'}}>云端备份列表（点击恢复到本地）：</p>
                  <div style={{maxHeight: 280, overflowY: 'auto'}}>
                    {cloudBackups.map(c => (
                      <div 
                        key={c.id}
                        style={{
                          padding: '8px 12px',
                          margin: '4px 0',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 6,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <div style={{flex: 1, overflow: 'hidden'}}>
                          <div style={{fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            {c.title}
                          </div>
                          <div style={{fontSize: 11, opacity: 0.6}}>
                            {c.message_count || 0} 条 · ID: {c.id}
                          </div>
                        </div>
                        <button
                          disabled={cloudBusy}
                          onClick={async () => {
                            setCloudBusy(true)
                            try {
                              const localConv = await pullCloudConversation(c.id)
                              // 保存到本地
                              const data = JSON.parse(localStorage.getItem('freechat_data') || '{"conversations":[],"folders":[],"tags":[],"searchHistory":[]}')
                              data.conversations.unshift(localConv)
                              localStorage.setItem('freechat_data', JSON.stringify(data))
                              setConversations([localConv, ...conversations])
                              setCloudStatus(`✅ 已恢复「${localConv.title}」到本地（${localConv.messages.length} 条消息）`)
                            } catch (e) {
                              setCloudStatus('❌ ' + e.message)
                            } finally {
                              setCloudBusy(false)
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(34,197,94,0.2)',
                            border: '1px solid rgba(34,197,94,0.4)',
                            borderRadius: 4,
                            color: '#22c55e',
                            cursor: 'pointer',
                            fontSize: 12
                          }}
                        >
                          ⬇️ 恢复
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showImageGen && (
        <div className="modal-overlay" onClick={() => setShowImageGen(false)}>
          <div className="image-gen-panel" onClick={(e) => e.stopPropagation()}>
            <div className="image-gen-header">
              <span>🎨 图片生成</span>
              <button onClick={() => setShowImageGen(false)} className="close-panel">×</button>
            </div>
            
            <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="image-model-select">
              <optgroup label="Nano Banana（生物结构）">
                {imageModels.filter(m => m.type === 'nano').map(m => (
                  <option key={m.id} value={m.id}>{m.name} - {m.desc}</option>
                ))}
              </optgroup>
              <optgroup label="DALL-E / GPT">
                {imageModels.filter(m => m.type === 'dalle').map(m => (
                  <option key={m.id} value={m.id}>{m.name} - {m.desc}</option>
                ))}
              </optgroup>
              <optgroup label="Venice 无审查">
                {imageModels.filter(m => m.type === 'venice').map(m => (
                  <option key={m.id} value={m.id}>{m.name} - {m.desc}</option>
                ))}
              </optgroup>
              <optgroup label="其他模型">
                {imageModels.filter(m => !['nano', 'dalle', 'venice'].includes(m.type)).map(m => (
                  <option key={m.id} value={m.id}>{m.name} - {m.desc}</option>
                ))}
              </optgroup>
            </select>
            
            <div className="image-params">
              <div className="param-row">
                <label>尺寸：</label>
                <select value={imageSize} onChange={(e) => setImageSize(e.target.value)} className="param-select">
                  {imageSizes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="param-row">
                <label>数量：</label>
                <input 
                  type="range" 
                  min="1" 
                  max="4" 
                  value={imageCount} 
                  onChange={(e) => setImageCount(parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-value">{imageCount}</span>
              </div>
            </div>
            
            <div className="ref-image-section">
              <label className="ref-image-label">参考图（可选）：</label>
              <input
                type="file"
                accept="image/*"
                ref={refImageRef}
                onChange={handleRefImageUpload}
                style={{ display: "none" }}
              />
              {refImagePreview ? (
                <div className="ref-image-preview">
                  <img src={refImagePreview} alt="参考图" />
                  <button onClick={removeRefImage} className="remove-ref">×</button>
                </div>
              ) : (
                <button onClick={() => refImageRef.current?.click()} className="upload-ref-btn">
                  📷 上传参考图
                </button>
              )}
            </div>
            
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="描述你想要生成的图片..."
              className="image-prompt-input"
              rows={3}
            />
            <button 
              onClick={generateImage} 
              disabled={!imagePrompt.trim() || generatingImage}
              className="generate-btn"
            >
              {generatingImage ? "生成中..." : "生成图片"}
            </button>
          </div>
        </div>
      )}

      <main className="main">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">🐱</div>
              <h2>你好！我是小喵</h2>
              <p>有什么我可以帮你的吗？</p>
              <div className="quick-actions">
                <button onClick={() => setInput("介绍一下你自己")} className="quick-btn">介绍一下你自己</button>
                <button onClick={() => setInput("帮我写一首诗")} className="quick-btn">帮我写一首诗</button>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={"message " + msg.role}>
              <div className="message-avatar">
                {msg.role === "user" ? "👤" : "🐱"}
              </div>
              <div className="message-content">
                {msg.image && (
                  <img src={msg.image} alt="用户上传" className="message-image" />
                )}
                {msg.generatedImages && msg.generatedImages.map((img, idx) => (
                  <div key={idx} className="generated-image-wrapper">
                    <img src={img} alt="AI生成" className="generated-image" />
                    <button 
                      onClick={() => downloadImage(img, 'image-' + Date.now() + '-' + (idx+1) + '.png')}
                      className="download-image-btn"
                      title="下载图片"
                    >
                      💾
                    </button>
                  </div>
                ))}
                {msg.thinking && msg.thinking.length > 0 && (
                  <details className="thinking-block">
                    <summary>🧠 思考过程</summary>
                    <div className="thinking-content">{msg.thinking}</div>
                  </details>
                )}
                {msg.content ? (
                  msg.streaming ? (
                    <pre className="streaming-text">{msg.content}</pre>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          return inline ? (
                            <code className="inline-code" {...props}>{children}</code>
                          ) : (
                            <code {...props}>{children}</code>
                        )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )
                ) : (loading && i === messages.length - 1 && msg.role === "assistant" ? (
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                ) : null)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="footer">
        {imagePreview && (
          <div className="image-preview-bar">
            <img src={imagePreview} alt="预览" className="preview-thumb" />
            <button onClick={removeImage} className="remove-preview">×</button>
          </div>
        )}
        
        <div className="input-container">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          {currentModel?.vision && (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="upload-button"
              title="上传图片"
            >
              🖼
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows="1"
            className="input"
          />
          <button onClick={send} disabled={loading || (!input.trim() && !imageBase64)} className="send-button">
            <span className="send-icon">➤</span>
          </button>
        </div>
      </footer>
      </div>
    </div>
  )
}
