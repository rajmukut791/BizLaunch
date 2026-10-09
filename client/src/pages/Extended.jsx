import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/state';
import { useResource } from '../lib/hooks';
import { api, currency, date, getId } from '../lib/api';
import {
  State,
  Empty,
  PageTitle,
  Form,
  Field,
  Select,
  Textarea,
  Action,
  Badge,
} from '../components/UI';
import { ProductCard } from './Marketplace';
export function Profile() {
  const resource = useResource('/profile'),
    { setUser, notify } = useApp();
  return (
    <main className="container content">
      <PageTitle
        eyebrow="ACCOUNT SETTINGS"
        title="Your profile"
        description="Your identity, contact details and account security."
      />
      <State resource={resource}>
        {resource.data && (
          <div className="management-grid">
            <section className="panel">
              <h2>Personal details</h2>
              <Form
                submit="Upload profile photo"
                success="Profile photo updated"
                onSubmit={async (_, form) => {
                  await api('/profile/images', { method: 'POST', body: new FormData(form) });
                  setUser((await api('/auth/me')).user);
                  resource.reload();
                }}
              >
                <Field
                  label="Profile photo"
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                />
              </Form>
              <p>{resource.data.profile.email} · Verified email</p>
              <Form
                submit="Save profile"
                success="Profile saved"
                onSubmit={async (values) => {
                  await api('/profile', { method: 'PATCH', body: values });
                  setUser((await api('/auth/me')).user);
                  resource.reload();
                }}
              >
                <Field
                  label="Full name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={resource.data.profile.name}
                />
                <Field
                  label="Phone"
                  name="phone"
                  maxLength={30}
                  defaultValue={resource.data.profile.phone}
                />
              </Form>
            </section>
            <section className="panel">
              <h2>Change password</h2>
              <Form
                submit="Update password"
                onSubmit={async (values) => {
                  if (values.password !== values.confirmPassword)
                    throw new Error('Passwords must match');
                  await api('/profile/password', { method: 'PATCH', body: values });
                  setUser(null);
                  notify('Password changed. Sign in again.');
                }}
              >
                <Field
                  label="Current password"
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                <Field
                  label="New password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
                <Field
                  label="Confirm new password"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </Form>
            </section>
          </div>
        )}
      </State>
    </main>
  );
}
export function Wishlist() {
  const resource = useResource('/wishlist');
  return (
    <main className="container content">
      <PageTitle
        eyebrow="YOUR COLLECTION"
        title="Saved discoveries"
        description="Keep the products you love close."
      />
      <State resource={resource}>
        {resource.data?.products.length ? (
          <div className="product-grid">
            {resource.data.products.map((product) => (
              <div key={product._id}>
                <ProductCard product={product} />
                <Action
                  onClick={async () => {
                    await api('/wishlist/' + product._id, { method: 'DELETE' });
                    resource.reload();
                  }}
                >
                  Remove from wishlist
                </Action>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Make room for favorites"
            description="Save a product from its details page."
            to="/marketplace"
            label="Explore products"
          />
        )}
      </State>
    </main>
  );
}
export function Customers() {
  const [params, setParams] = useSearchParams(),
    resource = useResource('/seller/customers?' + params.toString());
  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER RELATIONSHIPS"
        title="Your customers"
        description="Recognize returning customers and understand their purchases."
      />
      <form
        className="search-box"
        onSubmit={(event) => {
          event.preventDefault();
          setParams({ q: new FormData(event.currentTarget).get('q') });
        }}
      >
        <input
          aria-label="Search customers"
          name="q"
          placeholder="Name, email or phone"
          defaultValue={params.get('q') || ''}
        />
        <button>Search</button>
      </form>
      <State resource={resource}>
        {resource.data && (
          <>
            <p className="muted">
              {resource.data.summary.total} customers · {resource.data.summary.repeat} repeat
              customers
            </p>
            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Orders</th>
                    <th>Net delivered purchase</th>
                    <th>Last order</th>
                    <th>Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.customers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>{c.email}</small>
                        <small>{c.phone}</small>
                      </td>
                      <td>{c.orders}</td>
                      <td>
                        {currency(c.purchase)}
                        <small>Refunds {currency(c.refunds)}</small>
                      </td>
                      <td>{date(c.lastOrder)}</td>
                      <td>
                        <Badge>{c.repeat ? 'Repeat customer' : 'New customer'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!resource.data.customers.length && <Empty title="No customers found" />}
            </div>
          </>
        )}
      </State>
    </>
  );
}
export function ReviewManager({ mode }) {
  const resource = useResource('/' + mode + '/reviews');
  return (
    <main className={mode === 'customer' ? 'container content' : ''}>
      <PageTitle
        eyebrow="CUSTOMER VOICES"
        title={mode === 'customer' ? 'Your reviews' : 'Reviews'}
        description={
          mode === 'admin'
            ? 'Moderate with a reason. Hidden reviews are excluded from public ratings.'
            : 'Verified purchases, thoughtful feedback and seller replies.'
        }
      />
      <State resource={resource}>
        {resource.data?.reviews.length ? (
          resource.data.reviews.map((review) => (
            <section className="panel" key={review._id}>
              <div className="section-heading">
                <h2>{review.product?.name || 'Archived product'}</h2>
                <Badge>{review.hidden ? 'Hidden' : review.rating + ' / 5'}</Badge>
              </div>
              <p>{review.comment}</p>
              <p className="muted">
                {review.customer?.name} · {date(review.createdAt)}
              </p>
              {review.reply && (
                <blockquote>
                  <strong>Seller reply</strong>
                  <p>{review.reply}</p>
                </blockquote>
              )}
              {mode === 'seller' && (
                <Form
                  submit="Save reply"
                  success="Reply saved"
                  onSubmit={async (values) => {
                    await api('/seller/reviews/' + review._id + '/reply', {
                      method: 'PATCH',
                      body: values,
                    });
                    resource.reload();
                  }}
                >
                  <Textarea
                    label="Public seller reply"
                    name="reply"
                    required
                    minLength={2}
                    maxLength={1000}
                    defaultValue={review.reply}
                  />
                </Form>
              )}
              {mode === 'admin' && (
                <Form
                  submit={review.hidden ? 'Restore review' : 'Hide review'}
                  success="Moderation saved"
                  onSubmit={async (values) => {
                    await api('/admin/reviews/' + review._id, {
                      method: 'PATCH',
                      body: { ...values, hidden: !review.hidden },
                    });
                    resource.reload();
                  }}
                >
                  <Field
                    label="Moderation reason"
                    name="note"
                    required
                    minLength={5}
                    maxLength={500}
                  />
                </Form>
              )}
              {mode === 'customer' && (
                <Link className="text-link" to={'/products/' + getId(review.product)}>
                  View or update review ↗
                </Link>
              )}
            </section>
          ))
        ) : (
          <Empty title="No reviews yet" />
        )}
      </State>
    </main>
  );
}
export function AdminProducts() {
  const resource = useResource('/admin/products');
  return (
    <>
      <PageTitle
        eyebrow="CATALOG MODERATION"
        title="Platform products"
        description="Review the marketplace catalog and manage listing visibility."
      />
      <State resource={resource}>
        {resource.data?.products.map((product) => (
          <section className="panel" key={product._id}>
            <div className="section-heading">
              <div>
                <h2>{product.name}</h2>
                <p className="muted">
                  {product.business?.name} · {product.category?.name} · {currency(product.price)}
                </p>
              </div>
              <Badge>{product.active ? 'Active' : 'Hidden'}</Badge>
            </div>
            <Form
              submit={product.active ? 'Hide product' : 'Restore product'}
              success="Product visibility updated"
              onSubmit={async (values) => {
                await api('/admin/products/' + product._id, {
                  method: 'PATCH',
                  body: { ...values, active: !product.active },
                });
                resource.reload();
              }}
            >
              <Field
                label="Product moderation reason"
                name="note"
                minLength={5}
                maxLength={500}
                required
              />
            </Form>
          </section>
        ))}
      </State>
    </>
  );
}
export function InventoryHistory() {
  const [params, setParams] = useSearchParams(),
    resource = useResource('/seller/inventory/history?' + params),
    products = useResource('/seller/products');
  const [selected, setSelected] = useState('');
  const product = products.data?.products.find((p) => p._id === selected);
  return (
    <>
      <PageTitle
        eyebrow="TRACE EVERY STOCK CHANGE"
        title="Inventory history"
        description="Opening stock, purchases, order reservations, returns and adjustments."
      />
      <section className="panel">
        <h2>Record stock movement</h2>
        <Select
          label="Product to adjust"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose product</option>
          {products.data?.products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        {product && (
          <Form
            key={product._id + ':' + product.__v}
            submit="Record stock change"
            success="Stock movement recorded"
            onSubmit={async (values) => {
              await api('/seller/inventory/' + product._id + '/adjust', {
                method: 'POST',
                body: { ...values, delta: Number(values.delta), version: product.__v },
              });
              products.reload();
              resource.reload();
            }}
          >
            {product.variants.length > 0 && (
              <Select label="Variant" name="variantId">
                {product.variants.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name} · {v.stock} remaining
                  </option>
                ))}
              </Select>
            )}
            <div className="form-grid">
              <Select label="Movement type" name="type">
                <option value="PURCHASE">Purchase / restock</option>
                <option value="RETURN">Inspected return</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </Select>
              <Field
                label="Quantity change"
                name="delta"
                type="number"
                required
                step={1}
                min={-1000000}
                max={1000000}
              />
            </div>
            <Textarea
              label="Stock change reason"
              name="note"
              required
              minLength={5}
              maxLength={500}
            />
          </Form>
        )}
      </section>
      <section className="panel">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            for (const [k, v] of new FormData(event.currentTarget)) if (v) next.set(k, v);
            setParams(next);
          }}
        >
          <Select label="Filter product" name="product" defaultValue={params.get('product') || ''}>
            <option value="">All products</option>
            {products.data?.products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Filter movement" name="type" defaultValue={params.get('type') || ''}>
            <option value="">All movements</option>
            {['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <button className="button secondary">Apply</button>
        </form>
      </section>
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Before</th>
                    <th>Change</th>
                    <th>After</th>
                    <th>Note / date</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.movements.map((row) => (
                    <tr key={row.entry._id}>
                      <td>
                        {row.name}
                        <small>{row.entry.variantId}</small>
                      </td>
                      <td>
                        <Badge>{row.entry.type}</Badge>
                      </td>
                      <td>{row.entry.before}</td>
                      <td>
                        {row.entry.delta > 0 ? '+' : ''}
                        {row.entry.delta}
                      </td>
                      <td>{row.entry.after}</td>
                      <td>
                        {row.entry.note || row.entry.reference}
                        <small>{date(row.entry.at)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!resource.data.movements.length && <Empty title="No stock movements recorded" />}
            </div>
            <div className="order-pagination">
              <span>{resource.data.total} movements</span>
              <div>
                <button
                  className="button secondary"
                  disabled={resource.data.page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', resource.data.page - 1);
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {resource.data.page} of {resource.data.pages}
                </span>
                <button
                  className="button secondary"
                  disabled={resource.data.page >= resource.data.pages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', resource.data.page + 1);
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </State>
    </>
  );
}
export function About() {
  return (
    <main className="container content">
      <PageTitle
        eyebrow="BUILD YOUR NEXT CHAPTER"
        title="A business home, from first idea to next order."
        description="BizLaunch brings independent stores, customers and business operations into one connected platform."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {[
          ['Launch', 'Create your brand and storefront, then submit it for platform review.'],
          ['Sell', 'List products, manage variants and stock, and receive multi-store orders.'],
          [
            'Understand',
            'Track expenses, delivered sales, product costs and estimated operating profit.',
          ],
        ].map(([title, description]) => (
          <section className="panel" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </section>
        ))}
      </div>
      <p className="muted">
        Platform verification is a review of store information. Business profit is estimated from
        system-recorded transactions and expenses.
      </p>
      <Link className="button primary" to="/register">
        Start your journey
      </Link>
    </main>
  );
}
