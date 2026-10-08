# Gmail verification and account recovery

MongoDB is required now: it stores users, password hashes, roles, verification state, token hashes, products and orders. The local service is already connected.

Enable 2-Step Verification on the sender Google account, then create an App Password:
https://support.google.com/accounts/answer/185833

Set these in the ignored server/.env file. Do not use the account's normal Google password.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-sender@gmail.com
SMTP_PASSWORD=your-google-app-password
MAIL_FROM=your-sender@gmail.com
```

Restart the API after configuring credentials. From the project root, run npm --prefix server run verify:accounts to send verification links to all three requested accounts. Open /verify-email, enter each account email, and request a verification link. Open the received link and press Verify my email, then sign in. No credential or link is printed to logs.

The three requested accounts have been provisioned with their requested roles and bcrypt passwords. They remain unverified until each mailbox receives and confirms its link. Personal passwords are not saved in the repository. Existing demo emails cannot log in in the normal application because they do not prove mailbox ownership. Verified demo fixtures exist only inside isolated automated test databases.

Verification links expire in 24 hours. Password reset links expire in 30 minutes. Tokens are random, stored only as SHA-256 hashes, consumed once, and replaced by a later request. Resends have a per-account 60-second cooldown and request rate limits. Verification grants no session; the user must sign in. Password reset invalidates all earlier JWT sessions.

Forgot password and resend responses do not reveal whether an eligible email exists. Unconfigured or failed SMTP returns a temporary-unavailability error. There is no development verification bypass.

Automated tests use an in-memory mail sink only when NODE_ENV=test and the connected database has an isolated test prefix. A mail-inspection endpoint is registered only for the isolated E2E server, never for normal development or production.

Gmail SMTP handles transactional verification and reset messages. Marketplace notifications continue to appear in the signed-in inbox. Live deployment still requires a public client URL, TLS, production MongoDB replica set, production email configuration and hosting credentials.
