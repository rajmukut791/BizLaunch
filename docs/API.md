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

Customer cancellation is allowed only from `placed`. Seller/admin cancellation is allowed before shipping. Delivered/cancelled are terminal in the ordinary status action; an inspected approved return changes delivered to returned through the separate return workflow. Each transition appends a timestamped event. Cancellation restores stock exactly once through an atomic status predicate and, in production, a database transaction.

## Health score

Six components total 100 points: sales growth (20), order completion (20), inventory condition (15), customer retention (15), financial performance (15) and customer ratings (15). The API returns earned/possible values and formula explanations.

## Email authentication

POST /api/auth/register creates an unverified account and sends a link; no session cookie.
POST /api/auth/resend-verification accepts email.
POST /api/auth/verify-email accepts token; a successful verification allows subsequent login.
POST /api/auth/forgot-password accepts email and returns a generic response.
POST /api/auth/reset-password accepts token and password; invalidates existing sessions.
All login and protected endpoints require emailVerified=true.

## Expanded business, customer and staff API

All paths below are relative to `/api`. Mutation requests use JSON except the image endpoints, which accept one multipart `image`. Access is checked by session, role, assigned business and granted permission. Staff are never authorized by a client-supplied business ID.

| Method/path                       | Access / behavior                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| GET /stores                       | Public approved/active store directory                                                 |
| GET /stores/:slug/reviews         | Public visible store reviews with customer/product names                               |
| GET /profile                      | Current account                                                                        |
| PATCH /profile                    | Current account; name and phone                                                        |
| PATCH /profile/password           | Current account; currentPassword/password; invalidates sessions                        |
| POST /profile/images              | Current account; PNG/JPEG/WebP avatar                                                  |
| GET /wishlist                     | Customer private available saved products                                              |
| PUT /wishlist/:productId          | Customer idempotent save                                                               |
| DELETE /wishlist/:productId       | Customer remove                                                                        |
| GET /cart                         | Customer private server-priced cart snapshot                                           |
| PUT /cart                         | Customer; items of product/variantId/quantity, maximum 50 unique lines                 |
| GET /customer/reviews             | Customer's own reviews, including moderation state                                     |
| GET /seller/customers?q=          | Seller/customer-permission staff; scoped CRM                                           |
| GET /seller/reviews               | Seller/review-permission staff; owned product reviews                                  |
| PATCH /seller/reviews/:id/reply   | Reply string, 2–1000 characters                                                        |
| GET /seller/inventory/history     | Owned stock ledger; product/type/page filters; 25 rows per page                        |
| POST /seller/inventory/:id/adjust | Product version, delta, type, note and optional variantId                              |
| POST /seller/business/images      | Seller/settings staff; multipart image and target logo/coverImage                      |
| GET /seller/insights?from=&to=    | Seller/finance staff; inclusive Bangladesh dates, at most one year                     |
| GET /seller/team                  | Owner only; memberships/invitations                                                    |
| POST /seller/team                 | Owner only; email and job manager/sales/inventory; emails seven-day invitation         |
| PATCH /seller/team/:id            | Owner only; job change or status revoked; invalidates member sessions                  |
| POST /team-invites/accept         | Invited verified customer/staff; token; changes membership/role and requires new login |
| GET /admin/products               | Admin catalog moderation workspace                                                     |
| PATCH /admin/products/:id         | Admin; active boolean and required note                                                |
| GET /admin/reviews                | Admin moderation workspace                                                             |
| PATCH /admin/reviews/:id          | Admin; hidden boolean and required note                                                |
| GET /admin/statistics             | Admin platform roles/stores/activity/net sales/refunds                                 |
| GET /platform/config              | Public platform name/contact/registration state                                        |
| GET /admin/settings               | Admin settings/version/history and service readiness booleans                          |
| PATCH /admin/settings             | Admin; platformName/supportEmail/supportPhone/allowRegistration/version                |

### Business and product extensions

