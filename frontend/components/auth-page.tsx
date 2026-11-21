'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { demoLogin, logIn, signUp, ApiError } from '@/lib/api'
import { USE_MOCK } from '@/lib/config'
import { useAuth } from '@/context/AuthContext'

type Props = { mode: 'login' | 'signup' }
export default function AuthPage({ mode }: Props) {
  const router = useRouter()
  const { signIn } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (mode === 'signup' && !name.trim()) { setError('Enter your name.'); return }
    setPending(true)
    try { const user = mode === 'signup' ? await signUp({ name: name.trim(), email: email.trim(), password }) : await logIn({ email: email.trim(), password }); signIn(user); router.push('/') }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Email already registered.' : reason instanceof ApiError && reason.status === 401 ? 'Wrong email or password.' : reason instanceof Error ? reason.message : 'We could not sign you in. Please try again.') }
    finally { setPending(false) }
  }
  const continueDemo = async () => { setPending(true); setError(''); try { const user = await demoLogin(); signIn(user); router.push('/') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Demo sign-in is unavailable.') } finally { setPending(false) } }
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand"><span><ShoppingBag aria-hidden="true"/></span>Inventory Hub</Link><p className="eyebrow">YOUR EVERYDAY MARKETPLACE</p><h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1><p className="auth-intro">{mode === 'signup' ? 'Save your wishlist, orders, and delivery location.' : 'Sign in to see your orders, wishlist, and delivery updates.'}</p>
    <form onSubmit={submit} noValidate>
      {mode === 'signup' && <label className="auth-field">Name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required /></label>}
      <label className="auth-field">Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={!!error && !/^\S+@[^\s@]+\.[^\s@]+$/.test(email)} required /></label>
      <label className="auth-field">Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={8} aria-invalid={!!error && password.length < 8} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button></span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="auth-spin" aria-hidden="true"/> : <LockKeyhole aria-hidden="true"/>}{mode === 'signup' ? 'Create account' : 'Log in'}</button>
    </form>
    <div className="auth-divider"><span>or</span></div><button className="auth-demo" type="button" onClick={() => void continueDemo()} disabled={pending}>Continue as Demo User</button>{USE_MOCK && <p className="auth-demo-note">Demo mode: not secure</p>}
    <p className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to Inventory Hub?'} <Link href={mode === 'signup' ? '/login' : '/signup'}>{mode === 'signup' ? 'Log in' : 'Sign up'}</Link></p>
  </section></main>
}
