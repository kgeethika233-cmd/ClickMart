'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera, Search, Upload, X } from 'lucide-react'
import { getAutocomplete, searchByImage, type AutocompleteResult, type ImageSearchResult } from '@/lib/api'
import { Button } from '@/components/ui/button'
import styles from './search-box.module.css'

function SearchField({ hero = false }: { hero?: boolean }) {
  const router = useRouter(), params = useSearchParams(), q = params.get('q') ?? ''
  const [text, setText] = useState(q), [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [data, setData] = useState<AutocompleteResult | null>(null), [active, setActive] = useState(-1), [cameraOpen, setCameraOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), request = useRef<AbortController | null>(null), composing = useRef(false), formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { setText(q) }, [q])
  useEffect(() => { const closeOutside = (event: PointerEvent) => { if (!formRef.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('pointerdown', closeOutside); return () => document.removeEventListener('pointerdown', closeOutside) }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); request.current?.abort() }, [])
  const go = (value: string) => { setOpen(false); setActive(-1); router.push('/search' + (value.trim() ? '?q=' + encodeURIComponent(value.trim()) : '')) }
  const schedule = (value: string) => {
    if (timer.current) clearTimeout(timer.current); request.current?.abort()
    if (value.trim().length < 2 || composing.current) { setOpen(false); setData(null); return }
    setOpen(true); setLoading(true)
    timer.current = setTimeout(async () => {
      const controller = new AbortController(); request.current = controller
      try { const result = await getAutocomplete(value.trim(), controller.signal); if (!controller.signal.aborted) setData(result) }
      catch { if (!controller.signal.aborted) setData({ suggestions: [], corrections: [], products: [] }) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
  }
  const options = [...(data?.suggestions ?? []).map((value) => ({ kind: 'suggestion', value })), ...(data?.corrections ?? []).map(item => ({ kind: 'correction', value: item.to })), ...(data?.products ?? []).map(item => ({ kind: 'product', value: item.name, id: item.id }))]
  const selectActive = () => { const selected = options[active]; if (selected && 'id' in selected) { setOpen(false); setActive(-1); router.push(`/product/${selected.id}`) } else if (selected) go(selected.value); else go(text) }
  return <>
    <form ref={formRef} role="search" aria-label={hero ? 'Explore the catalog' : 'Search the store'} className={hero ? 'search hero-search' : 'search top-search'} onSubmit={event => { event.preventDefault(); if (!composing.current) selectActive() }}>
      <Search size={18} aria-hidden="true" />
      <input aria-label="Search products" aria-autocomplete="list" aria-expanded={open} aria-controls="search-options" aria-activedescendant={active >= 0 ? `search-option-${active}` : undefined} maxLength={100} placeholder={hero ? 'What are you looking for?' : 'Search products…'} value={text}
        onCompositionStart={() => { composing.current = true; if (timer.current) clearTimeout(timer.current) }} onCompositionEnd={event => { composing.current = false; schedule(event.currentTarget.value) }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); return } if (event.key === 'ArrowDown' && open && options.length) { event.preventDefault(); setActive(index => Math.min(index + 1, options.length - 1)) } else if (event.key === 'ArrowUp' && open && options.length) { event.preventDefault(); setActive(index => Math.max(index - 1, 0)) } else if (event.key === 'Escape') setOpen(false) }}
        onChange={event => { setText(event.target.value); setActive(-1); schedule(event.target.value) }} onFocus={() => { if (text.trim().length >= 2) setOpen(true) }} />
      <button type="button" className={styles.cameraButton} aria-label="Search with a photo" onClick={() => setCameraOpen(true)}><Camera size={18}/></button>
      {hero && <Button type="submit">Search</Button>}
      {open && <div id="search-options" role="listbox" aria-label="Search suggestions" className={styles.dropdown} onMouseDown={event => event.preventDefault()}>
        {loading ? <div className={styles.status} role="status">Loading suggestions…</div> : !options.length ? <div className={styles.status}>No suggestions</div> : <>
          {!!data?.suggestions.length && <><p className={styles.sectionTitle}>Suggestions</p>{data.suggestions.map(value => <button type="button" role="option" aria-selected={active === options.findIndex(item => item.kind === 'suggestion' && item.value === value)} id={`search-option-${options.findIndex(item => item.kind === 'suggestion' && item.value === value)}`} key={`s-${value}`} onClick={() => go(value)}>{value}</button>)}</>}
          {!!data?.corrections.length && <><p className={styles.sectionTitle}>Did you mean</p>{data.corrections.map(item => <button type="button" role="option" aria-selected={active === options.findIndex(option => option.kind === 'correction' && option.value === item.to)} id={`search-option-${options.findIndex(option => option.kind === 'correction' && option.value === item.to)}`} key={`c-${item.from}`} onClick={() => go(item.to)}>{item.to}</button>)}</>}
          {!!data?.products.length && <><p className={styles.sectionTitle}>Products</p>{data.products.map((product, index) => { const optionIndex = options.findIndex(item => item.kind === 'product' && item.value === product.name); return <button type="button" role="option" aria-selected={active === optionIndex} id={`search-option-${optionIndex}`} className={styles.productOption} key={product.id} onClick={() => { setOpen(false); setActive(-1); router.push(`/product/${product.id}`) }}>{product.image_url ? <img src={product.image_url} alt=""/> : <span className={styles.thumb}/>}<span>{product.name}<small>{product.category}</small></span><strong>₹{product.price.toLocaleString('en-IN')}</strong></button> })}</>}
        </>}
      </div>}
    </form>
    {cameraOpen && <ImageSearchDialog onClose={() => setCameraOpen(false)} onResults={result => { window.dispatchEvent(new CustomEvent('inventory:image-results', { detail: result })); setCameraOpen(false); router.push('/search?image=1') }} />}
  </>
}

