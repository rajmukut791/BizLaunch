# BizLaunch implementation roadmap

Implementation and local verification completed on **9 October 2026**. Checked steps represent working local features, with the integration scope described in the README.

- [x] 01. Project Foundation
- [x] 02. User Model
- [x] 03. Register API
- [x] 04. Login + JWT
- [x] 05. Authentication Middleware
- [x] 06. Roles: Admin / Seller / Customer
- [x] 07. React Router Architecture
- [x] 08. Premium Login/Register UI
- [x] 09. Business Creation
- [x] 10. Seller Dashboard
- [x] 11. Category Management
- [x] 12. Product CRUD
- [x] 13. Product Images
- [x] 14. Product Variants
- [x] 15. Inventory
- [x] 16. Public Marketplace
- [x] 17. Storefront
- [x] 18. Search + Filter
- [x] 19. Cart
- [x] 20. Checkout
- [x] 21. Orders
- [x] 22. Order Tracking
- [x] 23. Customer Dashboard
- [x] 24. Expense Management
- [x] 25. Revenue + Profit
- [x] 26. Analytics
- [x] 27. Business Health Score
- [x] 28. Reviews
- [x] 29. Coupons
- [x] 30. Notifications
- [x] 31. Admin Dashboard
- [x] 32. Business Verification
- [x] 33. Reports
- [x] 34. Security + Validation
- [x] 35. Responsive Final UI
- [x] 36. Testing
- [x] 37. Seeder / Demo Accounts
- [ ] 38. GitHub + README — README, API docs, local Git and CI prepared; remote upload awaits repository URL/authentication.
- [ ] 39. Final Project Complete — local application and verification complete; GitHub publication remains outstanding.

## Verification evidence

| Check                                          | Result                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| API integration suite on standalone MongoDB    | 26 passed                                        |
| Same API suite on isolated MongoDB replica set | 26 passed                                        |
| Browser workflows with Chromium                | 6 passed                                         |
| Client lint                                    | Passed without warnings                          |
| Client production build                        | Passed; dashboard bundles loaded separately      |
| Desktop and mobile screenshots                 | Inspected; mobile marketplace overflow corrected |
| Mobile customer/seller/admin routes            | 19 checked, no overflow or runtime errors        |
| Local database/API readiness                   | Connected and HTTP checks passed                 |

The API suite covers authentication, server-enforced role/ownership permissions, store verification, public cost redaction, input validation, image rejection, server-authoritative coupons/prices, quote confirmation, stale quotes, checkout replay, concurrent stock protection, multi-store and multi-variant orders, cancellation restocking, review eligibility, expense/profit calculations, reports, notifications, session invalidation and suspended seller visibility.

Browser workflows cover discovery/search/storefront, mobile layouts, registration, cart, coupon confirmation, checkout, cancellation, notification state, seller product creation/image upload, expenses, coupons, report downloads and administrator screens. Tests use unique databases and separate ports.

## Implemented integration choices

- Payments: cash on delivery; shipping is free.
- Tracking: timestamped fulfillment stages and seller-entered tracking reference.
- Notifications: in-app inbox.
- Reports: downloadable JSON financial/operational snapshots and monthly tables.
- Production checkout/cancellation: MongoDB replica-set transactions.
- Local standalone checkout: atomic inventory operations and compensation for request failures; process/database-crash recovery is not guaranteed.
- Demo seeder: non-destructive and disabled in production.

See [README](README.md) for setup, accounts and deployment requirements, and [API reference](docs/API.md) for endpoint contracts.
