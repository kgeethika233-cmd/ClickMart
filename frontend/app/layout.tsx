import type {Metadata,Viewport} from 'next'
import Link from 'next/link'
import Providers from './providers'
import { WishlistProvider } from '@/context/WishlistContext'
import Header from '@/components/header'
import ChatWidget from '@/components/chat/ChatWidget'
import {API_BASE,USE_MOCK} from '@/lib/config'
import './globals.css'
export const metadata:Metadata={title:'Inventory Hub | The Everyday Marketplace',description:'Explore electronics, fashion, home, books and sports from across India at Inventory Hub.',icons:{icon:'/hub.svg'}}
export const viewport:Viewport={colorScheme:'light',themeColor:'#ffffff',width:'device-width',initialScale:1}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-IN" className="light"><body className="antialiased"><WishlistProvider><Providers><Header/>{children}<ChatWidget/><footer><div className="wrap"><span>Inventory Hub <small>· The everyday marketplace</small></span><Link href="/under-the-hood" style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b', textDecoration: 'none' }}>Under the Hood</Link>{process.env.NODE_ENV==='development'&&<small className="mode">{USE_MOCK?'MOCK':`LIVE ${API_BASE}`}</small>}</div></footer></Providers></WishlistProvider></body></html>}
