'use client'

import Link from 'next/link'
import { GitCompareArrows, LogIn, LogOut, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react'
import SearchBox from './search-box'
import VoiceMic from './VoiceMic'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import styles from './header.module.css'
import LocationPicker from './location-picker'
import { useAuth } from '@/context/AuthContext'

export default function Header() {
  const { itemCount } = useCart()
  const { user, signOut } = useAuth()
  const { items } = useWishlist()

  return (
    <header>
      <div className="wrap nav">
        <Link className="brand" href="/">
          <span className="brand-icon"><ShoppingBag size={23} strokeWidth={2.3} /></span>
          Inventory<span className="brand-hub">Hub</span>
        </Link>
        <SearchBox />
        <VoiceMic />
        <LocationPicker />
        <Link href="/compare" className={`cart ${styles.compareNav}`} aria-label="Compare stores">
          <GitCompareArrows size={19} />Compare
        </Link>
        <Link href="/cart" className="cart">
          <ShoppingCart size={19} />Cart <span>{itemCount}</span>
        </Link>
        {user ? <details className={styles.accountMenu}>
          <summary><UserRound size={18} aria-hidden="true"/><span>{user.name}</span></summary>
          <div className={styles.accountDropdown}>
            <strong>{user.name}</strong>
            <Link href="/orders">My Orders</Link>
            <Link href="/wishlist">Wishlist <span>{items.length}</span></Link>
            <button type="button" onClick={() => void signOut()}><LogOut aria-hidden="true"/>Log out</button>
          </div>
        </details> : <div className={styles.authLinks}><Link href="/login"><LogIn aria-hidden="true"/>Login</Link><Link href="/signup">Sign up</Link></div>}
      </div>
    </header>
  )
}
