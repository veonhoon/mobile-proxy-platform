# Mobile Proxy Platform

A complete mobile proxy platform where Android phones act as proxy servers, managed through a web dashboard.

## Architecture

```
[External Client] → VPS:PORT (TCP) → [Node.js Proxy Server] → WebSocket → [Phone APK] → Internet
                                              ↕
                                     [Next.js Dashboard]
                                              ↕
                                       [PostgreSQL DB]
```

## Server Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

```bash
cd server
npm install
```

### Configuration

Edit `server/.env`:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/mobile_proxy"
JWT_SECRET="your-secret-here"
```

### Database Setup

```bash
npx prisma db push
npm run seed
```

Default admin: `admin@mobileproxy.io` / `admin123`

### Run

```bash
npm run dev
```

Dashboard: http://localhost:3000
WebSocket: ws://localhost:3000/ws

## Usage

1. Login to dashboard at `http://SERVER_IP:3000`
2. Go to **Devices** → **Add Device** → copy the device key
3. Install APK on phone, enter server URL (`ws://SERVER_IP:3000/ws`) and device key
4. Phone shows as **Online** in dashboard
5. Go to **Proxies** → **Create Proxy** → select device, set port/credentials
6. Test: `curl -x http://user:pass@SERVER_IP:PORT http://httpbin.org/ip`

## Android APK

Open `android/` folder in Android Studio and build the APK.

The app connects to the server via WebSocket and executes proxy requests using the phone's mobile data connection.
