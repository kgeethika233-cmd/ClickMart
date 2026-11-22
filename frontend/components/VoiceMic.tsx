'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, sendVoiceCommand, type VoiceCommandResponse } from '@/lib/api'
import { useCart } from '@/context/CartContext'
import { addOrder } from '@/lib/orders-local'
import { notifyCartAdded, notifyOrderPlaced } from '@/lib/notify-store'
import styles from './voice-mic.module.css'

type RecognitionResult = { transcript: string; isFinal?: boolean }
type RecognitionEvent = { results: ArrayLike<ArrayLike<RecognitionResult>> }
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type RecognitionConstructor = new () => Recognition

const examples = ['Search bluetooth earphones', 'Add 2 organic milk', 'Order boAt Airdopes in Coimbatore']
const isOrderRequest = (value: string) => /\b(order|buy|place)\b/i.test(value)

export default function VoiceMic() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addItem, clearCart, items, setQuantity, removeItem } = useCart()
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [hearing, setHearing] = useState('')
  const [listening, setListening] = useState(false)
  const [pending, setPending] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [confirmOrder, setConfirmOrder] = useState(true)
  const [confirmation, setConfirmation] = useState<{ transcript: string; product: string; qty: number } | null>(null)
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    try { setSpeakReplies(localStorage.getItem('voice-speak:v1') !== 'false') } catch { setSpeakReplies(true) }
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    if (!speechWindow.SpeechRecognition && !speechWindow.webkitSpeechRecognition) setSpeechUnavailable(true)
  }, [])

  const speak = (text: string) => {
    if (speakReplies && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
  }

  const send = async (value: string, confirmed = false) => {
    const clean = value.trim().slice(0, 300)
    if (!clean || busy.current) return
    busy.current = true
    setPending(true)
    try {
      if (confirmOrder && !confirmed && isOrderRequest(clean)) {
        const preview = await sendVoiceCommand(clean.replace(/\b(order|buy|place)\b/i, 'search'))
        const product = preview.results?.[0]
        if (!product) throw new ApiError(404, 'NOT_FOUND', `No available product found for ${clean}`)
        setConfirmation({ transcript: clean, product: product.name, qty: preview.parsedIntent.qty })
        speak(`I found ${preview.parsedIntent.qty} ${product.name}. Confirm to place this order.`)
        return
      }
      const response = await sendVoiceCommand(clean)
      setConfirmation(null)
      const intent = response.parsedIntent.intent
      if (intent === 'search') {
        const query = response.parsedIntent.productQuery || clean
        router.push(`/search?q=${encodeURIComponent(query)}`)
        toast.success(`Showing results for ${query}`)
      } else if (intent === 'add_to_cart') {
        const product = response.results?.[0]
        if (!product) throw new ApiError(404, 'NOT_FOUND', `No available product found for ${response.parsedIntent.productQuery}`)
        const previous = items.find(item => item.productId === product.productId)?.quantity ?? 0
        for (let i = 0; i < response.parsedIntent.qty; i++) addItem(product)
        notifyCartAdded(product, Math.min(previous + response.parsedIntent.qty, product.availableCount, 10), () => previous ? setQuantity(product.productId, previous) : removeItem(product.productId))
      } else if (response.popup && response.order) {
        const placed = response.order
        addOrder({ orderId: placed.orderId, placedAt: placed.createdAt, total: placed.totalCents, status: 'CONFIRMED', itemCount: placed.items.reduce((sum, item) => sum + item.quantity, 0), storeName: 'Inventory Hub', city: response.parsedIntent.city ?? '', items: placed.items.map(item => ({ productId: item.productId, quantity: item.quantity })) })
        clearCart()
        notifyOrderPlaced(placed, undefined, response.popup)
        void queryClient.invalidateQueries()
        speak(`Your order is confirmed. Order ID ${placed.orderId}.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      toast.error(message)
      speak(message)
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send(transcript)
  }

  const startListening = () => {
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) { setSpeechUnavailable(true); return }
    try {
      const recognition = new Constructor()
      recognition.lang = 'en-IN'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.onresult = event => {
        let finalText = ''
        let interimText = ''
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]?.[0]
          if (!result?.transcript) continue
          if (result.isFinal) finalText += `${finalText ? ' ' : ''}${result.transcript}`
          else interimText += `${interimText ? ' ' : ''}${result.transcript}`
        }
        const heard = [finalText, interimText].filter(Boolean).join(' ').slice(0, 300)
        setHearing(heard)
        if (heard) setTranscript(heard)
      }
      recognition.onerror = event => {
        setListening(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setSpeechUnavailable(true)
        else toast.error('Could not hear that. You can type your request instead.')
      }
      recognition.onend = () => {
        setListening(false)
        recognitionRef.current = null
      }
      recognitionRef.current = recognition
      setTranscript('')
      setHearing('')
      setListening(true)
      recognition.start()
    } catch {
      setListening(false)
      setSpeechUnavailable(true)
    }
  }

  const toggleSpeak = (enabled: boolean) => {
    setSpeakReplies(enabled)
    try { localStorage.setItem('voice-speak:v1', String(enabled)) } catch { /* Storage may be unavailable. */ }
    if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  return <div className={styles.root}>
    <button className={styles.trigger} type="button" aria-label="Open voice assistant" aria-expanded={open} onClick={() => setOpen(value => !value)}><Mic size={18}/><span>Voice</span></button>
    {open && <section className={styles.panel} aria-label="Voice assistant">
      <div className={styles.heading}><div><p className={styles.eyebrow}>HANDS-FREE SHOPPING</p><h2>Voice assistant</h2></div><button type="button" className={styles.close} aria-label="Close voice assistant" onClick={() => setOpen(false)}><X size={18}/></button></div>
      {speechUnavailable ? <p className={styles.note} role="status">Voice input isn&apos;t available here. You can still type your request.</p> : <button className={styles.speakButton} type="button" disabled={pending} onClick={() => listening ? recognitionRef.current?.stop() : startListening()}>{listening ? <><MicOff size={17}/> Stop</> : <><Mic size={17}/> Speak</>}</button>}
      <p className={styles.hearing} aria-live="polite">{hearing ? `Hearing: ${hearing}` : listening ? 'Hearing: …' : 'Ready when you are'}</p>
      <form className={styles.form} onSubmit={submit}><label className="sr-only" htmlFor="voice-command">Say or type a shopping request</label><input id="voice-command" value={transcript} maxLength={300} placeholder={'Try: "order 2 organic milk in Coimbatore"'} onChange={event => setTranscript(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}/><button type="submit" disabled={pending || !transcript.trim()} aria-label="Send voice command">{pending ? <LoaderCircle className={styles.spinner} size={17}/> : 'Send'}</button></form>
      <div className={styles.options}><label><input type="checkbox" checked={speakReplies} onChange={event => toggleSpeak(event.target.checked)}/><span>{speakReplies ? <Volume2 size={15}/> : <VolumeX size={15}/>} Speak replies</span></label><label><input type="checkbox" checked={confirmOrder} onChange={event => setConfirmOrder(event.target.checked)}/><span>Confirm before ordering</span></label></div>
      {confirmation && <div className={styles.confirm} role="group" aria-label="Confirm order"><p>Order {confirmation.qty} × <strong>{confirmation.product}</strong>?</p><button type="button" disabled={pending} onClick={() => void send(confirmation.transcript, true)}>Confirm</button><button type="button" disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button></div>}
      <div className={styles.examples}><span>Try saying</span>{examples.map(example => <button type="button" key={example} disabled={pending} onClick={() => { setTranscript(example); void send(example) }}>{example}</button>)}</div>
    </section>}
  </div>
}
