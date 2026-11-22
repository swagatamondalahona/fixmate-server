# FixMate Backend — Smart Device & Home Appliance Repair Platform

FixMate Backend is a RESTful API built with Node.js and Express.js. It manages authentication, users, repair services, bookings, and secure Stripe payments for the FixMate platform.

## Live API

https://fixmate-server-navy.vercel.app

## Frontend

https://fixmate-gules-three.vercel.app

## GitHub Repositories

- Frontend: https://github.com/swagatamondalahona/fixmate
- Backend: https://github.com/swagatamondalahona/fixmate-server

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth
- JWT Authentication
- Stripe Checkout
- Stripe Webhooks
- Native Node.js Crypto API

## Main Features

### Authentication & Authorization
- Secure authentication with Better Auth
- JWT token verification
- Customer, Technician, and Admin role authorization
- Protected API routes

### User Management
- User profile management
- Role-based access control
- Admin user management

### Service Management
- Create and manage repair services
- Service approval system
- Search, category, mode, and sorting filters
- Public access to approved and available services

### Booking Management
- Create repair bookings
- Prevent duplicate active bookings
- Customer and Technician booking access control
- Booking status management
- Booking cancellation

### Payment Management
- Stripe Checkout integration
- Server-side payment verification
- Payment history
- Duplicate payment protection
- Stripe webhook endpoint with signature verification

## Database Collections

Business collections:

- users
- services
- bookings
- payments

Better Auth may also create its own authentication-related collections.

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/swagatamondalahona/fixmate-server.git
cd fixmate-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the backend root directory.

Configure the required environment variables:

```env
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name

BETTER_AUTH_URL=your_frontend_url
FRONTEND_URL=your_frontend_url

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_CURRENCY=usd
```

Never commit real credentials or secret keys to GitHub.

### 4. Run Backend Server

```bash
npm run dev
```

The backend runs locally at:

http://localhost:5000

## API Base URL

Local:

http://localhost:5000/api

Production:

https://fixmate-server-navy.vercel.app/api

## Stripe Webhook

Endpoint:

`POST /api/payments/webhook`

Configured event:

`checkout.session.completed`

The webhook endpoint verifies Stripe signatures before processing payment events.

## Deployment

Backend deployed on Vercel:

https://fixmate-server-navy.vercel.app

## Author

**Swagata Mondal**

GitHub: https://github.com/swagatamondalahona

---

Made with ❤️ for FixMate.
