import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useApp } from './context/state';
import { Layout, Workspace } from './components/Layout';
import { Empty } from './components/UI';
import Auth from './pages/Auth';
import EmailAuth from './pages/EmailAuth';
import ExperienceMotion from './components/ExperienceMotion';
import Marketplace, { Storefront } from './pages/Marketplace';
import Product from './pages/Product';
import { Cart, Checkout } from './pages/Cart';
import { Orders, OrderDetail, CustomerDashboard } from './pages/Orders';
import Notifications from './pages/Notifications';
const SellerDashboard = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.SellerDashboard })),
);
const BusinessSettings = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.BusinessSettings })),
);
const Products = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.Products })),
);
const Inventory = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.Inventory })),
);
const Expenses = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.Expenses })),
);
const Analytics = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.Analytics })),
);
const Coupons = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.Coupons })),
);
const SellerReports = lazy(() =>
  import('./pages/Seller').then((module) => ({ default: module.SellerReports })),
);
const AdminDashboard = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.AdminDashboard })),
);
const Businesses = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.Businesses })),
);
const Categories = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.Categories })),
);
const Users = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Users })));
const AdminReports = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.AdminReports })),
);
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function Protected({ roles, children }) {
  const { user, checking } = useApp(),
    location = useLocation();
  if (checking) return <div className="loading">Checking your session…</div>;
  if (!user)
    return <Navigate to={'/login?next=' + encodeURIComponent(location.pathname)} replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="container content">
        <Empty
          title="This area belongs to another account type"
          description="Use the dashboard for your account."
        />
        <Link
          className="button primary"
          to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/dashboard'}
        >
          Open my dashboard
        </Link>
      </div>
    );
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <ScrollReset />
      <ExperienceMotion />
      <AppProvider>
        <Suspense fallback={<div className="loading">Loading workspace…</div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Marketplace home />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="login" element={<Auth />} />
              <Route path="register" element={<Auth register />} />
              <Route path="verify-email" element={<EmailAuth />} />
              <Route path="forgot-password" element={<EmailAuth mode="forgot" />} />
              <Route path="reset-password" element={<EmailAuth mode="reset" />} />
              <Route path="products/:id" element={<Product />} />
              <Route path="stores/:slug" element={<Storefront />} />
              <Route path="cart" element={<Cart />} />
              <Route
                path="checkout"
                element={
                  <Protected roles={['customer']}>
                    <Checkout />
                  </Protected>
                }
              />
              <Route
                path="dashboard"
                element={
                  <Protected roles={['customer']}>
                    <CustomerDashboard />
                  </Protected>
                }
              />
              <Route
                path="orders"
                element={
                  <Protected roles={['customer']}>
                    <Orders />
                  </Protected>
                }
              />
              <Route
                path="orders/:id"
                element={
                  <Protected>
                    <OrderDetail />
                  </Protected>
                }
              />
              <Route
                path="notifications"
                element={
                  <Protected>
                    <Notifications />
                  </Protected>
                }
              />
              <Route
                path="seller"
                element={
                  <Protected roles={['seller']}>
                    <Workspace />
                  </Protected>
                }
              >
                <Route index element={<SellerDashboard />} />
                <Route path="business" element={<BusinessSettings />} />
                <Route path="products" element={<Products />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="orders" element={<Orders />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="coupons" element={<Coupons />} />
                <Route path="reports" element={<SellerReports />} />
              </Route>
              <Route
                path="admin"
                element={
                  <Protected roles={['admin']}>
                    <Workspace />
                  </Protected>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="businesses" element={<Businesses />} />
                <Route path="categories" element={<Categories />} />
                <Route path="users" element={<Users />} />
                <Route path="orders" element={<Orders />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>
              <Route
                path="*"
                element={
                  <main className="container content">
                    <Empty title="This page wandered off." to="/" label="Back to home" />
                  </main>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}
