# DHR-Backend

This repository is an Express.js backend for user registration and login. It now stores users in MongoDB instead of a local JSON file, which is better suited for EC2 or any cloud deployment.

## Requirements

- Node.js 18+ (or compatible)
- MongoDB connection string (local MongoDB or managed Atlas)
- `npm`

## Environment Variables

Create a `.env` file or provide environment variables when starting the app:

- `MONGODB_URI` - MongoDB connection string (default: `mongodb://127.0.0.1:27017/dhr-backend`)
- `PORT` - optional server port (default: `5000`)
- `JWT_SECRET` - optional JWT secret (default: `dev_secret`, but strongly recommended to set in production)

## Install

```bash
npm install
```

## Run locally

```bash
npm run start
```

Then open:

- `http://localhost:5000`

## API Endpoints

- `POST /amg-securities/register`
  - Body: `{ "fullName": "...", "username": "...", "password": "...", "phone": "..." }`
- `POST /amg-securities/login`
  - Body: `{ "username": "...", "password": "..." }`

## Test the API

Example using `curl`:

```bash
curl -X POST http://localhost:5000/amg-securities/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","username":"janedoe","password":"pass123","phone":"1234567890"}'

curl -X POST http://localhost:5000/amg-securities/login \
  -H "Content-Type: application/json" \
  -d '{"username":"janedoe","password":"pass123"}'
```

## EC2 Deployment (Recommended)

1. Provision an EC2 instance with Node.js installed.
2. Open security group ports for HTTP/HTTPS and optionally the app port.
3. Clone this repo onto the instance.
4. Set environment variables in the shell or a process manager (`MONGODB_URI`, `JWT_SECRET`, `PORT`).
5. Install dependencies:

```bash
npm install
```

6. Start the app using `npm run start`, or use a process manager like `pm2` or `systemd`.

Example with `pm2`:

```bash
npm install -g pm2
pm run start
# or
pm2 start server.js --name dhr-backend --watch --env production
```

## Notes

- The previous local JSON file storage is no longer used. User records are now stored in MongoDB.
- For production, use a managed MongoDB instance such as Atlas or a dedicated MongoDB server.
- Ensure `JWT_SECRET` is set in production for secure token signing.
