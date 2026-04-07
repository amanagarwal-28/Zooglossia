# MongoDB & API Server Setup Guide

## Installation Steps

### 1. Install MongoDB Locally

**Windows (Chocolatey):**
```powershell
choco install mongodb.install -y
# alternative package:
# choco install mongodb -y
```

If Chocolatey source does not have the package, use winget:
```powershell
winget install --id MongoDB.Server --exact --accept-package-agreements --accept-source-agreements
```

**Windows (manual):**
Download from https://www.mongodb.com/try/download/community

After installation, create data directory:
```powershell
mkdir C:\data\db
```

### 2. Start MongoDB

**Windows (run as service):**
```powershell
net start MongoDB
```

**Windows (manual start):**
```powershell
mongod --dbpath C:\data\db
```

### 3. Verify Connection

```powershell
mongosh
# You should see > prompt in MongoDB shell
```

### 4. Start API Server

From `c:\Zooglossia\api-server`:
```powershell
npm install
npm start
# Or for development with auto-reload:
npm run dev
```

You should see:
```
[api] Zooglossia API listening on port 5000
[db] MongoDB connected
```

## Environment Variables (.env)

The `.env` file contains:
- `MONGO_URI`: MongoDB connection string (local or Atlas)
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: API server port (default 5000)
- `AI_SERVICE_URL`: FastAPI service URL

## Testing the Integration

### 1. Register a User
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
# Returns: { "token": "...", "name": "Test User" }
```

### 3. Add a Pet (use token from login)
```bash
curl -X POST http://localhost:5000/pets \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Buddy",
    "species": "dog",
    "breed": "Labrador",
    "age_years": 3
  }'
```

### 4. Get User's Pets
```bash
curl -X GET http://localhost:5000/pets \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Delete a Pet
```bash
curl -X DELETE http://localhost:5000/pets/<PET_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

## Using MongoDB Atlas (Cloud)

### Setup:
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster (free tier available)
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/zooglossia`
4. Update `.env`:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/zooglossia
   ```

### Security:
- Keep `.env` file in `.gitignore` (never commit secrets)
- Change `JWT_SECRET` before production
- Use environment-specific secrets in production

## Troubleshooting

**"MongoDB connection error"**
- Verify mongod is running
- Check MONGO_URI in .env
- Try: `mongosh` to verify MongoDB is accessible

**"Email already registered"**
- This is expected if you try to register with the same email twice
- Use a different email or delete the user from MongoDB

**"Invalid credentials"**
- Verify password is correct
- Check email is lowercase in database

## Next Steps

After confirming MongoDB is working:
1. Test with mobile app to verify Bearer token flow
2. Implement pet CRUD in mobile app (currently in-memory only)
3. Add sync between mobile and cloud
