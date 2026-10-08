import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, currency, date } from '../lib/api';
import { useApp } from '../context/state';
import { State, Form, Field, Textarea, Select, ProductImage, Badge } from '../components/UI';
export default function Product() {
  const { id } = useParams(),
    resource = useResource('/products/' + id),
    { user, add } = useApp();
  const [variantId, setVariant] = useState(''),
    [quantity, setQuantity] = useState(1),
    [image, setImage] = useState(0);
  return (
    <main className="container content">
      <State resource={resource}>
        {resource.data &&
          (() => {
            const { product, reviews } = resource.data,
              variant =
                product.variants.find((value) => value._id === variantId) || product.variants[0],
              stock = variant?.stock ?? product.stock;
            return (
              <>
                <div className="breadcrumbs">
                  <Link to="/marketplace">Marketplace</Link> / {product.category.name} /{' '}
                  {product.name}
                </div>
                <section className="product-detail">
                  <div>
                    <ProductImage
                      product={{
                        ...product,
                        images: product.images.length
                          ? [product.images[image] || product.images[0]]
                          : [],
                      }}
                      className="large"
                    />
                    <div className="image-thumbs">
                      {product.images.map((src, index) => (
                        <button
                          key={src}
                          className={image === index ? 'selected' : ''}
                          onClick={() => setImage(index)}
                          aria-label={'View image ' + (index + 1)}
                        >
                          <img src={src} alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="product-info">
                    <span className="eyebrow">{product.category.name}</span>
                    <h1>{product.name}</h1>
                    <Link className="text-link" to={'/stores/' + product.business.slug}>
                      By {product.business.name} ↗
                    </Link>
                    <div className="rating">
                      <Star size={17} fill="currentColor" />{' '}
                      {product.reviewCount ? product.rating.toFixed(1) : 'No ratings yet'}{' '}
                      <span className="muted">({product.reviewCount} reviews)</span>
                    </div>
                    <p className="detail-price">{currency(variant?.price ?? product.price)}</p>
                    <p className="description">{product.description}</p>
                    {product.variants.length > 0 && (
                      <Select
                        label="Choose a variant"
                        value={variant?._id}
                        onChange={(event) => {
                          setVariant(event.target.value);
                          setQuantity(1);
                        }}
                      >
                        {product.variants.map((value) => (
                          <option key={value._id} value={value._id}>
                            {value.name} — {currency(value.price)} ({value.stock} in stock)
                          </option>
                        ))}
                      </Select>
                    )}
                    <p>
                      <Badge>{stock ? 'In stock' : 'Out of stock'}</Badge>{' '}
                      <span className="muted">{stock} available</span>
                    </p>
                    <div className="add-to-cart">
                      <input
                        aria-label="Quantity"
                        type="number"
                        value={quantity}
                        min={1}
                        max={Math.min(stock || 1, 100)}
                        onChange={(event) =>
                          setQuantity(
                            Math.max(1, Math.min(stock || 1, 100, Number(event.target.value) || 1)),
                          )
                        }
                      />
                      <button
                        className="button primary"
                        disabled={!stock}
                        onClick={() => add(product, variant, quantity)}
                      >
                        <ShoppingBag size={18} /> Add to cart
                      </button>
                    </div>
                    <div className="product-assurances">
                      <span>
                        <ShieldCheck size={18} /> Verified independent store
                      </span>
                      <span>
                        <Truck size={18} /> Cash on delivery · Track every step
                      </span>
                    </div>
                  </div>
                </section>
                <section className="reviews-section">
                  <h2>From the community</h2>
                  <div className="reviews-layout">
                    <div>
                      {reviews.length ? (
                        reviews.map((review) => (
                          <article className="review panel" key={review._id}>
                            <div>
                              <strong>{review.customer?.name || 'Customer'}</strong>
                              <span className="rating">{'★'.repeat(review.rating)}</span>
                            </div>
                            <p>{review.comment}</p>
                            <small className="muted">{date(review.createdAt)}</small>
                          </article>
                        ))
                      ) : (
                        <p className="muted">
                          No reviews yet. Delivered purchases can leave the first review.
                        </p>
                      )}
                    </div>
                    {user?.role === 'customer' && (
                      <div className="panel">
                        <h3>Share your experience</h3>
                        <p className="muted">
                          Reviews are available after your order is delivered.
                        </p>
                        <Form
                          submit="Post review"
                          success="Your review has been saved"
                          onSubmit={async (values) => {
                            await api('/products/' + id + '/reviews', {
                              method: 'POST',
                              body: { ...values, rating: Number(values.rating) },
                            });
                            resource.reload();
                          }}
                        >
                          <Select label="Your rating" name="rating" defaultValue="5">
                            {[5, 4, 3, 2, 1].map((value) => (
                              <option value={value} key={value}>
                                {value} stars
                              </option>
                            ))}
                          </Select>
                          <Textarea
                            name="comment"
                            label="Your review"
                            required
                            minLength={3}
                            maxLength={1000}
                          />
                        </Form>
                      </div>
                    )}
                  </div>
                </section>
                {user && (
                  <details className="report-form">
                    <summary>Report a problem with this business</summary>
                    <Form
                      submit="Submit report"
                      success="Your report was sent to the administrator"
                      onSubmit={(values) =>
                        api('/reports', {
                          method: 'POST',
                          body: { ...values, business: product.business._id },
                        })
                      }
                    >
                      <Field
                        label="What happened?"
                        name="reason"
                        required
                        minLength={10}
                        maxLength={2000}
                      />
                    </Form>
                  </details>
                )}
              </>
            );
          })()}
      </State>
    </main>
  );
}
