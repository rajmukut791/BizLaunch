import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { AppContext } from './state';
function readCart(includeOwned = false) {
  try {
    if (!includeOwned && localStorage.getItem('bizlaunch-cart-owner')) return [];
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
  const [initialCache] = useState(() => {
    try {
      return { owner: localStorage.getItem('bizlaunch-cart-owner'), items: readCart(true) };
    } catch {
      return { owner: null, items: [] };
    }
  });
  const cachedCart = useRef(initialCache);
  const cartOwner = useRef(null),
    hydratingCart = useRef(false);
  const [cartReady, setCartReady] = useState(null);
  const [config, setConfig] = useState({ platformName: 'BizLaunch' });
  useEffect(() => {
    const load = () =>
      api('/platform/config')
        .then((data) => setConfig(data.config))
        .catch(() => {});
    load();
    window.addEventListener('bizlaunch:config', load);
    return () => window.removeEventListener('bizlaunch:config', load);
  }, []);
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
      if (checking) return;
      localStorage.setItem('bizlaunch-cart', JSON.stringify(cart));
      if (user?.role === 'customer') localStorage.setItem('bizlaunch-cart-owner', user.id);
      else localStorage.removeItem('bizlaunch-cart-owner');
    } catch {
      /* In-memory fallback. */
    }
  }, [cart, user, checking]);
  useEffect(() => {
    if (!notice) return;
    toast(notice);
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const expired = () => {
      cartOwner.current = null;
      cachedCart.current = { owner: null, items: [] };
      setCart([]);
      setUser(null);
      setNotice('Please sign in again');
    };
    window.addEventListener('bizlaunch:unauthorized', expired);
    return () => window.removeEventListener('bizlaunch:unauthorized', expired);
  }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io({ withCredentials: true });
    socket.on('notification', (notification) => {
      toast(notification.title);
      window.dispatchEvent(new Event('bizlaunch:notification'));
    });
    return () => socket.disconnect();
  }, [user]);
  useEffect(() => {
    if (user?.role !== 'customer') {
      cartOwner.current = null;
      hydratingCart.current = false;
      return;
    }
    let active = true;
    cartOwner.current = user.id;
    hydratingCart.current = true;
    api('/cart')
      .then((data) => {
        if (!active) return;
        const ownCache = cachedCart.current.owner === user.id ? cachedCart.current.items : [];
        cachedCart.current = { owner: user.id, items: [] };
        setCart((current) => {
          const combined = new Map(data.items.map((item) => [item.key, item]));
          for (const item of [...ownCache, ...current]) {
            const priced = combined.get(item.key);
            combined.set(item.key, priced ? { ...priced, quantity: item.quantity } : item);
          }
          return [...combined.values()].slice(0, 50);
        });
        hydratingCart.current = false;
        setCartReady(user.id);
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (user?.role !== 'customer' || cartReady !== user.id || hydratingCart.current) return;
    const timer = setTimeout(() => {
      if (cartOwner.current === user.id)
        api('/cart', {
          method: 'PUT',
          body: {
            items: cart.map(({ product, variantId, quantity }) => ({
              product,
              variantId,
              quantity,
            })),
          },
        }).catch((error) => setNotice(error.message));
    }, 400);
    return () => clearTimeout(timer);
  }, [cart, cartReady, user]);
  const add = (product, variant, quantity = 1) => {
    const key = product._id + ':' + (variant?._id || '');
    setCart((current) => {
      const existing = current.find((item) => item.key === key),
        stock = variant?.stock ?? product.stock,
        count = Math.min((existing?.quantity || 0) + quantity, stock, 100);
      const item = {
        key,
        business: product.business?._id,
        businessName: product.business?.name,
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
    cartOwner.current = null;
    cachedCart.current = { owner: null, items: [] };
    setCart([]);
    setUser(null);
    setNotice('You have signed out');
  };
  return (
    <AppContext.Provider
      value={{
        user,
        config,
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
    </AppContext.Provider>
  );
}
