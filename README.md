# WPS Backend

Backend API untuk sistem WPS (Wood Processing System) berbasis Node.js + Express dengan database Microsoft SQL Server.

## Teknologi

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: Microsoft SQL Server (mssql)
- **Auth**: JWT (jsonwebtoken)
- **Realtime**: WebSocket (ws)
- **File Processing**: Multer, Sharp, FFmpeg

## Modul

| Modul         | Endpoint             |
| ------------- | -------------------- |
| Auth          | `/api/auth`          |
| Stock Opname  | `/api`               |
| Label Data    | `/api`               |
| Profile       | `/api`               |
| Mapping       | `/api`               |
| Nyangkut      | `/api`               |
| Locations     | `/api`               |
| Bongkar KD    | `/api`               |
| QC Sawmill    | `/api/qc-sawmill`    |
| Jenis Kayu    | `/api/jenis-kayu`    |
| Mesin Sawmill | `/api/mesin-sawmill` |
| ST Sawmill    | `/api/sawmill`       |

## Setup Lokal

### 1. Install dependencies

```bash
npm install
```

### 2. Buat file `.env`

```env
PORT=5002

DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_PORT=1433
DB_DATABASE=your_db_name

JWT_SECRET=your_jwt_secret
```

### 3. Jalankan development server

```bash
npm run dev
```

Server berjalan di `http://localhost:5002`

## Health Check

```
GET /health
```

Response:

```json
{ "status": "ok" }
```

## Deploy ke Server (Docker)

### Prasyarat

- Docker & Docker Compose terinstall di server
- File `.env` sudah ada di server

### Manual deploy

```bash
./deploy.sh
```

### Auto deploy via GitHub Actions

Push atau merge ke branch `production` akan otomatis trigger deploy:

```bash
git checkout production
git merge master
git push origin production
git checkout master
```

GitHub Actions akan menjalankan `git pull` dan `docker compose up -d --build` secara otomatis di server.

## Struktur Folder

```
wps_backend/
├── src/
│   ├── app.js
│   ├── core/
│   │   ├── config/       # Konfigurasi DB
│   │   ├── middleware/   # Auth middleware
│   │   ├── socket/       # WebSocket
│   │   └── utils/
│   └── modules/          # Modul-modul API
├── storage/              # File upload
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
└── server.js
```

CD TEST - 2026-05-17
