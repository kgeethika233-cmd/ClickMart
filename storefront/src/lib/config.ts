// Next.js inlines process.env references only when written literally
const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const API_BASE = rawBase.replace(/\/+$/, '').replace(/\/api$/, '');

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
