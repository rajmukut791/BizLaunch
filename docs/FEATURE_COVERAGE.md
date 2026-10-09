# Coverage of the 58-section BizLaunch plan

This map records the implemented equivalent of each planning section. Example collection names and suggested tools are design guidance; embedded snapshots and source-derived analytics are used where they preserve consistency without duplication.

| Section                       | Delivered behavior / location                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Concept                     | Business operations and a public multi-vendor marketplace                                                                                                                         |
| 2 Roles                       | Admin, seller, customer and staff; manager/sales/inventory grants                                                                                                                 |
| 3 Registration/authentication | JWT cookie sessions, bcrypt, phone/confirmation, verified email, logout/reset and role checks                                                                                     |
| 4 Business creation           | Four-step wizard, branding/themes, contact/social links, BDT delivery/return policy, unique store URL                                                                             |
| 5 Seller dashboard            | Today/net sales, orders, pending, products, low stock, customers, expenses and estimated profit                                                                                   |
| 6 Product management          | Name/description/category/subcategory, prices/cost, stock/SKU/brand/images/attributes and lifecycle                                                                               |
| 7 Variants                    | Size/color, independent SKU, selling price, cost and stock; saved IDs preserved                                                                                                   |
| 8 Inventory                   | Aggregate/variant quantities, threshold five, out-of-stock recognition                                                                                                            |
| 9 Inventory history           | Embedded atomic PURCHASE, SALE, RETURN and ADJUSTMENT movements; scoped paginated ledger                                                                                          |
| 10 Marketplace                | 3D animated home, collections, categories, stores and public product listings                                                                                                     |
| 11 Advanced search            | Text field search, store/category/price/rating/stock/discount filters, sort and pagination; catalog indexes                                                                       |
| 12 Storefront                 | Logo/cover/theme, Products/Reviews/About, contact/social and store policies                                                                                                       |
| 13 Cart                       | Quantities, subtotal, current server quote, eligible discount, free delivery and total                                                                                            |
| 14 Multi-vendor cart          | Store grouping and independent fulfillment per store inside one order                                                                                                             |
| 15 Checkout                   | Name/phone/address/division/district/area/city/postcode, standard delivery and COD                                                                                                |
| 16 Orders                     | Placed, confirmed, processing, shipped, delivered, cancelled and inspected returned states                                                                                        |
| 17 Tracking                   | Timestamped per-store timeline and seller tracking reference                                                                                                                      |
| 18 Seller order panel         | Customer/order/date/status/refund search, pagination, scoped totals and management                                                                                                |
| 19 CRM                        | Customer name/contact, order counts, net delivered purchases, last order and repeat marker                                                                                        |
| 20 Expenses                   | Purchase, marketing, packaging, shipping, rent, salary, utilities and other; create/edit/delete                                                                                   |
| 21 Revenue/profit             | Delivered revenue, refunds, COGS, inspected return cost reversal, gross/net profit and expenses                                                                                   |
| 22 Sales analytics            | Today, date-ranged daily/weekly and six-month charts in Bangladesh time                                                                                                           |
| 23 Best sellers               | Delivered quantity/revenue ranking from order snapshots                                                                                                                           |
| 24 Slow movers                | In-stock active products with no delivered sale for 30+ days                                                                                                                      |
| 25 Health score               | Six transparent weighted components totaling 100 with formulas shown                                                                                                              |
| 26 Insights                   | Actual-data inventory/growth/expense/top-product/slow-stock messages                                                                                                              |
| 27 Reviews                    | Verified delivered purchase eligibility, ratings, seller replies and admin moderation                                                                                             |
| 28 Wishlist                   | Private database-persisted idempotent save/remove                                                                                                                                 |
| 29 Coupons                    | Percentage/fixed, minimum, start/expiry, atomic usage, activation and unused-term editing                                                                                         |
| 30 Notifications              | Database inbox, pagination/read state/unread badge and authenticated Socket.IO rooms                                                                                              |
| 31 Admin dashboard            | User/role/store/product/order/sales/pending/report counts; platform analytics                                                                                                     |
| 32 Business verification      | Platform approve/reject/re-submit/suspend with notes; owner suspension hides store                                                                                                |
| 33 Reports                    | Product/store/review concerns and admin resolution/dismissal; seller/analytics JSON exports                                                                                       |
| 34 Collections                | Users, businesses, members, categories, products, carts, orders, expenses, coupons, reviews, wishlists, notifications, reports, settings; variants/items/payment/ledgers embedded |
| 35 User model                 | Name/email/phone/password hash/role/avatar/status/verification/token version/timestamps                                                                                           |
| 36 Business model             | Owner, unique slug, identity/branding/contact/social, verification/active/theme/policies                                                                                          |
| 37 Product model              | Business/category/attributes/prices/cost/stock/images/variants/lifecycle/rating/ledger                                                                                            |
| 38 Order model                | Customer, snapshot items, totals/address, per-store payment/fulfillment/timeline/refunds/returns                                                                                  |
| 39 Expense model              | Business/category/title/amount/date/note/timestamps                                                                                                                               |
| 40 Pages                      | Public discovery/categories/stores/about/auth; customer profile/cart/order/wishlist/reviews; seller/staff and admin workspaces                                                    |
| 41 Folders                    | Separate client/server, reusable components/context/hooks and routes/controllers/services/models                                                                                  |
| 42 Architecture               | Route → authentication/permission → validation/controller/service → Mongoose → MongoDB                                                                                            |
| 43 REST API                   | Auth, business/catalog/cart/checkout/orders/inventory/expenses/coupons/reviews/notifications/analytics/admin; see API.md                                                          |
| 44 Security                   | Hashing, HttpOnly cookies, session revocation, ownership, permission checks, validation, magic bytes/size limits, rate limiting/CORS, secret isolation and errors                 |
| 45 Responsive                 | Mobile navigation, overflow-contained tables, adaptive grids/forms and reduced-motion behavior                                                                                    |
| 46 Style                      | Premium SaaS/commerce interface, CSS 3D homepage; restrained operational dashboards                                                                                               |
| 47 Frontend stack             | JavaScript React/Vite/Router/Axios/Tailwind/Hook Form/Recharts/Lucide/Hot Toast                                                                                                   |
| 48 Backend stack              | Node/Express/MongoDB/Mongoose/JWT/bcrypt/Multer/Cloudinary adapter/Socket.IO                                                                                                      |
| 49 Applications               | README local prerequisites; VS Code/Compass/Postman/Git/browser are developer tools                                                                                               |
| 50 Optional services          | Cloudinary integration supports credentials; Figma and GitHub Desktop are optional tools; no XAMPP                                                                                |
| 51 Setup                      | Install/verification/run commands and MongoDB requirement documented                                                                                                              |
| 52 Frontend creation          | Existing React/Vite client, installed dependency locks and scripts                                                                                                                |
| 53 Backend creation           | Existing Express/Mongoose server with installed dependencies and scripts                                                                                                          |
| 54 Environment                | Ignored server/.env, safe .env.example, trusted origins and service credentials                                                                                                   |
| 55 Development order          | Integrated phases completed; test suites exercise workflows rather than isolated placeholders                                                                                     |
| 56 Core-first scope           | Core plus wishlist, coupon, reviews, notifications, staff and health implemented                                                                                                  |
| 57 Academic value             | Combined commerce and small-business operations explained in PROJECT_REPORT.md                                                                                                    |
| 58 Final scope                | Full MERN/COD platform, documented integration boundaries, tests and GitHub workflow                                                                                              |

## External activation

Gmail SMTP is configured in the local environment. Cloudinary code is ready; a live hosted upload remains unverified until Cloudinary credentials are supplied. Local image uploads work. GitHub publication and deployment are separate from local test success; the final delivery states their actual result. A production URL requires hosting/domain configuration.

The plan explicitly allows COD, optional cloud image hosting and source-calculated analytics. Automatic bank refunds, actual courier integration, taxation and formal accounting are not represented as implemented.
