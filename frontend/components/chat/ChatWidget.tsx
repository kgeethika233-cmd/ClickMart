'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, ChevronDown, MessageCircle, Mic, MicOff, Send, ShoppingCart, Square, Trash2, UserRound, Volume2, X } from 'lucide-react'
import { sendChat, type ChatMessage, type ChatResponse } from '@/lib/api'
import type { Product } from '@/types/contract'
import { useCart } from '@/context/CartContext'
import { useUserLocation } from '@/hooks/use-user-location'
import { getOrders } from '@/lib/orders-local'
import { formatINR } from '@/lib/format'
import { notifyCartAdded } from '@/lib/notify-store'
import styles from './chat-widget.module.css'

type Entry = ChatMessage & { id: string; time: string; products?: Product[]; via?: 'qwen' | 'fallback'; failed?: boolean; retryText?: string }
type SpeechResult = { transcript: string; isFinal: boolean }
type SpeechEvent = { results: ArrayLike<ArrayLike<SpeechResult>> }
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type RecognitionConstructor = new () => Recognition
const STORAGE_KEY = 'chat:v1'
const SPEAK_KEY = 'voice-speak:v1'
const greeting = 'Hi there! I’m Shop Helper. Ask me about an order, fresh products, delivery, or what to buy.'
const quickReplies = ['Where is my order?', 'Is this milk fresh?', 'Which earphones are best under ₹1500?']
function createEntry(role: ChatMessage['role'], content: string, extra?: Partial<ChatResponse> & { failed?: boolean; retryText?: string }): Entry { return { role, content, id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), ...extra } }
function greetingEntry(): Entry { return createEntry('assistant', greeting) }

