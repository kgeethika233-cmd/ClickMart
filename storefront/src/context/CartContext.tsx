'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartStorageItem, clearCartStorage, loadCart, saveCart } from '../lib/cartStorage';

interface CartContextType {
  items: CartStorageItem[];
  itemCount: number;
  subtotalCents: number;
  add: (item: Omit<CartStorageItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartStorageItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveCart(items);
    }
  }, [items, mounted]);

  const add = (newItem: Omit<CartStorageItem, 'quantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === newItem.productId);
      const currentQty = existing ? existing.quantity : 0;
      const targetQty = Math.min(10, Math.min(newItem.maxQuantity, currentQty + quantity));

      if (existing) {
        return prev.map((i) =>
          i.productId === newItem.productId ? { ...i, quantity: targetQty, maxQuantity: newItem.maxQuantity } : i
        );
      }
      return [...prev, { ...newItem, quantity: targetQty }];
    });
  };

  const setQuantity = (productId: number, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId) {
            const clamped = Math.min(10, Math.min(i.maxQuantity, Math.max(1, quantity)));
            return { ...i, quantity: clamped };
          }
          return i;
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const remove = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clear = () => {
    setItems([]);
    clearCartStorage();
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotalCents,
        add,
        setQuantity,
        remove,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

