# Firebase Cloud Functions for Penalty Wallet System

This folder contains template Cloud Functions for the real-money penalty system.

## Setup Instructions

### 1. Initialize Firebase Project
```bash
firebase init functions
```

### 2. Install Dependencies
```bash
cd functions
npm install stripe firebase-admin nodemailer
```

### 3. Set Environment Secrets
```bash
# Stripe
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Email (SendGrid or SMTP)
firebase functions:secrets:set SENDGRID_API_KEY
# OR for SMTP:
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

## Function Overview

| Function | Trigger | Purpose |
|----------|---------|---------|
| `createCheckoutSession` | HTTP | Creates Stripe Checkout for deposits |
| `stripeWebhook` | HTTP | Handles Stripe events (payment success) |
| `processPenalty` | HTTP | Deducts penalty, transfers to recipient, sends email |

## Stripe Connect (Required for Transfers)

To transfer money to the accountability partner's bank account, you need:

1. **Stripe Connect** enabled on your Stripe account
2. Each recipient needs a **Connected Account** (created once)
3. Use `stripe.transfers.create()` to move funds

### Alternative: Payout to Bank
If you don't use Connect, you can:
- Hold funds in your Stripe balance
- Generate a weekly report of penalties
- The user manually transfers to their accountability partner

## Security Notes

- All functions validate Firebase Auth tokens
- Stripe webhooks are verified with signing secrets
- IBAN is stored locally; Stripe handles actual transfers via Connected Accounts
- Rate limiting recommended for production
