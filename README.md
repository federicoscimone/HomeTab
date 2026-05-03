# 🏠 HomeTab — Family manager

**[Read in English](#english-version)**

---

## 📝 Descrizione

HomeTab è un'applicazione web fullstack per il tracciamento e l'analisi delle spese personali. Consente di registrare movimenti finanziari con qualsiasi metodo di pagamento (contanti, carte, bonifici, ticket pasto), importare automaticamente dati bancari da file Excel, categorizzare spese con un sistema gerarchico, e visualizzare report analitici mensili/annuali con confronti e proiezioni.

**Ideale per:** Famiglie e professionisti che desiderano tracciare le proprie finanze in modo granulare e scoprire pattern di spesa.

---

## ✨ Caratteristiche Principali

- **📊 Registrazione Spese Manuali** — Forma completa con importo, data, metodo pagamento, categoria gerarchica a 3 livelli, luogo, esercente, note
- **📁 Importazione Automatica** — Caricamento file Excel/CSV con mappatura colonne customizzabile per ogni banca
- **🤖 Auto-categorizzazione** — Assegnazione categoria automatica basata su keyword configurabili (es. "ESSELUNGA" → Spesa > Supermercato)
- **📈 Report e Analisi** — Dashboard mensile, pivot table categorie × mesi, grafici trend annuale, confronti anno su anno, proiezioni
- **🔐 Autenticazione Sicura** — JWT-based con Next-Auth, supporto multi-utente
- **☁️ Google Drive Integration** — Backup automatico dei dati su Google Drive con scheduling
- **📱 PWA (Offline-first)** — Funziona offline, sincronizzazione automatica quando torna online
- **🎨 Dark/Light Mode** — Tema dinamico con persistenza su cookie
- **🔍 Audit Trail** — Log completo di chi ha fatto cosa e quando

---

## 🛠️ Tech Stack

| Layer | Tecnologia |
|-------|-----------|
| **Frontend & Backend** | Next.js 16.2.4 (App Router, JavaScript puro) |
| **Database** | MongoDB 7.1.1 + Mongoose 9.5.0 ORM |
| **UI & Styling** | Tailwind CSS v4 + DaisyUI 5.5.19 |
| **Grafici** | Recharts 3.8.1 |
| **Parsing File** | SheetJS/xlsx 0.18.5 |
| **Autenticazione** | NextAuth.js 4.24.14 (JWT + Credentials) |
| **Form Management** | React Hook Form |
| **State & Fetching** | React Context + SWR |
| **Email** | Nodemailer 8.0.6 |
| **Logging** | Winston 3.19.0 + Daily Rotate |

---

## 🚀 Quick Start

### Prerequisiti
- **Node.js** ≥ 18.x
- **npm** o **yarn**
- **MongoDB** (locale o MongoDB Atlas cloud)

### Setup Locale

#### 1. Clona il repository
```bash
git clone https://github.com/federicoscimone/HomeTab.git
cd HomeTab
```

#### 2. Installa dipendenze
```bash
npm install
```

#### 3. Configura variabili d'ambiente
Crea `.env.local` nella root del progetto:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/hometab
# oppure per MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hometab

# Autenticazione
NEXTAUTH_SECRET=<genera con: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Google Drive Integration (opzionale)
GOOGLE_CLIENT_ID=<da Google Cloud Console>
GOOGLE_CLIENT_SECRET=<da Google Cloud Console>

# Email Notifications (opzionale)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<tuo-email@gmail.com>
SMTP_PASS=<app-password>
```

**Per Google Drive:** vedi [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)

#### 4. Avvia il server di sviluppo
```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

#### 5. Accedi
Al primo accesso, crea un account nuovo:
- Email: `test@example.com`
- Password: a tua scelta

---

## 📊 Setup Dati Demo

Per testare l'app con dati realistici, carica il dataset demo:

```bash
# Setup categorie e dati demo (12 mesi, famiglia di 4 persone)
bash seed-demo.sh 12
```

**Cosa ottieni:**
- ~500 movimenti realistici (gennaio-dicembre 2026)
- Famiglia di 4 persone (Marco, Lucia, Giulia 12, Lorenzo 15)
- Spese mensili ~€3,250 (totale anno ~€39,000)
- Stagionalità reale (vacanze estive, back-to-school, Natale)
- Entrate stipendi + bonus

**Accedi con:**
- Email: `demo@example.com`
- Password: `demo`

Per dettagli completi sui dati di demo, vedi [DEMO_DATA.md](./DEMO_DATA.md) e [SEED_DEMO_QUICK_START.md](./SEED_DEMO_QUICK_START.md).

---

## 📁 Struttura del Progetto

```
HomeTab/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Pagine autenticazione (login, setup, reset password)
│   ├── (dashboard)/              # Area protetta dashboard, report, impostazioni
│   ├── api/                      # API REST route handlers
│   │   ├── auth/                 # NextAuth.js handler + custom endpoints
│   │   ├── movimenti/            # CRUD movimenti + bulk-categorize, export
│   │   ├── categorie/            # CRUD categorie gerarchiche
│   │   ├── import/               # Parse, validazione, salvataggio import
│   │   ├── impostazioni/         # Template import, keyword mapping
│   │   ├── integrations/         # Google Drive integration
│   │   ├── report/               # Report analisi (pivot, categorie)
│   │   ├── dashboard/            # Dati dashboard
│   │   └── audit/                # Audit log
│   ├── offline/                  # Pagine PWA offline
│   ├── layout.js                 # Layout principale + autenticazione
│   └── globals.css               # Stili globali
│
├── components/                   # Componenti React riutilizzabili
│   ├── dashboard/                # Grafici dashboard
│   ├── import/                   # Form caricamento file, revisione
│   ├── movimenti/                # Form movimento, badge pagamento
│   ├── report/                   # Grafici report
│   ├── layout/                   # Sidebar, SessionProvider, ServiceWorker
│   └── shared/                   # Componenti condivisi
│
├── lib/                          # Business logic
│   ├── models/                   # Modelli Mongoose (8 schema)
│   ├── services/                 # Servizi (Google Drive, backup)
│   ├── utils/                    # Utility (importParser, autoCategorize, formattazione)
│   ├── mongodb.js                # Connessione MongoDB singleton
│   ├── logger.js                 # Logger Winston
│   ├── email.js                  # Nodemailer setup
│   └── seed-*.js                 # Script di seed (7 varianti)
│
├── public/                       # Asset statici
│   ├── manifest.json             # PWA manifest
│   ├── icons/                    # Icone app
│   └── sw.js                     # Service Worker
│
├── scripts/                      # Script utility
│   ├── migrate-*.js              # Migrazione dati
│   ├── backup-mongodb.js         # Backup database
│   └── reset-password.js         # Reset password CLI
│
├── package.json                  # Dependencies
├── next.config.mjs               # Configurazione Next.js
├── auth.js                       # NextAuth.js configuration
├── jsconfig.json                 # Import path alias
├── .env.local                    # Variabili d'ambiente (NON committare)
└── .env.production.example       # Template variabili produzione
```

---

## 🗂️ Modelli Dati (MongoDB)

- **User** — Autenticazione, email, password hash, ruolo
- **Movement** — Spesa/entrata con importo, data, categoria, metodo pagamento
- **Category** — Categoria gerarchica a 3 livelli (nome, colore, icona)
- **ImportTemplate** — Template mappatura colonne per import bancario
- **KeywordMapping** — Parola chiave → categoria per auto-categorizzazione
- **AuditLog** — Log di audit (chi, cosa, quando)
- **PasswordResetToken** — Token per reset password con TTL
- **GoogleDriveIntegration** — Credenziali Google Drive e configurazione backup

Per i dettagli completi dei schema, vedi [HOMETAB.md](./HOMETAB.md#modelli-dati-mongodb).

---

## 🚢 Deployment

### Option 1: Vercel (Consigliato per inizio)

**Vantaggi:** Setup zero, auto-scaling, gratuito per piccoli progetti

```bash
npm install -g vercel
vercel
```

Durante il deployment:
1. Collega repo GitHub
2. Imposta variabili d'ambiente (MONGODB_URI, NEXTAUTH_SECRET, ecc.)
3. Deploy automatico ad ogni push su `main`

**Requisiti:**
- MongoDB Atlas (free tier disponibile)
- Progetto Vercel (free)

### Option 2: Server Linux Privato (Raspberry Pi, VPS)

**Vantaggi:** Full control, privacy, costi fissi

#### Prerequisiti
- Server Linux (Ubuntu 20.04+, Raspberry Pi OS)
- Node.js 18+, npm
- MongoDB (locale o remoto)
- Docker (opzionale ma consigliato)
- Nginx (reverse proxy)
- SSL certificato (Let's Encrypt)

#### Setup Manuale

##### 1. SSH nel server
```bash
ssh user@your-server-ip
```

##### 2. Installa dipendenze
```bash
sudo apt update
sudo apt install -y nodejs npm mongodb-org nginx certbot python3-certbot-nginx
```

##### 3. Clona e setup repository
```bash
cd /opt
git clone https://github.com/federicoscimone/HomeTab.git
cd HomeTab
npm install
npm run build
```

##### 4. Crea `.env.production`
```bash
sudo nano .env.production
```

```
# Database
MONGODB_URI=mongodb://localhost:27017/hometab
NODE_ENV=production

# Autenticazione
NEXTAUTH_SECRET=<genera con: openssl rand -base64 32>
NEXTAUTH_URL=https://tuo-dominio.it

# Google Drive Integration (opzionale)
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
```

##### 5. Configura Nginx
```bash
sudo nano /etc/nginx/sites-available/hometab
```

```nginx
server {
    listen 80;
    server_name tuo-dominio.it www.tuo-dominio.it;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hometab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

##### 6. Setup SSL (Let's Encrypt)
```bash
sudo certbot --nginx -d tuo-dominio.it -d www.tuo-dominio.it
```

##### 7. Avvia l'applicazione
```bash
cd /opt/HomeTab
npm start
```

Per persistenza, usa **systemd** o **PM2**:

###### Con PM2
```bash
sudo npm install -g pm2
pm2 start "npm start" --name hometab
pm2 startup
pm2 save
```

#### Setup Docker (Alternativa)

```bash
# Dockerfile è fornito nel repo
docker build -t hometab:latest .
docker run -d \
  -e MONGODB_URI=mongodb://mongo:27017/hometab \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -p 3000:3000 \
  --link mongo:mongo \
  hometab:latest
```

Per docker-compose, vedi [DEPLOYMENT.md](./DEPLOYMENT.md) (se disponibile).

---

## 🔌 Integrazioni

### Google Drive Backup
L'app supporta backup automatico dei dati su Google Drive.

**Setup:** Vedi [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)

**Features:**
- Backup giornaliero automatico (opzionale)
- Backup manuale on-demand
- Restore da backup precedente
- Criptazione dei dati

---

## 📚 Documentazione Completa

- **[HOMETAB.md](./HOMETAB.md)** — Spec completa del progetto, roadmap, modelli dati dettagliati
- **[DEMO_DATA.md](./DEMO_DATA.md)** — Documentazione completa dati demo, categorie, keyword mapping
- **[SEED_DEMO_QUICK_START.md](./SEED_DEMO_QUICK_START.md)** — Guida rapida al caricamento dati demo
- **[GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)** — Setup integrazione Google Drive

---

## 🤝 Come Contribuire

Contributi sono benvenuti! Ecco come iniziare:

### 1. Fork il repository
```bash
# Clicca "Fork" su GitHub
git clone https://github.com/TUO_USERNAME/HomeTab.git
cd HomeTab
```

### 2. Crea un branch per la feature
```bash
git checkout -b feature/descrizione-breve
```

### 3. Fai i tuoi commit
```bash
git add .
git commit -m "feat: descrizione della feature"
```

**Stile commit:**
- `feat:` — Nuova feature
- `fix:` — Bug fix
- `refactor:` — Refactoring senza cambiamenti di behavior
- `docs:` — Aggiornamenti documentazione
- `chore:` — Aggiornamenti build, dipendenze

### 4. Apri una Pull Request
```bash
git push origin feature/descrizione-breve
# Poi apri PR su GitHub
```

**Nella PR includi:**
- Descrizione del cambiamento
- Motivazione e contesto
- Screenshots se UI changes
- Test effettuati

---

## 📝 Licenza

Questo progetto è licenziato sotto **MIT License**. Vedi [LICENSE](./LICENSE) per dettagli.

---

## 🆘 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Soluzione:** Assicurati che MongoDB sia in esecuzione:
```bash
# Mac/Linux
brew services start mongodb-community

# Windows (se installato come servizio)
net start MongoDB
```

### Port 3000 già in uso
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Soluzione:** Cambia porta o termina il processo:
```bash
# Cambia porta
PORT=3001 npm run dev

# Oppure termina il processo
lsof -ti :3000 | xargs kill -9
```

### NextAuth NEXTAUTH_URL mismatch
**Soluzione:** Assicurati che `.env.local` abbia `NEXTAUTH_URL=http://localhost:3000` (sviluppo)

### MongoDB URI non valida
**Soluzione:** Controlla il formato:
- Locale: `mongodb://localhost:27017/hometab`
- MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/hometab`

---

## 📊 Statistiche Progetto

- **Lines of Code:** ~5,000+
- **API Endpoints:** 20+
- **Database Models:** 8
- **React Components:** 30+
- **Supported Payment Methods:** 8+
- **Supported File Formats:** Excel, CSV, Tab-delimited

---

## 🐛 Segnalazione Bug

Hai trovato un bug? Apri un [issue su GitHub](https://github.com/federicoscimone/HomeTab/issues) con:
- Descrizione del problema
- Passi per riprodurlo
- Screenshot o error log
- Versione Node.js e browser

---

<br />

---

# English Version

---

# 🏠 HomeTab — Personal Finance Tracker

**[Leggi in Italiano](#-descrizione)**

---

## 📝 Description

HomeTab is a fullstack web application for tracking and analyzing personal expenses. It allows you to record financial movements with any payment method (cash, cards, bank transfers, meal tickets), automatically import bank data from Excel files, categorize expenses with a hierarchical system, and view analytical monthly/annual reports with comparisons and projections.

**Ideal for:** Families and professionals who want to track their finances in detail and discover spending patterns.

---

## ✨ Key Features

- **📊 Manual Expense Recording** — Complete form with amount, date, payment method, 3-level hierarchical category, place, payee, notes
- **📁 Automatic Import** — Excel/CSV file upload with customizable column mapping for each bank
- **🤖 Auto-categorization** — Automatic category assignment based on configurable keywords (e.g., "ESSELUNGA" → Groceries > Supermarket)
- **📈 Reports & Analytics** — Monthly dashboard, pivot table categories × months, annual trend graphs, year-over-year comparisons, projections
- **🔐 Secure Authentication** — JWT-based with Next-Auth, multi-user support
- **☁️ Google Drive Integration** — Automatic data backup to Google Drive with scheduling
- **📱 PWA (Offline-first)** — Works offline, automatic synchronization when back online
- **🎨 Dark/Light Mode** — Dynamic theme with cookie persistence
- **🔍 Audit Trail** — Complete log of who did what and when

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend & Backend** | Next.js 16.2.4 (App Router, Pure JavaScript) |
| **Database** | MongoDB 7.1.1 + Mongoose 9.5.0 ORM |
| **UI & Styling** | Tailwind CSS v4 + DaisyUI 5.5.19 |
| **Charts** | Recharts 3.8.1 |
| **File Parsing** | SheetJS/xlsx 0.18.5 |
| **Authentication** | NextAuth.js 4.24.14 (JWT + Credentials) |
| **Form Management** | React Hook Form |
| **State & Fetching** | React Context + SWR |
| **Email** | Nodemailer 8.0.6 |
| **Logging** | Winston 3.19.0 + Daily Rotate |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.x
- **npm** or **yarn**
- **MongoDB** (local or MongoDB Atlas cloud)

### Local Setup

#### 1. Clone the repository
```bash
git clone https://github.com/federicoscimone/HomeTab.git
cd HomeTab
```

#### 2. Install dependencies
```bash
npm install
```

#### 3. Configure environment variables
Create `.env.local` in the project root:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/hometab
# or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hometab

# Authentication
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Google Drive Integration (optional)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Email Notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email@gmail.com>
SMTP_PASS=<app-password>
```

**For Google Drive:** see [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)

#### 4. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### 5. Sign in
On first access, create a new account:
- Email: `test@example.com`
- Password: your choice

---

## 📊 Demo Data Setup

To test the app with realistic data, load the demo dataset:

```bash
# Setup categories and demo data (12 months, family of 4)
bash seed-demo.sh 12
```

**What you get:**
- ~500 realistic movements (January-December 2026)
- Family of 4 people (Marco, Lucia, Giulia 12, Lorenzo 15)
- Monthly expenses ~€3,250 (total year ~€39,000)
- Real seasonality (summer vacations, back-to-school, Christmas)
- Salary income + bonuses

**Login with:**
- Email: `demo@example.com`
- Password: `demo`

For complete details about demo data, see [DEMO_DATA.md](./DEMO_DATA.md) and [SEED_DEMO_QUICK_START.md](./SEED_DEMO_QUICK_START.md).

---

## 📁 Project Structure

```
HomeTab/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages (login, setup, reset password)
│   ├── (dashboard)/              # Protected area dashboard, reports, settings
│   ├── api/                      # REST API route handlers
│   │   ├── auth/                 # NextAuth.js handler + custom endpoints
│   │   ├── movimenti/            # CRUD movements + bulk-categorize, export
│   │   ├── categorie/            # CRUD hierarchical categories
│   │   ├── import/               # Parse, validation, import saving
│   │   ├── impostazioni/         # Import templates, keyword mapping
│   │   ├── integrations/         # Google Drive integration
│   │   ├── report/               # Report analytics (pivot, categories)
│   │   ├── dashboard/            # Dashboard data
│   │   └── audit/                # Audit log
│   ├── offline/                  # PWA offline pages
│   ├── layout.js                 # Main layout + authentication
│   └── globals.css               # Global styles
│
├── components/                   # Reusable React components
│   ├── dashboard/                # Dashboard charts
│   ├── import/                   # File upload form, review
│   ├── movimenti/                # Movement form, payment badge
│   ├── report/                   # Report charts
│   ├── layout/                   # Sidebar, SessionProvider, ServiceWorker
│   └── shared/                   # Shared components
│
├── lib/                          # Business logic
│   ├── models/                   # Mongoose models (8 schemas)
│   ├── services/                 # Services (Google Drive, backup)
│   ├── utils/                    # Utilities (importParser, autoCategorize, formatting)
│   ├── mongodb.js                # MongoDB singleton connection
│   ├── logger.js                 # Winston logger
│   ├── email.js                  # Nodemailer setup
│   └── seed-*.js                 # Seed scripts (7 variants)
│
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   ├── icons/                    # App icons
│   └── sw.js                     # Service Worker
│
├── scripts/                      # Utility scripts
│   ├── migrate-*.js              # Data migration
│   ├── backup-mongodb.js         # Database backup
│   └── reset-password.js         # CLI password reset
│
├── package.json                  # Dependencies
├── next.config.mjs               # Next.js configuration
├── auth.js                       # NextAuth.js configuration
├── jsconfig.json                 # Import path alias
├── .env.local                    # Environment variables (DO NOT commit)
└── .env.production.example       # Production variables template
```

---

## 🗂️ Data Models (MongoDB)

- **User** — Authentication, email, password hash, role
- **Movement** — Expense/income with amount, date, category, payment method
- **Category** — 3-level hierarchical category (name, color, icon)
- **ImportTemplate** — Column mapping template for bank imports
- **KeywordMapping** — Keyword → category for auto-categorization
- **AuditLog** — Audit log (who, what, when)
- **PasswordResetToken** — Password reset token with TTL
- **GoogleDriveIntegration** — Google Drive credentials and backup configuration

For detailed schema information, see [HOMETAB.md](./HOMETAB.md#modelli-dati-mongodb).

---

## 🚢 Deployment

### Option 1: Vercel (Recommended for getting started)

**Advantages:** Zero setup, auto-scaling, free for small projects

```bash
npm install -g vercel
vercel
```

During deployment:
1. Link GitHub repository
2. Set environment variables (MONGODB_URI, NEXTAUTH_SECRET, etc.)
3. Automatic deployment on every push to `main`

**Requirements:**
- MongoDB Atlas (free tier available)
- Vercel project (free)

### Option 2: Private Linux Server (Raspberry Pi, VPS)

**Advantages:** Full control, privacy, fixed costs

#### Prerequisites
- Linux server (Ubuntu 20.04+, Raspberry Pi OS)
- Node.js 18+, npm
- MongoDB (local or remote)
- Docker (optional but recommended)
- Nginx (reverse proxy)
- SSL certificate (Let's Encrypt)

#### Manual Setup

##### 1. SSH into server
```bash
ssh user@your-server-ip
```

##### 2. Install dependencies
```bash
sudo apt update
sudo apt install -y nodejs npm mongodb-org nginx certbot python3-certbot-nginx
```

##### 3. Clone and setup repository
```bash
cd /opt
git clone https://github.com/federicoscimone/HomeTab.git
cd HomeTab
npm install
npm run build
```

##### 4. Create `.env.production`
```bash
sudo nano .env.production
```

```
# Database
MONGODB_URI=mongodb://localhost:27017/hometab
NODE_ENV=production

# Authentication
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com

# Google Drive Integration (optional)
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
```

##### 5. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/hometab
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hometab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

##### 6. Setup SSL (Let's Encrypt)
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

##### 7. Start the application
```bash
cd /opt/HomeTab
npm start
```

For persistence, use **systemd** or **PM2**:

###### With PM2
```bash
sudo npm install -g pm2
pm2 start "npm start" --name hometab
pm2 startup
pm2 save
```

#### Docker Setup (Alternative)

```bash
# Dockerfile is provided in the repo
docker build -t hometab:latest .
docker run -d \
  -e MONGODB_URI=mongodb://mongo:27017/hometab \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -p 3000:3000 \
  --link mongo:mongo \
  hometab:latest
```

For docker-compose, see [DEPLOYMENT.md](./DEPLOYMENT.md) (if available).

---

## 🔌 Integrations

### Google Drive Backup
The app supports automatic data backup to Google Drive.

**Setup:** See [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)

**Features:**
- Automatic daily backup (optional)
- On-demand manual backup
- Restore from previous backup
- Data encryption

---

## 📚 Complete Documentation

- **[HOMETAB.md](./HOMETAB.md)** — Complete project spec, roadmap, detailed data models
- **[DEMO_DATA.md](./DEMO_DATA.md)** — Complete demo data documentation, categories, keyword mapping
- **[SEED_DEMO_QUICK_START.md](./SEED_DEMO_QUICK_START.md)** — Quick guide to loading demo data
- **[GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)** — Google Drive integration setup

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

### 1. Fork the repository
```bash
# Click "Fork" on GitHub
git clone https://github.com/YOUR_USERNAME/HomeTab.git
cd HomeTab
```

### 2. Create a branch for your feature
```bash
git checkout -b feature/short-description
```

### 3. Make your commits
```bash
git add .
git commit -m "feat: description of the feature"
```

**Commit style:**
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Refactoring without behavior changes
- `docs:` — Documentation updates
- `chore:` — Build, dependencies updates

### 4. Open a Pull Request
```bash
git push origin feature/short-description
# Then open PR on GitHub
```

**In the PR include:**
- Description of the change
- Motivation and context
- Screenshots if UI changes
- Tests performed

---

## 📝 License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## 🆘 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Make sure MongoDB is running:
```bash
# Mac/Linux
brew services start mongodb-community

# Windows (if installed as service)
net start MongoDB
```

### Port 3000 already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change port or kill the process:
```bash
# Change port
PORT=3001 npm run dev

# Or kill the process
lsof -ti :3000 | xargs kill -9
```

### NextAuth NEXTAUTH_URL mismatch
**Solution:** Make sure `.env.local` has `NEXTAUTH_URL=http://localhost:3000` (development)

### MongoDB URI invalid
**Solution:** Check the format:
- Local: `mongodb://localhost:27017/hometab`
- MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/hometab`

---

## 📊 Project Statistics

- **Lines of Code:** ~5,000+
- **API Endpoints:** 20+
- **Database Models:** 8
- **React Components:** 30+
- **Supported Payment Methods:** 8+
- **Supported File Formats:** Excel, CSV, Tab-delimited

---

## 🐛 Bug Report

Found a bug? Open an [issue on GitHub](https://github.com/federicoscimone/HomeTab/issues) with:
- Description of the problem
- Steps to reproduce
- Screenshot or error log
- Node.js and browser version

---

## 📧 Contact

For questions or suggestions, feel free to open an issue or contact through GitHub.

**Happy tracking! 🎉**
