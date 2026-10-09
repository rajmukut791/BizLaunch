import ReportConcern from '../components/ReportConcern';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Search,
  Star,
  ShieldCheck,
  Store,
  Tags as ShoppingCategory,
} from 'lucide-react';
import { useResource } from '../lib/hooks';
import { currency } from '../lib/api';
import { State, Empty, PageTitle, ProductImage } from '../components/UI';
import { HomeHero, HomePromise, HomeSellerStory } from '../components/HomeExperience';
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
  const stores = useResource('/stores');
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
    <main className={home ? 'homepage' : undefined}>
      {home && (
        <>
          <HomeHero total={products.data?.total} />
          <HomePromise />
        </>
      )}
      <section className="container market-section" id={home ? 'discover' : undefined}>
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
        {home && (
          <div className="category-tabs">
            <button onClick={() => change('sort', 'newest')}>New products</button>
            <button onClick={() => change('sort', 'popular')}>Trending products</button>
            <button onClick={() => change('discount', 'true')}>Special offers</button>
          </div>
        )}
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
            <option value="popular">Popular products</option>
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
              for (const key of ['min', 'max', 'rating', 'available', 'discount', 'business']) {
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
            {!businessId && (
              <label>
                Store
                <select name="business" defaultValue={params.get('business') || ''}>
                  <option value="">All stores</option>
                  {stores.data?.stores.map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Minimum rating
              <select name="rating" defaultValue={params.get('rating') || ''}>
                <option value="">Any rating</option>
                {[3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}+ stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Availability
              <select name="available" defaultValue={params.get('available') || ''}>
                <option value="">All products</option>
                <option value="true">In stock</option>
              </select>
            </label>
            <label>
              Offers
              <select name="discount" defaultValue={params.get('discount') || ''}>
                <option value="">All prices</option>
                <option value="true">Discounted products</option>
              </select>
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
        <section className="container market-section">
          <PageTitle
            eyebrow="INDEPENDENT BRANDS"
            title="Meet your next favorite store."
            description="Discover businesses reviewed by the platform."
          />
          <div className="management-grid">
            {stores.data?.stores.map((store) => (
              <Link className="panel" key={store._id} to={'/stores/' + store.slug}>
                {store.logo && <img className="store-brand-logo" src={store.logo} alt="" />}
                <h3>{store.name}</h3>
                <p>{store.description}</p>
                <span className="text-link">Visit store ↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {home && <HomeSellerStory />}
    </main>
  );
}
function StoreReviews({ slug }) {
  const resource = useResource('/stores/' + encodeURIComponent(slug) + '/reviews');
  return (
    <section className="container content">
      <State resource={resource}>
        {resource.data && (
          <>
            <h2>Store reviews · {resource.data.rating || 'New'}</h2>
            {resource.data.reviews.length ? (
              resource.data.reviews.map((review) => (
                <article className="panel" key={review._id}>
                  <strong>
                    {review.rating} / 5 · {review.product?.name}
                  </strong>
                  <p>{review.comment}</p>
                  <small>{review.customer?.name}</small>
                  {review.reply && <blockquote>{review.reply}</blockquote>}
                </article>
              ))
            ) : (
              <Empty title="No store reviews yet" />
            )}
          </>
        )}
      </State>
    </section>
  );
}
export function Storefront() {
  const { slug } = useParams(),
    resource = useResource('/stores/' + encodeURIComponent(slug)),
    [tab, setTab] = useState('products');
  return (
    <State resource={resource}>
      {resource.data &&
        (() => {
          const business = resource.data.business;
          return (
            <>
              {business.coverImage && (
                <img
                  className="store-cover-image"
                  src={business.coverImage}
                  alt={business.name + ' cover'}
                />
              )}
              <div
                className={
                  'container store-banner store-theme-preview ' + (business.theme || 'sage')
                }
              >
                {business.logo ? (
                  <img
                    className="store-brand-logo"
                    src={business.logo}
                    alt={business.name + ' logo'}
                  />
                ) : (
                  <span className="icon-tile">
                    <Store />
                  </span>
                )}
                <div>
                  <span className="pill">
                    <ShieldCheck size={15} /> Platform verified business
                  </span>
                  <h1>{business.name}</h1>
                  <p>{business.description}</p>
                </div>
              </div>
              <nav className="container store-tabs" aria-label="Store sections">
                {['products', 'reviews', 'about'].map((value) => (
                  <button
                    className={'button ' + (tab === value ? 'primary' : 'secondary')}
                    key={value}
                    onClick={() => setTab(value)}
                  >
                    {value}
                  </button>
                ))}
              </nav>
              {tab === 'products' ? (
                <Marketplace businessId={business._id} storeName={business.name} />
              ) : tab === 'reviews' ? (
                <StoreReviews slug={slug} />
              ) : (
                <section className="container content">
                  <div className="panel store-about">
                    <h2>About {business.name}</h2>
                    <p>{business.description}</p>
                    <p>
                      {business.type} · {business.category}
                    </p>
                    <p>{business.address}</p>
                    <p>
                      {business.phone} · {business.email}
                    </p>
                    <ReportConcern business={business._id} label="Report this business" />
                    <h3>Delivery</h3>
                    <p>{business.deliveryOptions || 'Standard delivery'}</p>
                    <h3>Return policy</h3>
                    <p>{business.returnPolicy || 'Contact the seller to discuss a return.'}</p>
                    <div className="badges">
                      {Object.entries(business.socialLinks || {})
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <a
                            className="text-link"
                            key={key}
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {key} ↗
                          </a>
                        ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          );
        })()}
    </State>
  );
}

export function Discovery({ stores = false }) {
  const resource = useResource(stores ? '/stores' : '/categories');
  return (
    <main className="container content">
      <PageTitle
        eyebrow="DISCOVER BIZLAUNCH"
        title={stores ? 'Independent stores' : 'Shop by category'}
        description={
          stores
            ? 'Meet the businesses behind your next discovery.'
            : 'Find products that fit your everyday life.'
        }
      />
      <State resource={resource}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(stores ? resource.data?.stores : resource.data?.categories)?.map((item) => (
            <Link
              className="panel"
              key={item._id}
              to={stores ? '/stores/' + item.slug : '/marketplace?category=' + item._id}
            >
              <span className="icon-tile">{stores ? <Store /> : <ShoppingCategory />}</span>
              <h2>{item.name}</h2>
              <p className="muted">{stores ? item.description : 'Explore the collection'}</p>
              <span className="text-link">{stores ? 'Visit store' : 'Browse products'} ↗</span>
            </Link>
          ))}
        </div>
      </State>
    </main>
  );
}
