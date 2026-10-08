# API reference

Base path: `/api`. JSON responses use `{ success: true, ...data }` or `{ success: false, message }`. Mutations require JSON except image uploads. Browser requests include credentials; JWTs are kept in the `bizlaunch_session` HttpOnly cookie.

## Access rules

Customers, sellers and administrators have separate server-enforced permissions. Business/product/expense/coupon updates require ownership. Order queries are scoped to the customer or seller's store; seller responses contain only that store's items and totals. Cost prices are removed from public/customer responses. Suspended accounts and invalidated sessions lose access immediately.

Requests with another Origin or a cross-site Fetch Metadata header are rejected. SameSite=Strict cookies and JSON content-type enforcement protect browser mutations.

## Endpoints

| Method | Path                               | Access / purpose                                                           |
| ------ | ---------------------------------- | -------------------------------------------------------------------------- |
| GET    | /health, /ready                    | Public liveness / database readiness                                       |
| POST   | /auth/register                     | Public: name, email, password, optional phone, customer/seller role        |
| POST   | /auth/login                        | Public: email, password                                                    |
| GET    | /auth/me                           | Signed-in user                                                             |
| POST   | /auth/logout                       | Invalidates all sessions for current account                               |
| GET    | /categories                        | Public category list                                                       |
| GET    | /products                          | Public approved active stores; q, category, business, min, max, sort, page |
| GET    | /products/:id                      | Public product details and reviews                                         |
| GET    | /stores/:slug                      | Public approved store                                                      |
| GET    | /seller/business                   | Seller's business or null                                                  |
| POST   | /seller/business                   | Seller: name, slug, description, phone, address                            |
| PATCH  | /seller/business                   | Seller: editable details; resubmit rejected business                       |
| GET    | /seller/products                   | Seller's products including archived listings and costs                    |
| POST   | /seller/products                   | Seller: product fields and optional variants                               |
| PATCH  | /seller/products/:id               | Seller: editable fields plus current version                               |
| DELETE | /seller/products/:id               | Seller: archives listing and preserves order history                       |
| POST   | /seller/products/:id/images        | Seller: multipart image field; max 5 MB, 8 images                          |
| DELETE | /seller/products/:id/images/:index | Seller: detaches image                                                     |
| POST   | /checkout/quote                    | Customer: current line prices, discount and total; no stock reservation    |
| POST   | /checkout                          | Customer: shipping, items, couponCode, paymentMethod=cod, expectedTotal    |
| GET    | /orders, /orders/:id               | Customer / seller / admin scoped order data                                |
| PATCH  | /orders/:id/status                 | Status, business ID and optional trackingNumber                            |
| POST   | /products/:id/reviews              | Customer with delivered purchase: rating 1–5, comment                      |
| GET    | /seller/expenses                   | Seller's operating expenses                                                |
| POST   | /seller/expenses                   | Seller: title, category, amount, date, optional note                       |
| DELETE | /seller/expenses/:id               | Seller-owned expense                                                       |
| GET    | /seller/analytics                  | Delivered revenue, costs, expenses, profit, monthly trends, health         |
| GET    | /seller/reports/export             | Financial/operational JSON snapshot                                        |
| GET    | /seller/coupons                    | Seller-owned coupons                                                       |
| POST   | /seller/coupons                    | code, percent, minimum, expiresAt, limit                                   |
| PATCH  | /seller/coupons/:id                | active boolean                                                             |
| GET    | /notifications                     | User-owned inbox with unread count                                         |
| PATCH  | /notifications/read                | Mark current user's inbox read                                             |
| POST   | /reports                           | Signed-in user: business ID and reason                                     |
| GET    | /admin/overview                    | Admin platform counts and delivered revenue                                |
| GET    | /admin/businesses                  | Admin business submissions and owners                                      |
| PATCH  | /admin/businesses/:id              | verification, active, note                                                 |
| GET    | /admin/users                       | Admin user list; no passwords                                              |
| PATCH  | /admin/users/:id                   | active/suspended status; admin accounts protected                          |
| POST   | /admin/categories                  | Shared category creation                                                   |
| PATCH  | /admin/categories/:id              | name, description                                                          |
| DELETE | /admin/categories/:id              | Empty categories only                                                      |
| GET    | /admin/reports                     | Customer concerns                                                          |
| PATCH  | /admin/reports/:id                 | open/resolved/dismissed status, resolution                                 |

Product sort values: `newest`, `priceAsc`, `priceDesc`, `rating`. The public list returns 12 products per page.

Amounts are BDT with up to two decimal places. Stock is a non-negative integer. A variant contains `name`, `sku`, `price`, `cost`, `stock`, and its existing `_id` when editing. Variant SKUs must be unique within a product. Product responses expose `__v`; send it as `version` when editing. Stock reservations increment this version, preventing stale inventory edits.

## Checkout

Review a quote before submitting:

```json
{
  "items": [{ "product": "PRODUCT_OBJECT_ID", "quantity": 2, "variantId": "" }],
  "couponCode": "LAUNCH10"
}
```

Then POST `/checkout` with a unique `Idempotency-Key` header, the same items/coupon, the quoted `expectedTotal`, `paymentMethod: "cod"`, and shipping `name`, `phone`, `address`, `city`, `postalCode`. Prices and discounts are calculated on the server; client-supplied item prices are ignored. A changed total returns 409 before reserving stock. `expectedTotal` is optional for API clients; the UI always sends it after quote confirmation.

Retry the same checkout key after a network failure. A committed order is returned without reserving stock again. A concurrent request with the same key returns 409 while processing. A key is scoped to its customer.

Orders snapshot names, images, selected variants, selling prices and unit costs at checkout. Multi-store orders contain one fulfillment per business. `total` preserves the original order total; `payableTotal` excludes cancelled store fulfillments.

## Order transitions

`placed → confirmed → processing → shipped → delivered`.

Customer cancellation is allowed only from `placed`. Seller/admin cancellation is allowed before shipping. A terminal status cannot be changed. Each transition appends a timestamped event. Cancellation restores stock exactly once through an atomic status predicate and, in production, a database transaction.

## Health score

Five components contribute 20 points each: approved verification; fraction of active products above the low-stock threshold (5 units); delivered share of all store orders; weighted average product rating; positive net operating profit. An empty component earns zero. The score is an operational indicator, not a financial forecast.

## Email authentication

POST /api/auth/register creates an unverified account and sends a link; no session cookie.
POST /api/auth/resend-verification accepts email.
POST /api/auth/verify-email accepts token; a successful verification allows subsequent login.
POST /api/auth/forgot-password accepts email and returns a generic response.
POST /api/auth/reset-password accepts token and password; invalidates existing sessions.
All login and protected endpoints require emailVerified=true.
