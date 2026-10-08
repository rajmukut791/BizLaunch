import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Star,
  ShieldCheck,
  Truck,
  Store,
  Sparkles,
} from 'lucide-react';
import { useResource } from '../lib/hooks';
import { currency } from '../lib/api';
import { State, Empty, PageTitle, ProductImage } from '../components/UI';
export function ProductCard({ product }) {
  return (
    <Link className="product-card" to={'/products/' + product._id}>
      <ProductImage product={product} />
      <div className="product-meta">
        <span>{product.category?.name}</span>
        <span>
          <Star size={13} fill="currentColor" />{' '}
          {product.reviewCount ? product.rating.toFixed(1) : 'New'}
        </span>
      </div>
      <h3>{product.name}</h3>
      <p>{product.business?.name}</p>
      <div className="product-bottom">
        <strong>
          {product.variants?.length ? 'From ' : ''}
          {currency(product.price)}
        </strong>
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
    </Link>
  );
}
export default function Marketplace({ home = false, businessId, storeName }) {
  const [params, setParams] = useSearchParams();
  const categories = useResource('/categories');
  const search = new URLSearchParams(params);
  if (businessId) search.set('business', businessId);
  const products = useResource('/products?' + search.toString());
  function change(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }
  return (
    <main>
      {home && (
        <section className="hero container">
          <div className="hero-copy">
            <span className="pill">
              <span className="live-dot" /> BIG IDEAS. INDEPENDENT BRANDS.
            </span>
            <h1>
              Discover good things.
              <br />
              Launch <span>great things.</span>
            </h1>
            <p>
              A marketplace for thoughtful finds. A home for ambitious businesses. Find your next
              favorite, or build it yourself.
            </p>
            <div className="hero-actions">
              <Link className="button primary" to="/marketplace">
                Explore marketplace <ArrowRight size={18} />
              </Link>
              <Link className="button secondary" to="/register">
                Start your business <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="hero-proof">
              <span className="mini-avatars">
                <i>A</i>
                <i>R</i>
                <i>S</i>
              </span>
              <span>
                For the makers, dreamers & doers.
                <br />
                <strong>Your next chapter starts here.</strong>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-orbit" />
            <div className="art-label">
              <Sparkles size={16} /> Small brands. Big possibilities.
            </div>
            <div className="hero-product">
              <img src="/demo/bag.svg" alt="Illustrated everyday canvas tote" />
              <span className="art-badge">
                MADE FOR
                <br />
                EVERY DAY.
              </span>
            </div>
            <div className="floating-card">
              <span className="icon-tile">
                <Store size={23} />
              </span>
              <div>
                <strong>Your brand, your way</strong>
                <span>Build something that is yours.</span>
              </div>
              <ArrowUpRight size={20} />
            </div>
          </div>
        </section>
      )}
      <section className="container market-section">
        <PageTitle
          eyebrow={home ? 'THE MARKETPLACE' : 'CURATED BY INDEPENDENT BRANDS'}
          title={
            storeName
              ? 'Shop ' + storeName
              : home
                ? 'Find your next favorite.'
                : 'Good finds. Great stories.'
          }
          description="Discover products from verified local businesses."
          action={
            home && (
              <Link className="text-link" to="/marketplace">
                View everything <ArrowUpRight size={17} />
              </Link>
            )
          }
        />
        <div className="market-toolbar">
          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              change('q', new FormData(event.currentTarget).get('q'));
            }}
          >
            <Search size={19} />
            <input
              aria-label="Search products"
              name="q"
              placeholder="Search something you love…"
              defaultValue={params.get('q') || ''}
              key={params.get('q') || 'search'}
            />
            <button type="submit">Search</button>
          </form>
          <select
            aria-label="Sort products"
            value={params.get('sort') || 'newest'}
            onChange={(event) => change('sort', event.target.value)}
          >
            <option value="newest">Newest arrivals</option>
            <option value="priceAsc">Price: low to high</option>
            <option value="priceDesc">Price: high to low</option>
            <option value="rating">Highest rated</option>
          </select>
        </div>
        <div className="category-tabs">
          <button
            className={!params.get('category') ? 'selected' : ''}
            onClick={() => change('category', '')}
          >
            All discoveries
          </button>
          {categories.data?.categories.map((category) => (
            <button
              key={category._id}
              className={params.get('category') === category._id ? 'selected' : ''}
              onClick={() => change('category', category._id)}
            >
              {category.name}
            </button>
          ))}
        </div>
        {!home && (
          <form
            className="price-filter"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const next = new URLSearchParams(params);
              for (const key of ['min', 'max']) {
                if (data.get(key)) next.set(key, data.get(key));
                else next.delete(key);
              }
              next.delete('page');
              setParams(next);
            }}
          >
            <label>
              Min price
              <input
                name="min"
                type="number"
                min="0"
                step="0.01"
                defaultValue={params.get('min') || ''}
              />
            </label>
            <label>
              Max price
              <input
                name="max"
                type="number"
                min="0"
                step="0.01"
                defaultValue={params.get('max') || ''}
              />
            </label>
            <button className="button secondary small">Apply</button>
            <button type="button" className="text-link" onClick={() => setParams({})}>
              Clear filters
            </button>
          </form>
        )}
        <State resource={products}>
          {products.data?.products.length ? (
            <>
              <div className="product-grid">
                {products.data.products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              <div className="pagination">
                <span>
                  {products.data.total} products · Page {products.data.page} of{' '}
                  {products.data.pages}
                </span>
                <button
                  disabled={products.data.page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', products.data.page - 1);
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={products.data.page >= products.data.pages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', products.data.page + 1);
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <Empty
              title="Your next discovery is on its way"
              description="No matching products. Try different filters, or check back as sellers launch their stores."
            />
          )}
        </State>
      </section>
      {home && (
        <>
          <section className="trust-strip container">
            <div>
              <ShieldCheck />
              <span>
                <strong>Verified businesses</strong>Independent brands you can discover
              </span>
            </div>
            <div>
              <Truck />
              <span>
                <strong>Cash on delivery</strong>Pay when your order arrives
              </span>
            </div>
            <div>
              <Store />
              <span>
                <strong>Built for local sellers</strong>Tools to turn your idea into a business
              </span>
            </div>
          </section>
          <section className="seller-cta container">
            <div>
              <p className="eyebrow">YOUR NEXT CHAPTER</p>
              <h2>
                That idea you keep thinking about?
                <br />
                Give it a place to grow.
              </h2>
              <p>Your storefront, inventory, orders and insights. All together.</p>
            </div>
            <Link className="button light" to="/register">
              Let's build your business <ArrowUpRight size={19} />
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
export function Storefront() {
  const { slug } = useParams();
  const resource = useResource('/stores/' + encodeURIComponent(slug));
  return (
    <State resource={resource}>
      {resource.data && (
        <>
          <div className="container store-banner">
            <span className="icon-tile">
              <Store />
            </span>
            <div>
              <span className="pill">
                <ShieldCheck size={15} /> Verified business
              </span>
              <h1>{resource.data.business.name}</h1>
              <p>{resource.data.business.description}</p>
            </div>
          </div>
          <Marketplace
            businessId={resource.data.business._id}
            storeName={resource.data.business.name}
          />
        </>
      )}
    </State>
  );
}
