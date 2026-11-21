import type { Metadata } from 'next'
import AuthPage from '@/components/auth-page'
export const metadata: Metadata = { title: 'Sign up | Inventory Hub', description: 'Create an Inventory Hub account.' }
export default function SignupPage() { return <AuthPage mode="signup" /> }
