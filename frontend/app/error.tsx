'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { document.title = 'Something went wrong | Inventory Hub' }, [])
  return <main className="wrap commerce-page"><section className="state-card"><span className="state-icon error-icon"><AlertTriangle /></span><p className="eyebrow">UNEXPECTED ERROR</p><h1>That didn&apos;t go as planned</h1><p>Something went wrong while loading this page. You can try again or return to the store.</p><div className="error-actions"><button className="primary-action" type="button" onClick={reset}><RotateCcw size={16} /> Try again</button><Link className="secondary-action" href="/">Back to the store</Link></div></section></main>
}