function ImageSearchDialog({ onClose, onResults }: { onClose: () => void; onResults: (result: ImageSearchResult) => void }) {
  const [tab, setTab] = useState<'Camera' | 'Upload'>('Camera'), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [captured, setCaptured] = useState(false)
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), input = useRef<HTMLInputElement>(null)
  const stopCamera = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  useEffect(() => { let disposed = false; if (tab === 'Camera' && !captured) { if (!navigator.mediaDevices?.getUserMedia) { setError('Camera is not available in this browser. Choose an image to upload.'); setTab('Upload') } else navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(value => { if (disposed) value.getTracks().forEach(track => track.stop()); else { stream.current = value; if (video.current) video.current.srcObject = value } }).catch(() => { if (!disposed) { setError('Camera access is unavailable. Choose an image to upload instead.'); setTab('Upload') } }) } return () => { disposed = true; stopCamera() } }, [tab, captured])
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); stopCamera() }, [preview])
  const chooseFile = (picked?: File) => { if (!picked) return; setError(''); if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) { setError('Choose a JPG, PNG, or WEBP image.'); return } if (picked.size > 5 * 1024 * 1024) { setError('Image must be 5 MB or smaller.'); return } setFile(picked); setPreview(URL.createObjectURL(picked)); setCaptured(true); stopCamera() }
  const capture = () => { if (!video.current) return; const canvas = document.createElement('canvas'); canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight; canvas.getContext('2d')?.drawImage(video.current, 0, 0); canvas.toBlob(blob => { if (blob) chooseFile(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })) }, 'image/jpeg', .9) }
  const submit = async () => { if (!file) return; setBusy(true); setError(''); try { onResults(await searchByImage(file)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not search this image. Please retry.') } finally { setBusy(false) } }
  return <div className={styles.overlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="photo-title" className={styles.dialog}><header className={styles.dialogHead}><h2 id="photo-title">Search with a photo</h2><button onClick={onClose} aria-label="Close"><X/></button></header><div className={styles.tabs}><button aria-pressed={tab === 'Camera'} onClick={() => { setTab('Camera'); setError('') }}>Camera</button><button aria-pressed={tab === 'Upload'} onClick={() => { setTab('Upload'); stopCamera(); setError('') }}>Upload</button></div>
    {tab === 'Camera' ? <div className={styles.cameraView}>{preview && captured ? <img src={preview} alt="Captured product"/> : <video ref={video} autoPlay playsInline muted aria-label="Live camera preview"/>}{captured && <button onClick={() => { setPreview(''); setFile(null); setCaptured(false) }}>Retake</button>}{!captured && <button onClick={capture}>Capture</button>}</div> : <div className={styles.uploadArea} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]) }}>{preview ? <img src={preview} alt="Selected product"/> : <><Upload/><p>Drop an image here or</p><button onClick={() => input.current?.click()}>Choose image</button><small>JPG, PNG, or WEBP · Up to 5 MB</small></>}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0])} hidden/></div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}<footer className={styles.dialogActions}><button onClick={onClose}>Cancel</button><button disabled={!file || busy} onClick={submit}>{busy ? 'Searching…' : 'Search with this photo'}</button></footer></section></div>
}
export default function SearchBox({ hero = false }: { hero?: boolean }) { return <Suspense fallback={<div className={hero ? 'search hero-search' : 'search top-search'}/>}><SearchField hero={hero}/></Suspense> }
