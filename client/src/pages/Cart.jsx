import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/state';
import { api, currency } from '../lib/api';
import { PageTitle, Empty, Form, Field } from '../components/UI';
export function Cart() {
  const { cart, setCart, user } = useApp(),
    total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <main className="container content">
      <PageTitle
        eyebrow="YOUR GOOD FINDS"
        title="Shopping cart"
        description="Prices and availability are confirmed at checkout."
      />
      {cart.length ? (
        <div className="cart-layout">
          <div className="panel">
            {cart.map((item) => (
              <div className="cart-line" key={item.key}>
                {item.image ? <img src={item.image} alt={item.name} /> : <ShoppingBag />}
                <div>
                  <Link to={'/products/' + item.product}>
                    <strong>{item.name}</strong>
                  </Link>
                  <p className="muted">
                    {item.variantName || 'Standard'} · {currency(item.price)}
                  </p>
                </div>
                <input
                  aria-label={'Quantity for ' + item.name}
                  type="number"
                  min="1"
                  max={Math.min(item.stock || 100, 100)}
                  value={item.quantity}
                  onChange={(event) =>
                    setCart(
                      cart.map((value) =>
                        value.key === item.key
                          ? {
                              ...value,
                              quantity: Math.max(
                                1,
                                Math.min(item.stock || 100, 100, Number(event.target.value) || 1),
                              ),
                            }
                          : value,
                      ),
                    )
                  }
                />
                <strong>{currency(item.price * item.quantity)}</strong>
                <button
                  className="icon-button danger-text"
                  aria-label={'Remove ' + item.name}
                  onClick={() => setCart(cart.filter((value) => value.key !== item.key))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <aside className="panel summary-card">
            <h2>Order summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{currency(total)}</strong>
            </div>
            <div className="summary-row">
              <span>Delivery</span>
              <strong>Free</strong>
            </div>
            <p className="muted">Coupon discounts are calculated when you place your order.</p>
            <div className="summary-row total">
              <span>Estimated total</span>
              <strong>{currency(total)}</strong>
            </div>
            {!user || user.role === 'customer' ? (
              <Link
                className="button primary full"
                to={user ? '/checkout' : '/login?next=/checkout'}
              >
                Continue to checkout →
              </Link>
            ) : (
              <p className="error">Use a customer account to place orders.</p>
            )}
            <Link className="text-link" to="/marketplace">
              Keep discovering ↗
            </Link>
          </aside>
        </div>
      ) : (
        <Empty
          title="A little empty, a lot of possibility."
          description="Discover something you love and add it to your cart."
          to="/marketplace"
          label="Explore marketplace"
        />
      )}
    </main>
  );
}
export function Checkout() {
  const { cart, setCart, user } = useApp(),
    navigate = useNavigate(),
    key = useRef(crypto.randomUUID());
  const [placed, setPlaced] = useState(false),
    [quote, setQuote] = useState(null);
  if (!cart.length && !placed)
    return (
      <main className="container content">
        <Empty title="Your cart is empty" to="/marketplace" label="Explore marketplace" />
      </main>
    );
  return (
    <main className="container content">
      <PageTitle
        eyebrow="ONE MORE STEP"
        title="Make it yours."
        description="Cash on delivery. Shipping is free for this marketplace."
      />
      <div className="checkout-layout">
        <div className="panel">
          <h2>Delivery details</h2>
          <Form
            submit={quote ? 'Confirm order · ' + currency(quote.total) : 'Review order total'}
            onSubmit={async (values) => {
              const { couponCode, ...shipping } = values;
              const items = cart.map(({ product, variantId, quantity }) => ({
                product,
                variantId,
                quantity,
              }));
              if (!quote) {
                const response = await api('/checkout/quote', {
                  method: 'POST',
                  body: { items, couponCode },
                });
                setQuote(response.quote);
                return;
              }
              let response;
              try {
                response = await api('/checkout', {
                  method: 'POST',
                  headers: { 'Idempotency-Key': key.current },
                  body: {
                    shipping,
                    couponCode,
                    expectedTotal: quote.total,
                    paymentMethod: 'cod',
                    items,
                  },
                });
              } catch (error) {
                if (error.status === 409) setQuote(null);
                throw error;
              }
              setPlaced(true);
              setCart([]);
              navigate('/orders/' + response.order._id, { replace: true });
            }}
          >
            <div className="form-grid">
              <Field
                label="Full name"
                name="name"
                defaultValue={user.name}
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
              <Field
                label="Phone"
                name="phone"
                type="tel"
                defaultValue={user.phone}
                autoComplete="tel"
                required
                minLength={5}
                maxLength={30}
              />
            </div>
            <Field
              label="Street address"
              name="address"
              autoComplete="street-address"
              required
              minLength={5}
              maxLength={300}
            />
            <div className="form-grid">
              <Field
                label="City"
                name="city"
                autoComplete="address-level2"
                required
                minLength={2}
                maxLength={80}
              />
              <Field
                label="Postal code (optional)"
                name="postalCode"
                autoComplete="postal-code"
                maxLength={20}
              />
            </div>
            <Field
              label="Coupon code (optional)"
              name="couponCode"
              onChange={() => setQuote(null)}
              maxLength={30}
              placeholder="e.g. LAUNCH10"
            />
            <div className="info-box">
              <ShieldCheck size={21} />
              <span>
                <strong>Cash on delivery</strong>
                <br />
                Pay the confirmed total when your order arrives.
              </span>
            </div>
          </Form>
        </div>
        <aside className="panel summary-card">
          <h2>Your order</h2>
          {(quote?.items || cart).map((item) => (
            <div className="summary-row" key={item.key || item.product + ':' + item.variantId}>
              <span>
                {item.name}
                <small>
                  {item.variantName} × {item.quantity}
                </small>
              </span>
              <strong>{currency(item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-row">
            <span>Discount</span>
            <strong>−{currency(quote?.discount || 0)}</strong>
          </div>
          <div className="summary-row total">
            <span>{quote ? 'Confirmed total' : 'Estimated total'}</span>
            <strong>
              {currency(
                quote?.total ?? cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
              )}
            </strong>
          </div>
          <p className="muted">
            Review the confirmed price and discount before placing your order. If prices change,
            checkout asks you to review again.
          </p>
        </aside>
      </div>
    </main>
  );
}
