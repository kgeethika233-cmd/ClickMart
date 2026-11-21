export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '').replace(/\/api$/, '')
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false'
