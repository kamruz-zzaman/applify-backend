# Applify Backend

Backend service for Applify application with authentication APIs built using Node.js, Express, and MongoDB.

## Features

- ✅ User Registration & Login
- ✅ JWT Authentication
- ✅ Password Hashing (bcrypt)
- ✅ Request Validation
- ✅ Rate Limiting
- ✅ Security Headers (Helmet)
- ✅ CORS Support
- ✅ Error Handling
- ✅ MongoDB Integration

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository and navigate to the backend directory:

```bash
cd applify-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/applify
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

## Running the Server

### Development mode (with auto-reload):

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in .env)

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Authentication

#### Register User

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Registration successful. Please login to continue.",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Login User

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Validation Rules

### Registration

- **Email**: Must be a valid email format
- **Password**: Minimum 6 characters, must contain at least one number

### Login

- **Email**: Must be a valid email format
- **Password**: Required

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Auth Endpoints**: 5 requests per 15 minutes per IP

## Security Features

- **Helmet**: Sets security HTTP headers
- **CORS**: Configured for frontend origin
- **Password Hashing**: bcrypt with salt rounds
- **JWT**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: express-validator for request validation

## Error Handling

All errors return a consistent JSON format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Optional array of validation errors
}
```

## Project Structure

```
applify-backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/
│   │   └── User.js              # User model
│   ├── routes/
│   │   └── auth.js              # Authentication routes
│   ├── middleware/
│   │   ├── validation.js        # Request validation
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── errorHandler.js      # Error handling
│   ├── utils/
│   │   └── jwt.js               # JWT utilities
│   └── server.js                # Main server file
├── .env.example                 # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Environment Variables

| Variable       | Description               | Default                           |
| -------------- | ------------------------- | --------------------------------- |
| PORT           | Server port               | 5000                              |
| NODE_ENV       | Environment mode          | development                       |
| MONGODB_URI    | MongoDB connection string | mongodb://localhost:27017/applify |
| JWT_SECRET     | Secret key for JWT        | -                                 |
| JWT_EXPIRES_IN | JWT expiration time       | 7d                                |
| FRONTEND_URL   | Frontend URL for CORS     | http://localhost:5173             |

## Testing with cURL

### Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## License

ISC
