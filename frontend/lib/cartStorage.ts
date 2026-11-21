import {USE_MOCK} from './config'
export type CartItem = {productId:number;name:string;priceCents:number;currency:string;imageUrl:string|null;quantity:number;maxQuantity:number}
const key='cart:v1:'+(USE_MOCK?'mock':'live')
export function loadCart():CartItem[]{try{if(typeof window==='undefined')return [];const data=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(data)?data.filter((x:CartItem)=>x&&Number.isInteger(x.productId)&&typeof x.name==='string'&&Number.isInteger(x.priceCents)&&x.priceCents>=0&&typeof x.currency==='string'&&Number.isInteger(x.maxQuantity)&&x.maxQuantity>0&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=Math.min(10,x.maxQuantity)):[]}catch{return []}}
export function saveCart(items:CartItem[]){try{if(typeof window!=='undefined')localStorage.setItem(key,JSON.stringify(items))}catch{/* Storage may be disabled in private browsing. */}}
