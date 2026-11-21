import type { Product } from '@/types/contract'
import { searchProducts as searchCatalog } from './mockApi'
import { normalizeSearchTerm, multilingualTerms } from './mock-synonyms'

export type AutocompleteResponse = {
  suggestions: string[]
  corrections: { from: string; to: string }[]
  products: { id: number; name: string; image_url: string | null; price: number; category: string }[]
}

export async function mockAutocomplete(q: string): Promise<AutocompleteResponse> {
  const words = q.trim().split(/\s+/).filter(Boolean)
  const normalized = words.map(normalizeSearchTerm)
  const corrections = words.flatMap((from, index) => normalized[index].toLowerCase() !== from.toLowerCase() ? [{ from, to: normalized[index] }] : [])
  const query = normalized.join(' ')
  const result = await searchCatalog({ q: query, pageSize: 5 })
  const suggestions = Array.from(new Set([query, ...Object.values(multilingualTerms).filter(term => term.startsWith(query))])).slice(0, 4)
  return { suggestions, corrections, products: result.items.slice(0, 4).map(product => ({ id: product.productId, name: product.name, image_url: product.imageUrl, price: product.priceCents / 100, category: product.category })) }
}

export async function mockSearchByImage(file: File): Promise<{ detected: { keywords: string[]; attributes: { color?: string; type?: string; material?: string }; via: 'filename' }; products: Product[] }> {
  const filename = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toLowerCase()
  const terms = filename.split(/\s+/).map(normalizeSearchTerm).filter(term => term.length > 1)
  let products: Product[] = []
  if (terms.length) products = (await searchCatalog({ q: terms.join(' '), pageSize: 8 })).items
  if (!products.length) products = (await searchCatalog({ pageSize: 5 })).items
  return { detected: { keywords: terms.length ? terms : ['popular picks'], attributes: {}, via: 'filename' }, products }
}
