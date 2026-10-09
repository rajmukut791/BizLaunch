import { useResource } from '../lib/hooks';
import '../pages/AdminPremium.css';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  Menu,
  ShoppingBag,
  ShoppingCart,
  X,
  LayoutDashboard,
  Store,
  Package,
  Boxes,
  Receipt,
  BarChart3,
  Ticket,
  ShieldCheck,
  Tags,
  Users,
  Flag,
  LogOut,
  Wrench,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../context/state';
import { Action } from './UI';
import MaintenanceBoundary from './Maintenance';
const sellerLinks = [
  ['/seller', 'Overview', LayoutDashboard],
  ['/seller/business', 'My business', Store],
  ['/seller/products', 'Products', Package],
  ['/seller/inventory', 'Inventory', Boxes],
  ['/seller/inventory/history', 'Stock history', Receipt],
  ['/seller/customers', 'Customers', Users],
  ['/seller/team', 'Staff & permissions', Users],
  ['/seller/reviews', 'Reviews', Tags],
  ['/seller/orders', 'Orders', ShoppingBag],
  ['/seller/expenses', 'Expenses', Receipt],
  ['/seller/analytics', 'Analytics & health', BarChart3],
  ['/seller/coupons', 'Coupons', Ticket],
  ['/seller/reports', 'Reports', Flag],
];
const adminLinks = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/businesses', 'Verification', ShieldCheck],
  ['/admin/categories', 'Categories', Tags],
  ['/admin/users', 'Users', Users],
  ['/admin/products', 'Products', Package],
  ['/admin/reviews', 'Reviews', Tags],
  ['/admin/orders', 'Orders', ShoppingBag],
  ['/admin/reports', 'Reports', Flag],
  ['/admin/maintenance', 'Maintenance', Wrench],
  ['/admin/analytics', 'Platform analytics', BarChart3],
  ['/admin/transactions', 'Transactions', Receipt],
  ['/admin/settings', 'System settings', Wrench],
];
export function Brand() {
  const { config } = useApp();
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <ArrowUpRight size={23} />
      </span>
      <span className="brand-name">{config.platformName || 'BizLaunch'}</span>
      <span className="brand-dot">.</span>
    </Link>
  );
}
export function Layout() {
  const { user, cart, logout, sessionError, config } = useApp();
  const notificationResource = useResource(user ? '/notifications' : null),
    { reload } = notificationResource;
  useEffect(() => {
    window.addEventListener('bizlaunch:notification', reload);
    return () => window.removeEventListener('bizlaunch:notification', reload);
  }, [reload]);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const dashboard = ['seller', 'staff'].includes(user?.role)
    ? '/seller'
    : user?.role === 'admin'
      ? '/admin'
      : '/dashboard';
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Brand />
          <nav className={menu ? 'top-nav open' : 'top-nav'} onClick={() => setMenu(false)}>
            <NavLink to="/marketplace">Marketplace</NavLink>
            <NavLink to="/categories">Categories</NavLink>
            <NavLink to="/stores">Stores</NavLink>
            {user && <NavLink to={dashboard}>Dashboard</NavLink>}
            {user?.role === 'customer' && <NavLink to="/wishlist">Wishlist</NavLink>}
            <NavLink to="/cart">
              Cart{' '}
              <span className="count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </NavLink>
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link to="/notifications" className="icon-button" aria-label="Notifications">
                  <Bell size={20} />
                  {notificationResource.data?.unread > 0 && (
                    <span className="notification-count">
                      {Math.min(99, notificationResource.data.unread)}
                    </span>
                  )}
                </Link>
                <Link to="/profile" className="avatar" title={user.name}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    user.name.slice(0, 1).toUpperCase()
                  )}
                </Link>
                <Action
                  className="icon-button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  <LogOut size={19} />
                </Action>
              </>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  Log in
                </Link>
                <Link className="button primary small" to="/register">
                  Get started <ArrowUpRight size={16} />
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? 'Close menu' : 'Open menu'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {sessionError && (
        <div className="container error" role="alert">
          {sessionError}
        </div>
      )}
      <MaintenanceBoundary>
        <Outlet />
      </MaintenanceBoundary>
      <footer className="footer">
        <div className="container footer-inner">
          <Brand />
          <div>
            <p>Built for your next big idea.</p>
            {config.supportEmail && (
              <a href={'mailto:' + config.supportEmail}>{config.supportEmail}</a>
            )}
          </div>
          <Link to="/marketplace">
            Explore marketplace <ArrowUpRight size={15} />
          </Link>
        </div>
      </footer>
    </>
  );
}
export function Workspace() {
  const { user } = useApp();
  const staffPermission = (to) =>
    to === '/seller'
      ? ''
      : to.includes('inventory')
        ? 'inventory'
        : to.includes('business')
          ? 'settings'
          : to.includes('products') || to.includes('coupons')
            ? 'products'
            : to.includes('orders')
              ? 'orders'
              : to.includes('customers')
                ? 'customers'
                : to.includes('reviews')
                  ? 'reviews'
                  : 'finance';
  const links =
    user.role === 'staff'
      ? sellerLinks.filter(
          ([to]) =>
            to === '/seller' ||
            (to !== '/seller/team' && user.permissions?.includes(staffPermission(to))),
        )
      : user.role === 'seller'
        ? sellerLinks
        : adminLinks;
  return (
    <div className={user.role === 'admin' ? 'workspace admin-workspace' : 'workspace'}>
      <aside className="sidebar">
        <p className="eyebrow">{user.role} workspace</p>
        {links.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
        <div className="sidebar-bottom">
          <Link to="/marketplace">
            <ShoppingCart size={18} /> Visit marketplace
          </Link>
          <p>
            One place. Every part
            <br />
            of your business.
          </p>
        </div>
      </aside>
      <main className="workspace-main">
        <Outlet />
      </main>
    </div>
  );
}
