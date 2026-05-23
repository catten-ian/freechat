import express from 'express'
import { createServer } from 'http'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// 对话管理数据存储（内存存储，生产环境应使用数据库）
let conversations = []
let conversationIdCounter = 1

// 获取所有对话
app.get('/api/conversations', (req, res) => {
  res.json(conversations.sort((a, b) => b.updatedAt - a.updatedAt))
})

// 创建新对话
app.post('/api/conversations', (req, res) => {
  const { title, messages = [] } = req.body
  const conversation = {
    id: conversationIdCounter++,
    title: title || `新对话 ${conversationIdCounter}`,
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  conversations.push(conversation)
  res.status(201).json(conversation)
})

// 更新对话
app.put('/api/conversations/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const { title, messages } = req.body
  const conversation = conversations.find(c => c.id === id)
  
  if (!conversation) {
    return res.status(404).json({ error: '对话不存在' })
  }
  
  if (title !== undefined) conversation.title = title
  if (messages !== undefined) conversation.messages = messages
  conversation.updatedAt = Date.now()
  
  res.json(conversation)
})

// 删除对话
app.delete('/api/conversations/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const index = conversations.findIndex(c => c.id === id)
  
  if (index === -1) {
    return res.status(404).json({ error: '对话不存在' })
  }
  
  conversations.splice(index, 1)
  res.status(204).send()
})

// API配置
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
}

// 模型到API的映射
const MODEL_API_MAP = {
  'MiniMax-M2.5': 'hizui',
  'MiniMax-M2.7': 'hizui',
  'deepseek-ai/DeepSeek-V4-Flash': 'siliconflow',
  'claude-opus-4-7': 'venice',
  'gpt-5-5': 'venice',
  'deepseek-v4-pro': 'venice',
}

// 聊天 API
app.post('/api/v1/chat/completions', async (req, res) => {
  const body = req.body
  const model = body.model || 'MiniMax-M2.5'
  const apiName = MODEL_API_MAP[model] || 'hizui'
  const api = APIs[apiName]
  
  // 处理思考模式
  const thinking = body.thinking || false
  
  // 构建请求体
  const requestBody = { ...body }
  
  // 对于支持思考模式的模型，添加相应参数
  if (thinking) {
    if (apiName === 'siliconflow') {
      // SiliconFlow: 使用 thinking 参数
      requestBody.thinking = true
    } else if (apiName === 'venice') {
      // Venice: reasoning 需要是一个对象
      requestBody.reasoning = { enabled: true }
    }
  }
  
  // 移除前端的 thinking 参数，避免传递给不支持的后端
  delete requestBody.thinking
  
  console.log('Request:', model, 'thinking:', thinking, 'api:', apiName)
  
  try {
    const apiRes = await fetch(api.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api.key,
      },
      body: JSON.stringify(requestBody),
    })
    
    const data = await apiRes.json()
    console.log('Response:', data.choices?.[0]?.message?.content?.slice(0, 100))
    res.status(200).json(data)
  } catch (e) {
    console.error('Error:', e.message)
    res.status(500).json({ error: { message: e.message } })
  }
})

// 图像生成 API（Venice 无审查）
app.post('/api/v1/images/generations', async (req, res) => {
  const body = req.body
  const api = APIs.venice_image
  
  console.log('Image generation request:', body.prompt)
  
  try {
    const apiRes = await fetch(api.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api.key,
      },
      body: JSON.stringify({
        prompt: body.prompt,
        model: body.model || 'flux',
        size: body.size || '1024x1024',
      }),
    })
    
    const data = await apiRes.json()
    console.log('Image response:', data.data?.[0]?.url ? 'URL received' : 'Base64 received')
    res.status(200).json(data)
  } catch (e) {
    console.error('Image generation error:', e.message)
    res.status(500).json({ error: { message: e.message } })
  }
})

const __dirname = dirname(fileURLToPath(import.meta.url))
app.use(express.static(join(__dirname, 'dist')))

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'))
  }
})

const PORT = 3001
createServer(app).listen(PORT, () => {
  console.log('FreeChat running on port', PORT)
})