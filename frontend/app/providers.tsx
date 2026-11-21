'use client'
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query'
import {useState,type ReactNode} from 'react'
import {Toaster} from 'sonner'
import Notify from '@/components/Notify'
import {CartProvider} from '@/context/CartContext'
import {AuthProvider} from '@/context/AuthContext'
import {getHealth} from '@/lib/api'
import {CONTRACT_VERSION} from '@/types/contract'
function Health(){useQuery({queryKey:['initial-health'],queryFn:async()=>{const health=await getHealth();if(health.contractVersion!==CONTRACT_VERSION)console.warn('Inventory Hub: backend contract version mismatch.',health.contractVersion,CONTRACT_VERSION);return health},staleTime:Infinity,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});return null}
export default function Providers({children}:{children:ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}}));return <QueryClientProvider client={client}><AuthProvider><CartProvider>{process.env.NODE_ENV==='development'&&<Health/>}{children}<Notify/><Toaster position="bottom-right"/></CartProvider></AuthProvider></QueryClientProvider>}
