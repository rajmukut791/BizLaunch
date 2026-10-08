import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  TrendingUp,
  ShoppingBag,
  Package,
  Wallet,
  Pencil,
  Trash2,
  Download,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api, currency, date, getId, downloadJson } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useApp } from '../context/state';
import {
  State,
  Empty,
  PageTitle,
  Badge,
  Form,
  Field,
  Textarea,
  Select,
  Action,
  ProductImage,
} from '../components/UI';
export function RevenueChart({ months }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={290}>
        <AreaChart data={months}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#087f6b" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#087f6b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e5" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => (value >= 1000 ? value / 1000 + 'k' : value)}
          />
          <Tooltip formatter={(value) => currency(value)} />
          <Legend />
          <Area
            isAnimationActive={false}
            name="Revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#087f6b"
            fill="url(#revenueFill)"
            strokeWidth={2.5}
          />
          <Area
            isAnimationActive={false}
            name="Profit"
            type="monotone"
            dataKey="profit"
            stroke="#d99542"
            fill="none"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function Stats({ data }) {
  return (
    <div className="stats-grid">
      {[
        [TrendingUp, 'Delivered revenue', currency(data.revenue)],
        [Wallet, 'Net profit', currency(data.profit)],
        [ShoppingBag, 'Total orders', data.orders],
        [Package, 'Active products', data.products],
      ].map(([Icon, label, value]) => (
        <div className="stat" key={label}>
          <Icon size={22} />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function SellerDashboard() {
  const business = useResource('/seller/business'),
    resource = useResource(business.data?.business ? '/seller/analytics' : null),
    { user } = useApp();
  return (
    <>
      <PageTitle
        eyebrow="LET'S MAKE THINGS HAPPEN"
        title={'Hello, ' + user.name.split(' ')[0] + '.'}
        description="A clear picture of your business, and where to go next."
        action={
          <Link className="button primary" to="/seller/products">
            <Plus size={17} /> Add a product
          </Link>
        }
      />
      <State resource={business}>
        {business.data && !business.data.business ? (
          <Empty
            title="Big things start with a little setup."
            description="Create your business and submit it for verification."
            to="/seller/business"
            label="Create my business"
          />
        ) : (
          <State resource={resource}>
            {resource.data && (
              <>
                <div className="workspace-banner">
                  <div>
                    <Badge>{business.data.business.verification}</Badge>
                    <h2>{business.data.business.name}</h2>
                    <p>Your business. Your next big move.</p>
                  </div>
                  <Link className="button light" to={'/stores/' + business.data.business.slug}>
                    View storefront <ArrowUpRight size={17} />
                  </Link>
                </div>
                <Stats data={resource.data.analytics} />
                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Your growth, at a glance</h2>
                      <span className="muted">Last 6 months</span>
                    </div>
                    <RevenueChart months={resource.data.analytics.months} />
                    <p className="muted small-text">
                      Revenue and product costs are recognized when orders are delivered.
                    </p>
                  </section>
                  <section className="panel">
                    <p className="eyebrow">BUSINESS HEALTH</p>
                    <div className="health-score">
                      {resource.data.analytics.health.score}
                      <span>/ 100</span>
                    </div>
                    <p className="muted">
                      A transparent score based on verification, stock, delivery, reviews and
                      profit.
                    </p>
                    <Link to="/seller/analytics" className="text-link">
                      See what makes your score ↗
                    </Link>
                  </section>
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Stock that needs attention</h2>
                    <Link className="text-link" to="/seller/inventory">
                      Manage inventory ↗
                    </Link>
                  </div>
                  {resource.data.analytics.lowStock.length ? (
                    resource.data.analytics.lowStock.map((p) => (
                      <div className="summary-row" key={p._id}>
                        <span>{p.name}</span>
                        <Badge>{p.stock + ' left'}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Your active products have healthy stock levels.</p>
                  )}
                </section>
              </>
            )}
          </State>
        )}
      </State>
    </>
  );
}
export function BusinessSettings() {
  const resource = useResource('/seller/business');
  return (
    <>
      <PageTitle
        eyebrow="YOUR BRAND'S HOME"
        title="My business"
        description="Create your store, then an administrator verifies it before products go public."
      />
      <State resource={resource}>
        {resource.data &&
          (() => {
            const business = resource.data.business;
            return (
              <div className="panel form-panel">
                {business && (
                  <div className="info-box">
                    <ShieldCheck />
                    <div>
                      <Badge>{business.verification}</Badge>
                      <p>{business.verificationNote || 'Verification status for your business'}</p>
                      {business.verification === 'rejected' && (
                        <Action
                          onClick={async () => {
                            await api('/seller/business', {
                              method: 'PATCH',
                              body: { resubmit: true },
                            });
                            resource.reload();
                          }}
                        >
                          Resubmit for review
                        </Action>
                      )}
                    </div>
                  </div>
                )}
                <Form
                  key={business?._id || 'new'}
                  submit={business ? 'Save business details' : 'Create business'}
                  success={business ? 'Business saved' : 'Business submitted for verification'}
                  onSubmit={async (values) => {
                    await api('/seller/business', {
                      method: business ? 'PATCH' : 'POST',
                      body: values,
                    });
                    resource.reload();
                  }}
                >
                  <Field
                    label="Business name"
                    name="name"
                    defaultValue={business?.name}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                  {!business && (
                    <Field
                      label="Store URL"
                      name="slug"
                      required
                      pattern="[a-z0-9-]{3,80}"
                      placeholder="my-great-store"
                    />
                  )}
                  {business && <p className="muted">Store URL: /stores/{business.slug}</p>}
                  <Textarea
                    label="Tell your story"
                    name="description"
                    defaultValue={business?.description}
                    maxLength={2000}
                  />
                  <Field
                    label="Business phone"
                    name="phone"
                    defaultValue={business?.phone}
                    required
                    minLength={5}
                    maxLength={30}
                  />
                  <Textarea
                    label="Business address"
                    name="address"
                    defaultValue={business?.address}
                    required
                    minLength={5}
                    maxLength={300}
                  />
                  {business && (
                    <p className="muted small-text">
                      Changing your name, phone or address submits your business for verification
                      again.
                    </p>
                  )}
                </Form>
              </div>
            );
          })()}
      </State>
    </>
  );
}
function VariantEditor({ variants, setVariants }) {
  const update = (index, key, value) =>
    setVariants(
      variants.map((variant, i) =>
        i === index
          ? { ...variant, [key]: ['price', 'cost', 'stock'].includes(key) ? Number(value) : value }
          : variant,
      ),
    );
  return (
    <section className="variant-editor">
      <div className="section-heading">
        <h3>Variants</h3>
        <button
          type="button"
          className="button secondary small"
          disabled={variants.length >= 30}
          onClick={() =>
            setVariants([...variants, { name: '', sku: '', price: 0, cost: 0, stock: 0 }])
          }
        >
          <Plus size={15} /> Add variant
        </button>
      </div>
      <p className="muted small-text">Each variant has its own price, cost, SKU and stock.</p>
      {variants.map((variant, index) => (
        <div className="variant-row" key={variant._id || index}>
          <Field
            label="Name"
            value={variant.name}
            onChange={(e) => update(index, 'name', e.target.value)}
            required
            maxLength={80}
          />
          <Field
            label="SKU"
            value={variant.sku}
            onChange={(e) => update(index, 'sku', e.target.value)}
            required
            maxLength={60}
          />
          <Field
            label="Price"
            type="number"
            min=".01"
            step=".01"
            value={variant.price}
            onChange={(e) => update(index, 'price', e.target.value)}
            required
          />
          <Field
            label="Cost"
            type="number"
            min="0"
            step=".01"
            value={variant.cost}
            onChange={(e) => update(index, 'cost', e.target.value)}
            required
          />
          <Field
            label="Stock"
            type="number"
            min="0"
            step="1"
            value={variant.stock}
            onChange={(e) => update(index, 'stock', e.target.value)}
            required
          />
          <button
            type="button"
            className="icon-button danger-text"
            disabled={!!variant._id}
            title={variant._id ? 'Set stock to zero to retire this variant' : 'Remove new variant'}
            aria-label={'Remove variant ' + (index + 1)}
            onClick={() => setVariants(variants.filter((_, i) => i !== index))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
    </section>
  );
}
function ProductEditor({ product, categories, onClose, reload }) {
  const [variants, setVariants] = useState(product?.variants || []);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{product ? 'Edit product' : 'A new discovery'}</h2>
        <button className="button secondary small" onClick={onClose}>
          Close editor
        </button>
      </div>
      <Form
        submit={product ? 'Save product' : 'Create product'}
        success="Product saved"
        onSubmit={async (values) => {
          const body = {
            ...values,
            price: Number(values.price || product?.price || 0),
            cost: Number(values.cost || 0),
            stock: Number(values.stock || 0),
            active: values.active === 'true',
            variants,
            ...(product ? { version: product.__v } : {}),
          };
          await api('/seller/products' + (product ? '/' + product._id : ''), {
            method: product ? 'PATCH' : 'POST',
            body,
          });
          reload();
          onClose();
        }}
      >
        <div className="form-grid">
          <Field
            label="Product name"
            name="name"
            defaultValue={product?.name}
            required
            minLength={2}
            maxLength={120}
          />
          <Select
            label="Category"
            name="category"
            defaultValue={getId(product?.category) || ''}
            required
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Description"
          name="description"
          defaultValue={product?.description}
          maxLength={4000}
        />
        {!variants.length && (
          <div className="form-grid three">
            <Field
              label="Selling price (BDT)"
              name="price"
              type="number"
              min=".01"
              step=".01"
              defaultValue={product?.price}
              required
            />
            <Field
              label="Unit cost (BDT)"
              name="cost"
              type="number"
              min="0"
              step=".01"
              defaultValue={product?.cost || 0}
              required
            />
            <Field
              label="Stock"
              name="stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.stock || 0}
              required
            />
          </div>
        )}
        <Select
          label="Listing status"
          name="active"
          defaultValue={product?.active === false ? 'false' : 'true'}
        >
          <option value="true">Active</option>
          <option value="false">Archived</option>
        </Select>
        <VariantEditor variants={variants} setVariants={setVariants} />
      </Form>
    </section>
  );
}
function ImageManager({ product, reload }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="text-link" onClick={() => setOpen(!open)}>
        Images ({product.images.length})
      </button>
      {open && (
        <div className="image-manager">
          <div className="image-thumbs">
            {product.images.map((src, index) => (
              <div key={src}>
                <img src={src} alt={product.name} />
                <Action
                  className="icon-button danger-text"
                  onClick={async () => {
                    await api('/seller/products/' + product._id + '/images/' + index, {
                      method: 'DELETE',
                      body: {},
                    });
                    reload();
                  }}
                >
                  ×
                </Action>
              </div>
            ))}
          </div>
          <Form
            submit="Upload image"
            onSubmit={async (_, element) => {
              const body = new FormData();
              body.append('image', element.elements.image.files[0]);
              await api('/seller/products/' + product._id + '/images', { method: 'POST', body });
              reload();
            }}
          >
            <Field
              label="PNG, JPEG or WebP · up to 5 MB"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
          </Form>
        </div>
      )}
    </div>
  );
}
export function Products() {
  const resource = useResource('/seller/products'),
    categories = useResource('/categories');
  const [editor, setEditor] = useState(undefined);
  return (
    <>
      <PageTitle
        eyebrow="YOUR PRODUCT COLLECTION"
        title="Products"
        description="Thoughtful products deserve a beautiful home."
        action={
          <button className="button primary" onClick={() => setEditor(null)}>
            <Plus size={17} /> New product
          </button>
        }
      />
      {editor !== undefined && (
        <ProductEditor
          key={editor?._id || 'new'}
          product={editor}
          categories={categories.data?.categories || []}
          onClose={() => setEditor(undefined)}
          reload={resource.reload}
        />
      )}
      <State resource={resource}>
        {resource.data?.products.length ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="table-product">
                        <ProductImage product={product} />
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.category?.name}</small>
                          <ImageManager product={product} reload={resource.reload} />
                        </div>
                      </div>
                    </td>
                    <td>
                      {currency(product.price)}
                      {product.variants.length > 0 && (
                        <small>{product.variants.length} variants</small>
                      )}
                    </td>
                    <td>
                      {product.variants.length
                        ? product.variants.reduce((sum, v) => sum + v.stock, 0)
                        : product.stock}
                    </td>
                    <td>
                      <Badge>{product.active ? 'active' : 'archived'}</Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={'Edit ' + product.name}
                          onClick={() => setEditor(product)}
                        >
                          <Pencil size={17} />
                        </button>
                        {product.active && (
                          <Action
                            className="icon-button danger-text"
                            confirm="Archive this product? Existing orders are kept."
                            onClick={async () => {
                              await api('/seller/products/' + product._id, {
                                method: 'DELETE',
                                body: {},
                              });
                              resource.reload();
                            }}
                          >
                            <Trash2 size={17} />
                          </Action>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Make room for your first product."
            description="Create your business first, then add products and images."
          />
        )}
      </State>
    </>
  );
}
export function Inventory() {
  const resource = useResource('/seller/products');
  return (
    <>
      <PageTitle
        eyebrow="EVERY UNIT COUNTS"
        title="Inventory"
        description="Set stock levels for each product or variant. Updates reject stale values to protect concurrent orders."
      />
      <State resource={resource}>
        {resource.data?.products.length ? (
          <div className="inventory-list">
            {resource.data.products
              .filter((p) => p.active)
              .map((product) => (
                <div className="panel" key={product._id + ':' + product.__v}>
                  <div className="section-heading">
                    <h3>{product.name}</h3>
                    <Badge>
                      {(product.variants.length
                        ? product.variants.reduce((s, v) => s + v.stock, 0)
                        : product.stock) <= 5
                        ? 'low stock'
                        : 'in stock'}
                    </Badge>
                  </div>
                  <Form
                    submit="Update inventory"
                    success="Inventory updated"
                    onSubmit={async (values) => {
                      const body = { version: product.__v };
                      if (product.variants.length)
                        body.variants = product.variants.map((variant) => ({
                          ...variant,
                          stock: Number(values[variant._id]),
                        }));
                      else body.stock = Number(values.stock);
                      await api('/seller/products/' + product._id, { method: 'PATCH', body });
                      resource.reload();
                    }}
                  >
                    <div className="form-grid">
                      {product.variants.length ? (
                        product.variants.map((v) => (
                          <Field
                            key={v._id}
                            name={v._id}
                            label={v.name + ' · ' + v.sku}
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={v.stock}
                            required
                          />
                        ))
                      ) : (
                        <Field
                          name="stock"
                          label="Available stock"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={product.stock}
                          required
                        />
                      )}
                    </div>
                  </Form>
                </div>
              ))}
          </div>
        ) : (
          <Empty title="No inventory yet" to="/seller/products" label="Add a product" />
        )}
      </State>
    </>
  );
}
export function Expenses() {
  const resource = useResource('/seller/expenses');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <>
      <PageTitle
        eyebrow="KNOW WHERE IT GOES"
        title="Expenses"
        description="Track operating costs. Product unit costs are recorded separately in product settings."
      />
      <section className="panel">
        <h2>Add an expense</h2>
        <Form
          submit="Record expense"
          success="Expense recorded"
          onSubmit={async (values, element) => {
            await api('/seller/expenses', {
              method: 'POST',
              body: { ...values, amount: Number(values.amount) },
            });
            element.reset();
            resource.reload();
          }}
        >
          <div className="form-grid three">
            <Field label="Title" name="title" required minLength={2} maxLength={120} />
            <Field label="Amount (BDT)" name="amount" type="number" min=".01" step=".01" required />
            <Field label="Date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="form-grid">
            <Select label="Category" name="category">
              {['rent', 'marketing', 'utilities', 'salary', 'shipping', 'other'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Field label="Note (optional)" name="note" maxLength={1000} />
          </div>
        </Form>
      </section>
      <State resource={resource}>
        {resource.data?.expenses.length ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resource.data.expenses.map((expense) => (
                  <tr key={expense._id}>
                    <td>
                      <strong>{expense.title}</strong>
                      <small>{expense.note}</small>
                    </td>
                    <td>{expense.category}</td>
                    <td>{currency(expense.amount)}</td>
                    <td>{date(expense.date)}</td>
                    <td>
                      <Action
                        className="icon-button danger-text"
                        confirm="Delete this expense?"
                        onClick={async () => {
                          await api('/seller/expenses/' + expense._id, {
                            method: 'DELETE',
                            body: {},
                          });
                          resource.reload();
                        }}
                      >
                        <Trash2 size={17} />
                      </Action>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A clean slate for your finances."
            description="Record your first operating expense above."
          />
        )}
      </State>
    </>
  );
}
export function Analytics() {
  const resource = useResource('/seller/analytics');
  return (
    <>
      <PageTitle
        eyebrow="A CLEARER WAY FORWARD"
        title="Analytics & business health"
        description="Real business data, with a transparent score you can act on."
      />
      <State resource={resource}>
        {resource.data && (
          <>
            <Stats data={resource.data.analytics} />
            <section className="panel">
              <h2>Revenue & profit</h2>
              <RevenueChart months={resource.data.analytics.months} />
              <p className="muted">
                Net profit = delivered revenue − delivered product costs − recorded expenses.
                Cancelled orders contribute no revenue.
              </p>
            </section>
            <div className="dashboard-grid">
              <section className="panel">
                <h2>Business health</h2>
                <div className="health-score">
                  {resource.data.analytics.health.score}
                  <span>/ 100</span>
                </div>
                {resource.data.analytics.health.components.map((c) => (
                  <div className="health-component" key={c.label}>
                    <div>
                      <span>{c.label}</span>
                      <strong>
                        {c.earned} / {c.possible}
                      </strong>
                    </div>
                    <progress value={c.earned} max={c.possible} />
                  </div>
                ))}
                <p className="muted small-text">
                  This score is an operational indicator based on equally weighted components, not a
                  financial forecast.
                </p>
              </section>
              <section className="panel">
                <h2>The numbers behind your profit</h2>
                {[
                  ['Delivered revenue', 'revenue'],
                  ['Product costs', 'cost'],
                  ['Operating expenses', 'expenses'],
                  ['Net profit', 'profit'],
                ].map(([label, key]) => (
                  <div className="summary-row" key={key}>
                    <span>{label}</span>
                    <strong>{currency(resource.data.analytics[key])}</strong>
                  </div>
                ))}
                <div className="summary-row">
                  <span>Delivered orders</span>
                  <strong>{resource.data.analytics.delivered}</strong>
                </div>
                <div className="summary-row">
                  <span>Cancelled orders</span>
                  <strong>{resource.data.analytics.cancelled}</strong>
                </div>
                <div className="summary-row">
                  <span>Average customer rating</span>
                  <strong>{resource.data.analytics.rating || 'No reviews'}</strong>
                </div>
              </section>
            </div>
          </>
        )}
      </State>
    </>
  );
}
export function Coupons() {
  const resource = useResource('/seller/coupons');
  const [now] = useState(() => Date.now());
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE REASON TO SAY YES"
        title="Coupons"
        description="Discounts apply only to your store's items. Usage limits are enforced at checkout."
      />
      <section className="panel">
        <h2>Create a coupon</h2>
        <Form
          submit="Create coupon"
          success="Coupon created"
          onSubmit={async (values, element) => {
            await api('/seller/coupons', {
              method: 'POST',
              body: {
                ...values,
                percent: Number(values.percent),
                minimum: Number(values.minimum),
                limit: Number(values.limit),
                expiresAt: new Date(values.expiresAt).toISOString(),
              },
            });
            element.reset();
            resource.reload();
          }}
        >
          <div className="form-grid three">
            <Field
              label="Code"
              name="code"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_-]+"
              placeholder="LAUNCH10"
            />
            <Field
              label="Discount (%)"
              name="percent"
              type="number"
              min="1"
              max="80"
              step="1"
              required
            />
            <Field
              label="Minimum order (BDT)"
              name="minimum"
              type="number"
              min="0"
              step=".01"
              defaultValue="0"
              required
            />
          </div>
          <div className="form-grid">
            <Field label="Expires at" name="expiresAt" type="datetime-local" required />
            <Field
              label="Usage limit"
              name="limit"
              type="number"
              min="1"
              step="1"
              defaultValue="100"
              required
            />
          </div>
        </Form>
      </section>
      <State resource={resource}>
        {resource.data?.coupons.length ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Minimum</th>
                  <th>Used</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resource.data.coupons.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.code}</strong>
                    </td>
                    <td>{c.percent}%</td>
                    <td>{currency(c.minimum)}</td>
                    <td>
                      {c.used} / {c.limit}
                    </td>
                    <td>{date(c.expiresAt)}</td>
                    <td>
                      <Badge>
                        {new Date(c.expiresAt).getTime() < now
                          ? 'expired'
                          : c.active
                            ? 'active'
                            : 'disabled'}
                      </Badge>
                    </td>
                    <td>
                      <Action
                        onClick={async () => {
                          await api('/seller/coupons/' + c._id, {
                            method: 'PATCH',
                            body: { active: !c.active },
                          });
                          resource.reload();
                        }}
                      >
                        {c.active ? 'Disable' : 'Enable'}
                      </Action>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your first offer starts here." />
        )}
      </State>
    </>
  );
}
export function SellerReports() {
  const resource = useResource('/seller/reports/export');
  return (
    <>
      <PageTitle
        eyebrow="YOUR BUSINESS, ON RECORD"
        title="Business reports"
        description="Export a snapshot of revenue, costs, profit, stock and business health."
        action={
          <Action
            onClick={async () => {
              const data = await api('/seller/reports/export');
              downloadJson(data.report, 'bizlaunch-report.json');
            }}
          >
            <Download size={17} /> Export JSON
          </Action>
        }
      />
      <State resource={resource}>
        {resource.data && (
          <>
            <Stats data={resource.data.report} />
            <section className="panel">
              <h2>Monthly performance</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Revenue</th>
                      <th>Product costs</th>
                      <th>Expenses</th>
                      <th>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.report.months.map((m) => (
                      <tr key={m.key}>
                        <td>{m.key}</td>
                        <td>{currency(m.revenue)}</td>
                        <td>{currency(m.cost)}</td>
                        <td>{currency(m.expenses)}</td>
                        <td>{currency(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">{resource.data.report.recognition}. All amounts are in BDT.</p>
            </section>
          </>
        )}
      </State>
    </>
  );
}
