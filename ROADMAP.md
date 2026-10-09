# BizLaunch delivery roadmap

The original 39 steps are implemented in the current application. The expanded plan adds staff, wishlist, CRM, inventory history, returns, payment records, moderation, richer analytics and system settings. See [all 58 sections](docs/FEATURE_COVERAGE.md).

| Steps | Implemented workflow                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| 01–06 | Foundation, MongoDB models, verified registration, JWT/bcrypt authentication, middleware and roles           |
| 07–08 | Nested protected React routes and premium responsive authentication/email UI                                 |
| 09–15 | Business wizard, seller workspace, categories, catalog/images/variants and atomic inventory ledger           |
| 16–18 | Animated public homepage, marketplace, branded storefront and advanced filters                               |
| 19–23 | Private multi-store cart, quoted COD checkout, orders, tracking and customer workspace                       |
| 24–27 | Expenses, COGS/estimated profit, daily/weekly/monthly analytics, health score and insights                   |
| 28–30 | Verified reviews, seller replies/moderation, fixed/percentage coupons and Socket.IO/inbox notifications      |
| 31–33 | Admin oversight/verification, users/products/reviews/reports, platform analytics and transaction monitoring  |
| 34–37 | Validation/security, responsive screens, isolated test suites and non-destructive demo seeding               |
| 38    | Git repository, CI, README, API reference, project report, screenshots and user-specified GitHub destination |
| 39    | Integrated local project; external deployment/Cloudinary activation require service configuration            |

Additional modules: permission-based staff invitations, persistent wishlist/profile photo/password change, CRM, four-step branding/themes, inventory adjustments/history, COD receipt recording, inspected returns with exactly-once restock, admin-reviewed manual refund receipts, general settings and maintenance history.

Verification: 41 API/mail tests, 39 commerce tests on a replica set, 15 browser workflows, lint and production build. Tests use isolated databases and preserve normal user accounts.

MongoDB is required to run the API now. Production transactions require Atlas or a replica set. Gmail SMTP is configured locally. Cloudinary adapter is implemented; live cloud upload awaits credentials, while local uploads are available. A public deployment requires hosting/domain configuration. GitHub publication is reported only after a successful push.

GitHub publication completed on 2026-10-09: [rajmukut791/BizLaunch](https://github.com/rajmukut791/BizLaunch), branch `main`.