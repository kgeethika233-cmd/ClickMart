'use client'
import {useQuery} from '@tanstack/react-query'
import Link from 'next/link'
import {ArrowRight} from 'lucide-react'
import {searchProducts} from '@/lib/api'
import ProductCard from './product-card'
import {Skeleton} from './ui/skeleton'
import {Button} from './ui/button'
export default function Featured(){const query=useQuery({queryKey:['products',{pageSize:8}],queryFn:()=>searchProducts({pageSize:8})});return <section className="featured"><div className="section-head"><div><p className="eyebrow">THE HUB EDIT</p><h2>Featured products</h2></div><Link className="view-all" href="/search">View all products <ArrowRight size={16}/></Link></div>{query.isError?<div role="alert">We couldn’t load the collection. <Button onClick={()=>query.refetch()}>Retry</Button></div>:<div className="products">{query.data?query.data.items.map(p=><ProductCard product={p} key={p.productId}/>):Array.from({length:8},(_,i)=><Skeleton key={i} className="h-72"/>)}</div>}</section>}
