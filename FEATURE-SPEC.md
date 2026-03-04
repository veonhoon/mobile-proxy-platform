# Mobile Proxy Platform — Feature Spec (v1)

Based on deep dive of: **Proxidize**, **IPRoyal**, **Proxy-Seller**, **SOAX**, **Smartproxy**

---

## 🏢 Competitive Landscape Summary

| Company | Model | Key Differentiator |
|---------|-------|--------------------|
| **Proxidize** | Self-hosted proxy builder (Android/Linux) | Most similar to us — they sell software to build your own proxy farm |
| **IPRoyal** | Proxy-as-a-service | Unlimited bandwidth, 4.5M+ mobile IPs |
| **Proxy-Seller** | Proxy-as-a-service | 220+ countries, rotation by time/request/sticky |
| **SOAX** | Proxy-as-a-service | Geo-targeting, real-time dashboard |

**Our model**: We're closest to Proxidize (we own the phones) but selling access like IPRoyal/Proxy-Seller (proxy-as-a-service to end users).

---

## 📋 Feature Matrix — What We Need

### Tier 1: MVP (Launch Features) ⭐
These are **must-haves** before selling to anyone.

#### Proxy Core
- [x] HTTP(S) proxy per device
- [x] SOCKS5 proxy per device
- [ ] **Rotation URL** — unique URL per proxy that rotates the IP when hit (GET request triggers airplane mode toggle)
- [ ] **Manual IP rotation** — button in dashboard
- [ ] **Auto rotation** — user-configurable timer (every X minutes)
- [ ] **Randomized rotation** — add ±random offset to timer so not all phones rotate at the same time
- [x] Username/password authentication
- [ ] **IP whitelist authentication** — allow by source IP instead of user/pass

#### User Management
- [x] Admin login
- [x] User registration
- [x] User roles (ADMIN / USER)
- [ ] **Proxy assignment to users** — admin assigns specific proxy ports to users
- [ ] **User dashboard** — users see ONLY their assigned proxies (my-proxies page exists but needs work)
- [ ] **User can rotate IP** from their dashboard
- [ ] **User can set auto-rotation interval** for their proxies
- [ ] **Usage/bandwidth tracking per user**
- [ ] **Proxy credentials per user** — each user gets unique credentials

#### Dashboard UI
- [ ] **Device status cards** — show: online/offline, carrier, current IP, uptime, last rotation
- [ ] **Rotate IP button** on each device/proxy card
- [ ] **Auto-rotation toggle + interval picker** (dropdown: 5min, 10min, 15min, 30min, 1hr, custom)
- [ ] **Rotation URL display** — copy-to-clipboard for each proxy
- [ ] **Connection info card** — show HTTP port, SOCKS5 port, credentials, rotation URL all in one copyable block
- [ ] **Proxy format export** — copy as `host:port:user:pass` or `user:pass@host:port` etc.

### Tier 2: Post-Launch (Week 2-3)

#### Analytics & Monitoring
- [ ] **Bandwidth tracking** — per device, per user, over time
- [ ] **Speed test** — test proxy speed from dashboard
- [ ] **IP history** — log of all IPs a device has had
- [ ] **Uptime tracking** — device uptime percentage
- [ ] **Connection logs** — requests passing through each proxy
- [ ] **Activity logs** — who did what, when

#### Advanced Proxy Features
- [ ] **Proxy pooling / Round Robin** — single endpoint that cycles through multiple phones
- [ ] **Load balancing** — route to least-loaded phone
- [ ] **Sticky sessions** — keep same IP for X minutes per client
- [ ] **Custom DNS** — per-proxy DNS configuration
- [ ] **Bulk actions** — rotate all, reboot all, etc.

#### Device Management
- [ ] **Reboot device** from dashboard
- [ ] **Device nickname** — custom names
- [ ] **Carrier info** — show carrier, signal strength, network type (4G/5G/LTE)
- [ ] **Battery status** — show battery level
- [ ] **SIM info** — ICCID, IMSI display

### Tier 3: Future (Month 2+)

#### Business Features
- [ ] **Subscription/billing system** — Stripe integration
- [ ] **Plans** — dedicated vs shared, bandwidth limits
- [ ] **API access** — full REST API for proxy management
- [ ] **Reseller panel** — let resellers manage their own users
- [ ] **Referral program**
- [ ] **Auto-renewal**

#### Advanced
- [ ] **SMS reading/forwarding** — from dashboard
- [ ] **USSD commands** — from dashboard
- [ ] **Alerts** — Discord/Telegram notifications for device down, rotation failed, etc.
- [ ] **Chrome/Firefox proxy extension** — one-click proxy switch
- [ ] **Multiple auth methods** — user/pass + IP whitelist + token
- [ ] **TTL/MTU customization**
- [ ] **IPv6 support**

---

## 🎨 Dashboard UI Design Notes

### What good proxy dashboards look like (from research):

**Main Dashboard:**
- Grid of proxy cards (not a table) — each card shows:
  - Device name + status dot (green/red)
  - Current IP address
  - Carrier + network type (T-Mobile 5G)
  - Uptime timer
  - HTTP port | SOCKS5 port
  - Rotation URL (copy button)
  - [Rotate IP] button
  - Auto-rotation toggle + interval
  - Assigned user

**User's View (simplified):**
- Only sees their proxies
- Connection details prominently displayed:
  ```
  HTTP:   proxy.yourdomain.com:9001
  SOCKS5: proxy.yourdomain.com:9002
  User:   john_proxy1
  Pass:   xxxxxxxx
  Rotate: https://proxy.yourdomain.com/api/rotate/abc123
  ```
- [Copy All] button
- Format selector (host:port:user:pass, etc.)
- Rotate IP button
- Auto-rotation interval picker
- Bandwidth used this period

**Admin View (full):**
- Everything user sees PLUS:
- All devices, all users
- Assign proxies to users
- Create/delete proxy ports
- View all bandwidth/usage
- System health overview

---

## 🔄 IP Rotation — How It Works

### Rotation URL (Key Feature)
Each proxy gets a unique rotation URL like:
```
https://your-server.com/api/rotate/{proxy-id}?key={rotation-key}
```

When this URL is hit (GET request):
1. Server sends `change_ip` command to phone via WebSocket
2. Phone toggles airplane mode (3s on → 2s off)
3. Phone reconnects with new mobile IP
4. Server responds with `{ "success": true, "newIp": "x.x.x.x" }` (after waiting for reconnection)

### Auto-Rotation
- User sets interval (5min to 24hr)
- Server runs a timer per proxy
- Optional randomization: ±20% offset to prevent synchronized rotations
- Stored in database per proxy/user

### Manual Rotation
- Button in dashboard
- Calls same API endpoint
- Shows spinner while rotating, then new IP

---

## 🔗 Integration with Mobility (Lulu Server)

The proxy service should be a standalone module that can be embedded into the Mobility platform:
- Shared auth system (users log into Mobility, get access to proxies)
- Proxy management as a "service" within Mobility
- Billing integration through Mobility's payment system
- API-first design so Mobility frontend can call proxy APIs

---

## Priority Build Order

1. **Rotation URL endpoint** — `/api/devices/{id}/change-ip` exists, need to add rotation key auth + response with new IP
2. **Dashboard Rotate button** — wire up the existing API to a UI button
3. **Auto-rotation** — timer system in proxy-manager
4. **User proxy view** — my-proxies page with connection details + rotation
5. **Proxy format export** — copy connection strings
6. **Bandwidth tracking** — basic byte counting through the proxy tunnel
7. **IP history logging** — store each IP change with timestamp
