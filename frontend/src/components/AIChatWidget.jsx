import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2 } from 'lucide-react'
import { getRestaurants, sendChatMessage } from '../api/client'

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[85%] bg-gradient-brand text-white text-sm rounded-2xl rounded-br-sm px-3.5 py-2.5'
            : 'max-w-[85%] bg-dark-600 border border-dark-400 text-slate-200 text-sm rounded-2xl rounded-bl-sm px-3.5 py-2.5'
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [selectedOutlet, setSelectedOutlet] = useState('') // '' = all outlets
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI assistant. Ask me about your reviews, sentiment trends, or complaint patterns \u2014 I can answer for a specific outlet or across all of them." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open && restaurants.length === 0) {
      getRestaurants().then(d => setRestaurants(d.items || [])).catch(() => {})
    }
  }, [open, restaurants.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      // Send prior turns only (excluding the just-added user message, which
      // goes as the separate `message` argument) — matches what the
      // backend expects as conversation history.
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const data = await sendChatMessage(text, selectedOutlet || null, history)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || "Sorry, I couldn't reach the AI service just now. Try again in a moment.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-brand shadow-glow-brand flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        title="AI Assistant"
      >
        {open ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] card flex flex-col overflow-hidden animate-slide-up shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 leading-tight">AI Assistant</p>
                <p className="text-[10px] text-slate-500 truncate">Ask about reviews & reputation data</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* Outlet scope selector */}
          {restaurants.length > 0 && (
            <div className="px-4 py-2 border-b border-dark-500 flex-shrink-0">
              <select
                className="w-full bg-dark-600 border border-dark-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-brand-500"
                value={selectedOutlet}
                onChange={e => setSelectedOutlet(e.target.value)}
              >
                <option value="">All outlets (platform-wide)</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <Message key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-dark-600 border border-dark-400 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-slate-400" />
                  <span className="text-xs text-slate-500">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-dark-500 flex items-center gap-2 flex-shrink-0">
            <input
              className="flex-1 bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors placeholder-slate-600"
              placeholder="Ask a question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-opacity"
            >
              <Send size={15} className="text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}