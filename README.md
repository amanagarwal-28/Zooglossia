# Zooglossia

Zooglossia is a full-stack pet vocalization analysis app with:

- A Node.js API server (auth, pets, analysis routing)
- A Python FastAPI AI service (audio + IoT inference pipeline)
- A React Native mobile app (Expo, supports Android/iOS/Web)
- MongoDB persistence for users and pets

## Project Structure

- api-server: Express API, JWT auth, MongoDB models and routes
- ai-service: FastAPI inference service
- mobile-app: Expo React Native client app
- MONGODB_SETUP.md: MongoDB install and validation notes

## Tech Stack

- Backend API: Node.js, Express, Socket.IO, Mongoose, JWT, bcryptjs
- AI Service: Python, FastAPI, Uvicorn
- Mobile: React Native, Expo SDK 54, React Navigation, AsyncStorage
- Database: MongoDB

## Ports

- API server: 5000
- AI service: 8000
- Expo dev server: 8081 (or next available port)

## Prerequisites

1. Node.js 20+
2. npm
3. Python 3.10+ (Conda environment recommended)
4. MongoDB Community Server

## 1) MongoDB Setup

If MongoDB is not already installed, use one of the methods in MONGODB_SETUP.md.

Quick checks:

1. Verify service status on Windows:
   - Open Services and confirm MongoDB is Running
2. Confirm connection via shell:
   - mongosh

Default local URI used by this project:

- mongodb://localhost:27017/zooglossia

## 2) API Server Setup

Directory:

- api-server

Install and run:

1. npm install
2. npm run dev

Expected startup logs:

- [api] Zooglossia API listening on port 5000
- [db] MongoDB connected

### API Environment Variables

Create api-server/.env with:

- MONGO_URI=mongodb://localhost:27017/zooglossia
- JWT_SECRET=replace_with_your_secret
- PORT=5000
- NODE_ENV=development
- AI_SERVICE_URL=http://localhost:8000

## 3) AI Service Setup

Directory:

- ai-service

Recommended with Conda:

1. conda activate zooglossia_clean
2. Install missing packages if needed:
   - pip install fastapi uvicorn python-multipart soundfile
3. Start service:
   - uvicorn main:app --reload --port 8000

Expected:

- FastAPI running at http://127.0.0.1:8000

## 4) Mobile App Setup

Directory:

- mobile-app

Install dependencies:

1. npm install

Start options:

1. Native dev server:
   - npx expo start --clear
2. Web mode:
   - npx expo start --web --clear

Current compatibility baseline in this repo:

- expo: ^54.0.33
- react-native: 0.81.5
- babel-preset-expo: ~54.0.10

### Mobile Environment Variables

Create mobile-app/.env:

- EXPO_PUBLIC_API_URL=http://localhost:5000

For physical device testing on same Wi-Fi, use your PC LAN IP:

- EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000

Example:

- EXPO_PUBLIC_API_URL=http://10.121.223.124:5000

## Authentication and Persistence Flow

1. User registers or logs in via API auth routes
2. API returns JWT token
3. Mobile app stores token in AsyncStorage key: auth_token
4. Protected endpoints use Authorization: Bearer <token>
5. Pets are persisted in MongoDB and scoped to authenticated user

## Main API Endpoints

Auth:

- POST /auth/register
- POST /auth/login

Pets (JWT required):

- GET /pets
- POST /pets
- GET /pets/:id
- DELETE /pets/:id

Analysis (JWT required):

- POST /analyze

## Full Local Run Order

1. Start MongoDB
2. Start API server (api-server)
3. Start AI service (ai-service)
4. Start mobile app (mobile-app)

## Common Issues and Fixes

### 1) Missing script dev in mobile-app

Cause:

- mobile-app uses Expo scripts, not dev

Fix:

- Use npx expo start --clear or npm start

### 2) Failed to fetch on login

Most common causes:

- API server not running on port 5000
- EXPO_PUBLIC_API_URL points to wrong host

Fix:

1. Ensure API is running and listening on 5000
2. Confirm mobile-app/.env value is correct
3. Restart Expo after env changes

### 3) Web support dependency error

Error asks for react-dom and react-native-web.

Fix:

- npx expo install react-dom react-native-web

### 4) Babel preset missing

Error:

- Cannot find module babel-preset-expo

Fix:

- npm install --save-dev babel-preset-expo@~54.0.10

### 5) Port already in use

Find process on a port:

- Get-NetTCPConnection -LocalPort 5000 -State Listen

Kill by PID:

- taskkill /PID <PID> /F

### 6) Started command from wrong folder

If Expo reports missing package.json at repo root, you ran from wrong directory.

Fix:

- cd mobile-app
- npx expo start --web --clear

## Quick Health Check

1. API:
   - Open http://localhost:5000 (or call auth endpoint)
2. AI service:
   - Open http://localhost:8000/docs
3. Mobile web:
   - Open the Expo localhost URL shown in terminal

## Notes

- Do not commit .env files or secrets
- Keep MongoDB running before API startup
- Restart Expo after changing .env values

## License

Private project. Add a license file if you plan to open source.
