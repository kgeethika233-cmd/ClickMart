export const searchSynonyms: Record<string, string> = {
  bluetoth: 'bluetooth', blutooth: 'bluetooth', sari: 'saree', saree: 'saree',
  chappal: 'footwear', chappals: 'footwear', slippers: 'footwear',
  earphone: 'earphones', earbuds: 'earphones', airdopes: 'earphones',
  doodh: 'milk', joota: 'shoes', kapde: 'clothes',
}

export const multilingualTerms: Record<string, string> = {
  'பால': 'milk', 'பால்': 'milk', 'दूध': 'milk', 'चप्पल': 'footwear', 'साड़ी': 'saree', 'जूता': 'shoes', 'कपड़े': 'clothes',
  'పాలు': 'milk', 'చెప్పులు': 'footwear', 'చీర': 'saree', 'బూట్లు': 'shoes',
  paal: 'milk', doodh: 'milk', chappal: 'footwear', sari: 'saree', kapde: 'clothes', joota: 'shoes',
  earbud: 'earphones', earphones: 'earphones', bluetooth: 'bluetooth', headphones: 'headphones', speaker: 'speaker', shirt: 'clothes',
}

export function normalizeSearchTerm(term: string) {
  const value = term.trim().toLowerCase()
  return searchSynonyms[value] ?? multilingualTerms[value] ?? value
}
