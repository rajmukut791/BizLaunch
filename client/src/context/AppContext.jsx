import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AppContext } from './state';
function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem('bizlaunch-cart') || '[]');
    return Array.isArray(items)
      ? items
          .filter(
            (item) =>
              typeof item.product === 'string' &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0 &&
              item.quantity <= 100,
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function AppProvider({ children }) {
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [sessionError, setSessionError] = useState(''),
    [cart, setCart] = useState(readCart),
    [notice, setNotice] = useState('');
  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch((error) => {
        if (error.status !== 401) setSessionError(error.message);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('bizlaunch-cart', JSON.stringify(cart));
    } catch {
      /* In-memory fallback. */
    }
  }, [cart]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setNotice('Please sign in again');
    };
    window.addEventListener('bizlaunch:unauthorized', expired);
    return () => window.removeEventListener('bizlaunch:unauthorized', expired);
  }, []);
  const add = (product, variant, quantity = 1) => {
    const key = product._id + ':' + (variant?._id || '');
    setCart((current) => {
      const existing = current.find((item) => item.key === key),
        stock = variant?.stock ?? product.stock,
        count = Math.min((existing?.quantity || 0) + quantity, stock, 100);
      const item = {
        key,
        product: product._id,
        variantId: variant?._id || '',
        variantName: variant?.name || '',
        name: product.name,
        image: product.images?.[0] || '',
        price: variant?.price ?? product.price,
        stock,
        quantity: count,
      };
      if (!count) return current;
      if (existing) return current.map((value) => (value.key === key ? item : value));
      return current.length < 50 ? [...current, item] : current;
    });
    setNotice('Cart updated');
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setUser(null);
    setNotice('You have signed out');
  };
  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        checking,
        sessionError,
        cart,
        setCart,
        add,
        logout,
        notice,
        notify: setNotice,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </AppContext.Provider>
  );
}
