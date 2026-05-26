import express from "express"
import { createServer } from "http"
import { WebSocketServer } from "ws"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import apiRoutes from "./api.js"

const app = express()
app.use(express.json({ limit: "50mb" }))

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  if (req.method === "OPTIONS") return res.sendStatus(200)
  next()
})

// 云端同步数据库 API（SQLite，不影响原有聊天）
app.use("/api/db", apiRoutes)

const APIs = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_KEY || ""
  },
  v3cm: {
    url: "https://api.v3.cm/v1/chat/completions",
    key: process.env.V3CM_KEY || ""
  },
}

const MODEL_API_MAP = {
  "meta-llama/llama-3.2-3b-instruct:free": "openrouter",
  "meta-llama/llama-3.3-70b-instruct:free": "openrouter",
  "google/gemma-4-26b-a4b-it:free": "openrouter",
  "google/gemma-4-31b-it:free": "openrouter",
  "nvidia/nemotron-nano-12b-v2-vl:free": "openrouter",
  "arcee-ai/trinity-large-thinking:free": "openrouter",
  "liquid/lfm-2.5-1.2b-thinking:free": "openrouter",
  "qwen/qwen3-next-80b-a3b-instruct:free": "openrouter",
  "deepseek/deepseek-v4-flash:free": "openrouter",
  "gpt-4o": "v3cm",
  "claude-sonnet-4-6": "v3cm",
}

const NATIVE_THINKING_MODELS = [
  "arcee-ai/trinity-large-thinking:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
]

const THINKING_PROMPT = `请先在<thinking>标签中详细思考和分析问题，然后再给出最终答案。
<thinking>
[你的思考过程]
</thinking>
[你的最终答案]
`

// 图片生成 API
app.post("/api/image", async (req, res) => {
  try {
    const { prompt, model, size = "1024x1024", n = 1, referenceImage } = req.body
    
    if (!prompt) {
      return res.status(400).json({ error: "缺少 prompt 参数" })
    }
    
    // Nano Banana 系列 - 使用 v1beta API
    if (model.startsWith("nano-banana")) {
      const parts = [{ text: prompt }]
      
      if (referenceImage) {
        const base64Data = referenceImage.split(',')[1] || referenceImage
        const mimeType = referenceImage.includes('data:') 
          ? referenceImage.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
          : 'image/jpeg'
        
        parts.push({
          inlineData: { mimeType, data: base64Data }
        })
      }
      
      const imageRes = await fetch(`https://api.v3.cm/v1beta/models/${model}:predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + APIs.v3cm.key,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { n }
        }),
      })
      
      const data = await imageRes.json()
      
      if (data.error) {
        return res.status(400).json({ error: data.error.message || "生成失败" })
      }
      
      const images = []
      if (data.candidates) {
        for (const candidate of data.candidates) {
          const part = candidate?.content?.parts?.find(p => p.inlineData)
          if (part?.inlineData) {
            images.push({
              image: "data:" + part.inlineData.mimeType + ";base64," + part.inlineData.data
            })
          }
        }
      }
      
      if (images.length === 0) {
        return res.status(400).json({ error: "未生成图片" })
      }
      
      return res.json({ images })
    }
    
    // DALL-E / GPT Image / Flux / Imagen 等 - 使用 v1/images/generations
    const imageRes = await fetch("https://api.v3.cm/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + APIs.v3cm.key,
      },
      body: JSON.stringify({
        model,
        prompt,
        n,
        size,
      }),
    })
    
    const data = await imageRes.json()
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message || "生成失败" })
    }
    
    const images = (data.data || []).map(item => ({
      url: item.url,
      image: item.b64_json ? "data:image/png;base64," + item.b64_json : null
    }))
    
    res.json({ images })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// WebSocket 服务器
const server = createServer(app)
const wss = new WebSocketServer({ server, path: "/api/ws" })

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    try {
      const { model, messages, showThinking } = JSON.parse(data.toString())
      const apiName = MODEL_API_MAP[model] || "v3cm"
      const api = APIs[apiName]
      
      let processedMessages = messages
      
      if (showThinking && !NATIVE_THINKING_MODELS.includes(model)) {
        processedMessages = messages.map(msg => {
          if (msg.role === "user") {
            const content = typeof msg.content === "string" 
              ? THINKING_PROMPT + msg.content 
              : msg.content
            return { ...msg, content }
          }
          return msg
        })
      }
      
      const requestBody = { model, messages: processedMessages, stream: true }
      
      if (NATIVE_THINKING_MODELS.includes(model)) {
        requestBody.reasoning = { effort: "medium" }
      }
      
      const headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + api.key,
      }
      
      if (apiName === "openrouter") {
        headers["HTTP-Referer"] = "https://www.catten.cyou/ai/"
        headers["X-Title"] = "XiaoMiao AI"
      }
      
      const apiRes = await fetch(api.url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      })
      
      if (!apiRes.ok) {
        const errorText = await apiRes.text()
        ws.send(JSON.stringify({ type: "error", message: "API错误: " + apiRes.status + " " + errorText }))
        ws.close()
        return
      }
      
      const reader = apiRes.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          ws.send(JSON.stringify({ type: "done" }))
          break
        }
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta
              
              if (delta?.reasoning) {
                ws.send(JSON.stringify({ type: "thinking", content: delta.reasoning }))
              }
              
              if (delta?.content) {
                ws.send(JSON.stringify({ type: "content", content: delta.content }))
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: e.message }))
    }
  })
})

const __dirname = dirname(fileURLToPath(import.meta.url))
app.use(express.static(join(__dirname, "dist")))

// SPA fallback - 免受 Express 5 路由通配符不兼容问题
app.use((req, res, next) => {
  if (req.method !== "GET") return next()
  if (req.path.startsWith("/api")) return next()
  res.sendFile(join(__dirname, "dist", "index.html"))
})

const PORT = 3001
server.listen(PORT, () => {
  console.log("FreeChat running on port", PORT)
})