export default function ChatWidget() {
  const { addItem, items, removeItem, setQuantity } = useCart()
  const location = useUserLocation()
  const [messages, setMessages] = useState<Entry[]>([greetingEntry()])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const [listening, setListening] = useState(false)
  const [hearing, setHearing] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  const finalTranscriptRef = useRef('')
  const busyRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.every((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')) setMessages(parsed.slice(-20))
      }
      setSpeakReplies(window.localStorage.getItem(SPEAK_KEY) !== 'false')
    } catch { setSpeakReplies(true) }
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const speechAvailable = !!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition)
    setSpeechSupported(speechAvailable)
    setSpeechUnavailable(!speechAvailable)
    setStorageReady(true)
  }, [])
  useEffect(() => { if (!storageReady) return; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))) } catch {} }, [messages, storageReady])
  useEffect(() => { if (open) { setUnread(false); inputRef.current?.focus() } else { window.speechSynthesis?.cancel(); setSpeaking(false); recognitionRef.current?.stop() } }, [open])
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' }) }, [messages, loading, hearing, open])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeChat() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const closeChat = () => { setOpen(false); setMenuOpen(false); window.setTimeout(() => launcherRef.current?.focus(), 0) }
  const clearConversation = useCallback(() => { setMessages([greetingEntry()]); setMenuOpen(false) }, [])
  const speak = useCallback((text: string) => {
    if (!speakReplies || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [speakReplies])
  const send = useCallback(async (text: string, retry = false) => {
    const content = text.trim().slice(0, 500)
    if (!content || busyRef.current) return
    busyRef.current = true
    setLoading(true)
    setDraft('')
    const orderIntent = /\b(?:buy|purchase)\b|\b(?:place|make|submit|want|like|need)\b.{0,25}\border\b|^\s*order\s+(?!status\b|details?\b|number\b|id\b|#)|\border\b.{0,20}\b(?:by|through|via)\s+(?:chat|assistant)\b/i.test(content)
    if (orderIntent) {
      setMessages(current => [...current.filter(message => !message.failed), ...(retry ? [] : [createEntry('user', content)]), createEntry('assistant', 'I can help you find products, but chat can’t place orders. Use the mic in the top bar to place orders.')].slice(-20))
      setLoading(false)
      busyRef.current = false
      return
    }
    const base = retry ? messages.filter(message => !message.failed) : [...messages, createEntry('user', content)]
    const history = base.slice(-20)
    if (!retry) setMessages(history)
    try {
      const context = { city: location?.city ?? 'Bengaluru', cartProductIds: items.map(item => item.productId), lastOrderId: getOrders()[0]?.orderId ?? null }
      const response = await sendChat(history.map(({ role, content: messageContent }) => ({ role, content: messageContent })), context)
      setMessages(current => [...current.filter(message => !message.failed), createEntry('assistant', response.reply, { products: response.products, via: response.via })].slice(-20))
      speak(response.reply)
    } catch {
      setMessages(current => [...current.filter(message => !message.failed), createEntry('assistant', 'Couldn’t reach the assistant. Please try again.', { failed: true, retryText: content })].slice(-20))
    } finally { setLoading(false); busyRef.current = false }
  }, [items, location?.city, messages, speak])
  const startListening = () => {
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) { setSpeechSupported(false); setSpeechUnavailable(true); return }
    try {
      const recognition = new Constructor()
      recognition.lang = 'en-IN'
      recognition.interimResults = true
      recognition.continuous = false
      finalTranscriptRef.current = ''
      recognition.onresult = event => {
        let finalText = ''
        let interimText = ''
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index]?.[0]
          if (!result) continue
          if (event.results[index]?.[0]?.isFinal) finalText += result.transcript
          else interimText += result.transcript
        }
        finalTranscriptRef.current = finalText.trim()
        setHearing((finalText + interimText).trim())
      }
      recognition.onerror = event => {
        setListening(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { setSpeechUnavailable(true); setSpeechSupported(false) }
        else setHearing('Could not hear that. Please type your message.')
      }
      recognition.onend = () => {
        setListening(false)
        const finalText = finalTranscriptRef.current.trim().slice(0, 500)
        setHearing('')
        if (finalText) { setDraft(finalText); void send(finalText) }
      }
      recognitionRef.current = recognition
      setListening(true)
      setHearing('Listening…')
      recognition.start()
    } catch { setListening(false); setSpeechUnavailable(true); setSpeechSupported(false) }
  }
  const toggleSpeak = (enabled: boolean) => {
    setSpeakReplies(enabled)
    try { window.localStorage.setItem(SPEAK_KEY, String(enabled)) } catch {}
    if (!enabled) { window.speechSynthesis?.cancel(); setSpeaking(false) }
  }
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); void send(draft) }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(draft) } }

  return <>
    {!open && <button ref={launcherRef} className={styles.launcher} aria-label="Open Shop Helper chat" onClick={() => setOpen(true)}><MessageCircle size={23} strokeWidth={2.2} />{unread && <span className={styles.unread} aria-label="Unread message" />}</button>}
    {open && <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="shop-helper-title">
      <header className={styles.header}>
        <span className={styles.avatar}><Bot size={19} /></span>
        <div className={styles.heading}><strong id="shop-helper-title">Shop Helper</strong><span><i />Online</span></div>
        <div className={styles.actions}>
          <button className={styles.iconButton} aria-label="Clear chat" title="Clear chat" onClick={clearConversation}><Trash2 size={17} /></button>
          <div className={styles.menuWrap}><button className={styles.iconButton} aria-label="Chat options" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><span className={styles.dots}>•••</span></button>{menuOpen && <div className={styles.menu}><button onClick={() => { setMenuOpen(false); closeChat() }}><UserRound size={15} />Talk to a human</button><button onClick={clearConversation}><Trash2 size={15} />Clear chat</button></div>}</div>
          <button className={styles.iconButton} aria-label="Close chat" onClick={closeChat}><ChevronDown size={19} /></button>
        </div>
      </header>
      <div className={styles.transcript} aria-live="polite" aria-relevant="additions text">
        {messages.map((message, index) => <div className={`${styles.row} ${message.role === 'user' ? styles.userRow : ''}`} key={message.id}>
          {message.role === 'assistant' && <span className={styles.messageAvatar}><Bot size={14} /></span>}
          <div className={`${styles.messageGroup} ${message.role === 'user' ? styles.userGroup : ''}`}>
            <div className={`${styles.bubble} ${message.role === 'user' ? styles.userBubble : ''} ${message.failed ? styles.errorBubble : ''}`}>{message.content}</div>
            <time className={styles.time}>{index === 0 ? 'Just now' : message.time}</time>
            {message.failed && <button className={styles.retry} onClick={() => void send(message.retryText ?? '', true)} disabled={loading}>Retry</button>}
            {!!message.products?.length && <div className={styles.productList}>{message.products.map(product => <article className={styles.productCard} key={product.productId}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" className={styles.productImage} /> : <span className={styles.productImageFallback}><ShoppingCart size={16} /></span>}
              <div className={styles.productInfo}><strong>{product.name}</strong><span>{formatINR(product.priceCents, product.currency)} · {product.city}</span></div>
              <div className={styles.productActions}><button aria-label={`Add ${product.name} to cart`} disabled={!product.inStock || product.availableCount < 1 || loading} onClick={() => { const previous = items.find(item => item.productId === product.productId)?.quantity ?? 0; addItem(product); notifyCartAdded(product, previous + 1, () => previous ? setQuantity(product.productId, previous) : removeItem(product.productId)) }}><ShoppingCart size={15} />Add to cart</button><Link href={`/product/${product.productId}`} aria-label={`Open ${product.name}`}>Open</Link></div>
            </article>)}</div>}
          </div>
        </div>)}
        {messages.length === 1 && <div className={styles.quickReplies}>{quickReplies.map(reply => <button key={reply} onClick={() => void send(reply)} disabled={loading}>{reply}</button>)}</div>}
        {loading && <div className={styles.row}><span className={styles.messageAvatar}><Bot size={14} /></span><div className={styles.typing} role="status" aria-label="Shop Helper is typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>
      {hearing && <p className={styles.hearing} aria-live="polite">{hearing}</p>}
      <form className={styles.composer} onSubmit={handleSubmit}>
        <div className={styles.inputWrap}><label className="sr-only" htmlFor="shop-helper-message">Write a message</label><textarea ref={inputRef} id="shop-helper-message" value={draft} maxLength={500} rows={2} placeholder="Write a message…" onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} disabled={loading} /><span className={styles.counter}>{draft.length}/500</span></div>
        {speechSupported && !speechUnavailable && <button className={styles.iconButton} type="button" aria-label={listening ? 'Stop listening' : 'Speak a message'} onClick={() => listening ? recognitionRef.current?.stop() : startListening()}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
        <button className={styles.sendButton} type="submit" aria-label="Send message" disabled={loading || !draft.trim()}><Send size={17} /></button>
      </form>
      <div className={styles.footerControls}>
        {speechUnavailable && <span role="status">Voice input is unavailable. Typing still works.</span>}
        <label><input type="checkbox" checked={speakReplies} onChange={event => toggleSpeak(event.target.checked)} /><Volume2 size={14} />Speak replies</label>
        {speaking && <button type="button" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false) }}><Square size={12} />Stop</button>}
      </div>
      <p className={styles.disclaimer}>AI assistant. It can make mistakes. For urgent issues, talk to a human.</p>
    </section>}
  </>
}