Business POST/PATCH accepts category, type, email, theme (`sage`, `midnight`, `coral`), socialLinks (website/Facebook/Instagram HTTPS URLs), currency (`BDT`), deliveryOptions and returnPolicy in addition to the existing identity fields. Branding is uploaded separately. Identity changes re-submit verification; theme-only changes do not.

Product mutations accept sku, brand, subcategory, size, color, weight, regularPrice and listingStatus (`draft`, `active`, `archived`). Variants also accept size/color. Preserve saved variant IDs; setting a retired variant's stock to zero preserves historical order references. Public product responses remove costs and internal movements. Zero available quantity derives the out-of-stock display.

Public product filters add `business`, `rating` (0–5), `available=true`, `discount=true` and `sort=popular` to existing category/price/newest/price sorting. Search covers name/brand/SKU/description with escaped expressions. Search and listing queries never accept MongoDB operators from clients.

### Stock adjustment contract

```json
{
  "delta": 5,
  "type": "PURCHASE",
  "note": "Supplier delivery counted and received",
  "version": 4,
  "variantId": "OPTIONAL_VARIANT_OBJECT_ID"
}
```

PURCHASE and manual RETURN require positive deltas; ADJUSTMENT may be positive/negative. Quantities cannot become negative. A stale product version returns 409. The same atomic write changes stock and appends its before/after movement. Checkout and cancellation/inspected returns use this ledger logic automatically.

### Coupons and expenses

POST `/seller/coupons` supports discountType `percentage` or `fixed`, discountValue, minimum, limit, startsAt and expiresAt; the legacy percent field remains compatible. PATCH accepts an active toggle, or complete unused terms with version. DELETE permits only unused owned coupons. Start/expiry and usage constraints are enforced during quote and checkout, not merely by the UI.

PATCH `/seller/expenses/:id` validates the same complete title/category/amount/date/note fields as creation. Categories: rent, marketing, utilities, salary, shipping, packaging, product_purchase, other. Product-purchase cash entries are reported separately from profit's operating expenses to avoid duplicate COGS.

### Return and COD payment contracts

POST `/orders/:id/returns` accepts business and reason (10–1000 characters) for an owned delivered fulfillment. One whole-store return is allowed per fulfillment. PATCH `/orders/:id/returns/:returnId` is owned seller/order staff/admin only:

```json
{
  "status": "received",
  "note": "Every item physically received and inspected as resalable",
  "version": 1,
  "receivedConfirmed": true,
  "restock": true
}
```

Transitions: requested → approved/rejected, approved → received. Review notes and versions are mandatory. Receipt without physical confirmation fails. Restock restores all store quantities once within the transaction; non-resalable receipt does not restock. Fulfillment becomes returned. Refunds stay independent.

Delivery status mutation requires `paymentConfirmed: true` and may include paymentReference. It records the store's full discounted payable amount. PATCH `/orders/:id/payment` records a legacy delivered/returned fulfillment's outstanding COD collection with business, paymentConfirmed and required reference. Repeating collection cannot duplicate a receipt. Refund requests require a recorded paid fulfillment and accept delivered or returned status.

### Notifications and Socket.IO

GET `/notifications?page=1` returns 20 entries, total/pages/page and unread. PATCH `/notifications/:id/read` marks one owned item; PATCH `/notifications/read` marks all owned entries. The socket endpoint `/socket.io` uses the same session cookie and trusted origins. It emits `notification` with title/message/link only to that user's server-assigned room. Clients cannot choose another account's room. Session validity is checked at connection and periodically thereafter.

### Reports and financial meaning

POST `/reports` accepts business, targetType (`business`, `product`, `review`), optional targetId, and a reason. Product/review targets must belong to that business. Admin resolution/dismissal requires a resolution note of at least five characters.

Monthly and date-ranged analytics use Bangladesh time. Refunds reduce revenue at completion; resalable inspected returns reverse COGS at receipt. Product-purchase cash records are separate from operating expenses. The health score weights growth/completion 20 each and inventory/retention/financial performance/ratings 15 each, with earned points and explanations. These outputs are recorded estimated profit and operational indicators, not formal accounting or predictions.
