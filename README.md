# Nido API

This is the backend API for Nido, a NestJS-based application.

## Getting Started

Follow these steps to get the development environment up and running.

### 1. Start the Database

The project uses a PostgreSQL database running in a Docker container.

```bash
docker-compose up -d
```

This command will start the PostgreSQL container in detached mode.

### 2. Configure Environment Variables

Create a `.env` file in the root of the project with the following content:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=nido
```

### 3. Install Dependencies and Run the API

```bash
# Install dependencies
$ npm install

# Run the API in development mode
$ npm run start:dev
```

The API will be running at `http://localhost:3001`.

### 4. Test the "Hello World" Endpoint

You can test that the API is running by sending a request to the root endpoint:

```bash
curl http://localhost:3001
```

This should return "Hello World!".

## User Signup Flow

The user authentication and data synchronization are handled via Firebase and a dedicated endpoint in this API.

### Flow:

1.  **Client-Side Authentication**: A user signs up or logs in on the client application using Firebase Authentication.
2.  **ID Token**: Upon successful authentication, the client receives a Firebase ID token.
3.  **API Sync**: The client sends a `POST` request to the `/auth/sync` endpoint of this API, including the user's details in the request body.

### `POST /auth/sync`

This endpoint is responsible for creating a new user in the database or retrieving an existing one. It expects a JSON body with the following `CreateUserDto` structure:

```typescript
{
  "email": "user@example.com",
  "uid": "FIREBASE_USER_ID",
  "picture": "http://example.com/profile.jpg" // Optional
}
```

The service layer then uses the `uid` to find a user. If the user doesn't exist, a new one is created.

## License

This project is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).