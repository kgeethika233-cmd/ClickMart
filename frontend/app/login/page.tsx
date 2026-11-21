import type { Metadata } from 'next'
import AuthPage from '@/components/auth-page'
export const metadata: Metadata = { title: 'Log in | Inventory Hub', description: 'Log in to your Inventory Hub account.' }
export default function LoginPage() { return <AuthPage mode="login" /> }
