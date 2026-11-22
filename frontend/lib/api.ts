import { API_BASE, USE_MOCK } from './config'
import * as mock from './mockApi'
import type { ErrorCode, ApiErrorBody, SearchParams, SearchResponse, Product, CreateOrderRequest, Order, HealthResponse } from '@/types/contract'
import { generateId } from './id'
import { withCurrentExpiry } from './expiry'

export class ApiError extends Error {
  constructor(public status:number, public code:ErrorCode|'NETWORK_ERROR', message:string, public details?:Record<string,unknown>) { super(message); this.name='ApiError' }
}
async function request<T>(path:string, body?:unknown, method?:'GET'|'POST'|'PUT') {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000)
  try {
    const r=await fetch(`${API_BASE}/api/${path}`,{signal:controller.signal, method:method??(body?'POST':'GET'),credentials:'omit',headers:apiHeaders(body?{'Content-Type':'application/json'}:{}),body:body?JSON.stringify(body):undefined})
    const raw=await r.text(); let data
    try { data=JSON.parse(raw) } catch {throw new ApiError(r.status,'INTERNAL_ERROR','The server returned an unreadable response.')}
    if(!r.ok){const e=(data as ApiErrorBody|null)?.error;const raw=(data as {error?:unknown;details?:Record<string,unknown>}|null)?.error;const message=typeof raw==='string'?raw:e?.message??'Something went wrong. Please try again.';const code=r.status===409&&message==='Item is expired or out of stock'?'OUT_OF_STOCK':e?.code??'INTERNAL_ERROR';throw new ApiError(r.status,code,message,e?.details??(data as {details?:Record<string,unknown>}|null)?.details)}
    return {data:data as T,status:r.status}
  }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,'NETWORK_ERROR','Unable to reach the store. Check your connection and try again.')}finally{clearTimeout(timer)}
}
export async function searchProducts(params:SearchParams & {expiry?:string}):Promise<SearchResponse>{if(USE_MOCK){const base=await mock.searchProducts(params);const {mockExpiryProducts}=await import('./mock-expiry');const query=params.q?.trim().toLowerCase();const isExpiryMatch=(product:Product)=>{const status=product.expiry_status??'none';const days=product.days_to_expiry??null;if(status==='expired')return false;if(!params.expiry||params.expiry==='any')return true;if(params.expiry==='7')return days!==null&&days>0&&days<=7;if(params.expiry==='30')return days!==null&&days>0&&days<=30;if(params.expiry==='nonperishable')return status==='none';return true};const baseItems=base.items.map(withCurrentExpiry).filter(isExpiryMatch);const extra=mockExpiryProducts.map(withCurrentExpiry).filter(product=>product.inStock&&(!query||product.name.toLowerCase().includes(query)||product.category.toLowerCase().includes(query))&&(!params.category?.length||params.category.includes(product.category))&&(!params.city?.length||params.city.includes(product.city))&&product.priceCents>=(params.minPrice??0)*100&&product.priceCents<=(params.maxPrice??Infinity)*100&&isExpiryMatch(product));const all=[...baseItems,...extra.filter(product=>!base.items.some(item=>item.productId===product.productId))];const total=params.expiry&&params.expiry!=='any'?all.length:Math.max(all.length,base.total+extra.length);const mergeFacet=(key:'categories'|'cities')=>{const buckets=base.facets[key];const counts=new Map(buckets.map(bucket=>[bucket.value,bucket.count]));for(const product of extra){const value=key==='categories'?product.category:product.city;counts.set(value,(counts.get(value)??0)+1)}return Array.from(counts,([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value))};return {...base,items:all,total,totalPages:Math.ceil(total/base.pageSize),facets:{...base.facets,categories:mergeFacet('categories'),cities:mergeFacet('cities')}}}const query=new URLSearchParams();for(const [k,v] of Object.entries(params))for(const value of Array.isArray(v)?v:[v])if(value!=null&&String(value).trim())query.append(k,String(value).trim());const result=(await request<SearchResponse>('search?'+query)).data;const items=result.items.map(withCurrentExpiry).filter(product=>product.expiry_status!=='expired'&&(params.expiry==='any'||!params.expiry||(params.expiry==='7'&&product.days_to_expiry!==null&&product.days_to_expiry!>0&&product.days_to_expiry!<=7)||(params.expiry==='30'&&product.days_to_expiry!==null&&product.days_to_expiry!>0&&product.days_to_expiry!<=30)||(params.expiry==='nonperishable'&&product.expiry_status==='none')));return {...result,items,total:items.length,totalPages:Math.ceil(items.length/result.pageSize)}}
export type AutocompleteResult = { suggestions: string[]; corrections: { from: string; to: string }[]; products: { id: number; name: string; image_url: string | null; price: number; category: string }[] }
export async function getAutocomplete(q: string, signal?: AbortSignal): Promise<AutocompleteResult> {
  if (USE_MOCK) return import('./mock-search').then(({ mockAutocomplete }) => mockAutocomplete(q))
  const response = await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(q)}`, { signal, credentials: 'omit', headers: apiHeaders() })
  if (!response.ok) throw new ApiError(response.status, 'INTERNAL_ERROR', 'Could not load suggestions.')
  return await response.json() as AutocompleteResult
}
export type ImageSearchResult = { detected: { keywords: string[]; attributes: { color?: string; type?: string; material?: string }; via: 'qwen' | 'filename' }; products: Product[] }
let latestImageSearch: ImageSearchResult | null = null
export function getLatestImageSearch() { return latestImageSearch }
export async function searchByImage(file: File): Promise<ImageSearchResult> {
  if (USE_MOCK) { const result = await import('./mock-search').then(({ mockSearchByImage }) => mockSearchByImage(file)); latestImageSearch = { ...result, products: result.products.map(withCurrentExpiry).filter(product => product.expiry_status !== 'expired') }; return latestImageSearch }
  const form = new FormData(); form.append('image', file)
  const response = await fetch(`${API_BASE}/api/search/image`, { method: 'POST', body: form, credentials: 'omit', headers: apiHeaders() })
  if (!response.ok) throw new ApiError(response.status, 'INTERNAL_ERROR', 'Could not search this image.')
  const result = await response.json() as ImageSearchResult
  latestImageSearch = { ...result, products: result.products.map(withCurrentExpiry).filter(product => product.expiry_status !== 'expired') }
  return latestImageSearch
}
export async function getProduct(id:number):Promise<Product>{if(USE_MOCK){const {mockExpiryProduct}=await import('./mock-expiry');const expiryProduct=mockExpiryProduct(id);return expiryProduct??withCurrentExpiry(await mock.getProduct(id))}return withCurrentExpiry((await request<Product>('products/'+id)).data)}
export async function createOrder(body:CreateOrderRequest):Promise<{order:Order;created:boolean}>{if(USE_MOCK){const result=await mock.createOrder(body);for(const item of body.items){const product=await getProduct(item.productId);emitMockStockUpdate({productId:item.productId,availableCount:product.availableCount,inStock:product.inStock})}return result}const {data,status}=await request<Order|{order:Order}>('orders',body);return {order:'order' in data?data.order:data,created:status===201}}
export async function getOrder(id:string):Promise<Order>{return USE_MOCK?mock.getOrder(id):(await request<Order>('orders/'+encodeURIComponent(id))).data}
export async function getHealth():Promise<HealthResponse>{return USE_MOCK?mock.getHealth():(await request<HealthResponse>('health')).data}

export type VoiceCommandResponse = {
  transcript: string
  parsedIntent: { intent: 'search' | 'add_to_cart' | 'place_order'; productQuery: string; qty: number; city: string | null; via: 'voice' }
  results?: Product[]
  popup?: { title: string; message: string; order_id: string; status: 'CONFIRMED' }
  order?: Order
  updatedCart?: unknown[]
}
function anonymousCustomerId() {
  try {
    let id = localStorage.getItem('customer:anonymous:v1')
    if (!id) { id = generateId(); localStorage.setItem('customer:anonymous:v1', id) }
    return id
  } catch { return 'anonymous-session' }
}

const AUTH_TOKEN_KEY = 'auth:v1'
const AUTH_PROFILE_KEY = 'auth:profile:v1'
const DEMO_USERS_KEY = 'auth:demo-users:v1'
export type AuthUser = { id: string; name: string; email: string; city: string; lat: number; lng: number }
export type AuthLocation = { city: string; lat: number; lng: number }
export type StockUpdate = { productId: number; availableCount: number; inStock: boolean }
type AuthResult = { user: AuthUser; token: string }

export function getAuthToken() { try { return localStorage.getItem(AUTH_TOKEN_KEY) } catch { return null } }
export function apiHeaders(extra:Record<string,string> = {}) {
  const token = getAuthToken()
  return { 'ngrok-skip-browser-warning': 'true', ...extra, ...(token ? { Authorization: `Bearer ${token}` } : { 'x-customer-id': anonymousCustomerId() }) }
}
function storeAuth(result: AuthResult) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, result.token); localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(result.user)) } catch { /* Session remains active until this page is closed. */ }
  return result.user
}
function readDemoUsers(): AuthUser[] {
  try { const users: unknown = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) ?? '[]'); return Array.isArray(users) ? users.filter((user): user is AuthUser => !!user && typeof user.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string') : [] } catch { return [] }
}
function authError(response: Response, data: unknown) {
  const body = data as { error?: string | { message?: string; code?: ErrorCode } } | null
  const error = body?.error
  const message = typeof error === 'string' ? error : error?.message
  throw new ApiError(response.status, response.status === 409 ? 'VALIDATION_ERROR' : response.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR', message ?? 'Something went wrong. Please try again.')
}
async function authRequest(path: string, body?: Record<string, string>): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'omit', headers: apiHeaders(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
    const data = await response.json() as AuthResult
    if (!response.ok) authError(response, data)
    return data
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the store. Check your connection and try again.') }
}
export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthUser> {
  if (USE_MOCK) {
    const users = readDemoUsers()
    if (users.some(user => user.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError(409, 'VALIDATION_ERROR', 'Email already registered.')
    const user: AuthUser = { id: generateId(), name: input.name, email: input.email, city: 'Bengaluru', lat: 12.9716, lng: 77.5946 }
    try { localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([...users, user])) } catch { /* Demo account is limited to this browser session. */ }
    return storeAuth({ user, token: `demo-${generateId()}` })
  }
  return storeAuth(await authRequest('signup', input))
}
export async function logIn(input: { email: string; password: string }): Promise<AuthUser> {
  if (USE_MOCK) {
    const user = readDemoUsers().find(candidate => candidate.email.toLowerCase() === input.email.toLowerCase())
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Wrong email or password.')
    return storeAuth({ user, token: `demo-${generateId()}` })
  }
  return storeAuth(await authRequest('login', input))
}
export async function demoLogin(): Promise<AuthUser> {
  if (USE_MOCK) {
    const user: AuthUser = { id: 'demo-user', name: 'Demo User', email: 'demo@example.com', city: 'Bengaluru', lat: 12.9716, lng: 77.5946 }
    return storeAuth({ user, token: `demo-${generateId()}` })
  }
  return storeAuth(await authRequest('demo', {}))
}
export async function getMe(): Promise<AuthUser | null> {
  if (!getAuthToken()) return null
  if (USE_MOCK) { try { return JSON.parse(localStorage.getItem(AUTH_PROFILE_KEY) ?? 'null') as AuthUser | null } catch { return null } }
  const response = await fetch(`${API_BASE}/api/auth/me`, { headers: apiHeaders(), credentials: 'omit' })
  const data = await response.json() as AuthUser | { user: AuthUser }
  if (!response.ok) { clearStoredAuth(); return null }
  return 'user' in data ? data.user : data
}
function clearStoredAuth() { try { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_PROFILE_KEY) } catch { /* Ignore unavailable browser storage. */ } }
export async function logOut() {
  try { if (!USE_MOCK && getAuthToken()) await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'omit', headers: apiHeaders() }) }
  catch { /* The local session still ends when the service is unreachable. */ }
  finally { clearStoredAuth() }
}
export async function getLocationByIp(): Promise<AuthLocation> {
  if (USE_MOCK) return { city: 'Bengaluru', lat: 12.9716, lng: 77.5946 }
  return (await request<AuthLocation>('location/ip')).data
}
export async function updateLocation(location: AuthLocation): Promise<void> {
  if (!USE_MOCK) await request('me/location', location, 'PUT')
}
const STOCK_EVENT = 'mock-stock-update'
export function emitMockStockUpdate(update: StockUpdate) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STOCK_EVENT, { detail: update }))
}
export function getStockStream(productIds: number[], onUpdate: (update: StockUpdate, source: 'event' | 'snapshot') => void) {
  let disposed = false
  let pollTimer: ReturnType<typeof setInterval> | undefined
  const controller = new AbortController()
  const publish = (value: unknown, source: 'event' | 'snapshot' = 'snapshot') => {
    if (disposed) return
    const updates = Array.isArray(value) ? value : [value]
    updates.forEach(entry => {
      if (!entry || typeof entry !== 'object') return
      const row = entry as Record<string, unknown>
      const productId = Number(row.productId ?? row.product_id)
      const availableCount = Number(row.availableCount ?? row.available_count ?? row.stock)
      if (productIds.includes(productId) && Number.isFinite(availableCount)) onUpdate({ productId, availableCount: Math.max(0, availableCount), inStock: availableCount > 0 }, source)
    })
  }
  const poll = async () => { await Promise.all(productIds.map(async id => { try { const product = await getProduct(id); publish({ productId: id, availableCount: product.availableCount }) } catch { /* Keep the last known stock while polling recovers. */ } })) }
  const startPolling = () => { if (!disposed && !pollTimer) { void poll(); pollTimer = setInterval(() => void poll(), 10000) } }
  const mockHandler = (event: Event) => publish((event as CustomEvent<StockUpdate>).detail, 'event')
  if (USE_MOCK) { window.addEventListener(STOCK_EVENT, mockHandler); startPolling() }
  else {
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/stock/stream?productIds=${encodeURIComponent(productIds.join(','))}`, { headers: apiHeaders({ Accept: 'text/event-stream' }), signal: controller.signal, credentials: 'omit' })
        if (!response.ok || !response.body) throw new Error('Stock stream unavailable')
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
        while (!disposed) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() ?? ''
          for (const event of events) { const data = event.split(/\r?\n/).find(line => line.startsWith('data:'))?.slice(5).trim(); if (data) { try { publish(JSON.parse(data), 'event') } catch { /* Ignore malformed stock events. */ } } }
        }
        startPolling()
      } catch { startPolling() }
    })()
  }
  return () => { disposed = true; controller.abort(); if (pollTimer) clearInterval(pollTimer); if (USE_MOCK) window.removeEventListener(STOCK_EVENT, mockHandler) }
}
export async function sendVoiceCommand(transcript: string, city: string | null = null): Promise<VoiceCommandResponse> {
  if (!transcript.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Say or type a request first.')
  const idempotencyKey = generateId()
  if (USE_MOCK) return import('./mock-voice').then(({ mockVoiceCommand }) => mockVoiceCommand(transcript.slice(0, 300), city))
  const response = await fetch(`${API_BASE}/api/voice-command`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...apiHeaders() }, body: JSON.stringify({ transcript: transcript.slice(0, 300), city }) })
  let data: Record<string, unknown>
  try { data = await response.json() as Record<string, unknown> } catch { throw new ApiError(response.status, 'INTERNAL_ERROR', 'The server returned an unreadable response.') }
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : typeof (data.error as { message?: unknown } | undefined)?.message === 'string' ? String((data.error as { message: string }).message) : 'Something went wrong. Please try again.'
    const code: ErrorCode = response.status === 404 ? 'NOT_FOUND' : response.status === 409 ? 'OUT_OF_STOCK' : 'INTERNAL_ERROR'
    throw new ApiError(response.status, code, message)
  }
  return data as unknown as VoiceCommandResponse
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatContext = { city: string; cartProductIds: number[]; lastOrderId: string | null; lastProductIds?: number[] }
export type ChatAction = { label: string; href: string }
export type ChatResponse = { reply: string; products?: Product[]; actions?: ChatAction[]; via: 'qwen' | 'fallback' }

export async function sendChat(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
  const history = messages.slice(-20)
  if (USE_MOCK) return import('./mock-chat').then(({ mockChatReply }) => mockChatReply(history, context))
  const response = await fetch(`${API_BASE}/api/chat`, { method: 'POST', credentials: 'omit', headers: apiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ messages: history, context }) })
  if (!response.ok) throw new ApiError(response.status, 'INTERNAL_ERROR', 'The assistant request failed.')
  const data = await response.json() as Partial<ChatResponse>
  if (typeof data.reply !== 'string' || (data.products !== undefined && !Array.isArray(data.products))) throw new ApiError(response.status, 'INTERNAL_ERROR', 'The assistant returned an invalid response.')
  return { reply: data.reply, products: data.products, actions: Array.isArray(data.actions) ? data.actions.filter((action): action is { label: string; href: string } => !!action && typeof action === 'object' && typeof action.label === 'string' && typeof action.href === 'string' && action.href.startsWith('/')) : undefined, via: data.via === 'qwen' ? 'qwen' : 'fallback' }
}
