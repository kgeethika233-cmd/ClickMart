import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

export const metadata = { title: 'Page not found | Inventory Hub' }

export default function NotFound() {
  return <main className="wrap commerce-page"><section className="state-card"><span className="state-icon"><Search /></span><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page took a wrong turn</h1><p>The page you’re looking for isn’t here. Let’s get you back to the good finds.</p><Link className="primary-action" href="/"><ArrowLeft size={17} /> Back to the store</Link></section></main>
}
