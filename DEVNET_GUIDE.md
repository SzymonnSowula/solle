# 🚀 Volle — Devnet Deployment & Testing Guide

## Spis treści

1. [Wymagania](#1-wymagania)
2. [Konfiguracja portfela Solana](#2-konfiguracja-portfela-solana)
3. [Build i Deploy programu Anchor](#3-build-i-deploy-programu-anchor)
4. [Konfiguracja środowiska Web App](#4-konfiguracja-środowiska-web-app)
5. [Uruchomienie projektu](#5-uruchomienie-projektu)
6. [Testowanie na Devnet](#6-testowanie-na-devnet)
7. [Weryfikacja on-chain](#7-weryfikacja-on-chain)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Wymagania

### Narzędzia systemowe

```bash
# Rust (wymagany >= 1.89.0)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default 1.89.0

# Solana CLI (wymagany >= 1.18)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor CLI (wymagany >= 0.32)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli

# Node.js (>= 18) i pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Docker (dla Postgres + Redis)
# Zainstaluj Docker Desktop lub Docker Engine
```

### Weryfikacja instalacji

```bash
rustc --version       # >= 1.89.0
solana --version      # >= 1.18.x
anchor --version      # >= 0.32.1
node --version        # >= 18.x
pnpm --version        # >= 8.x
docker --version      # >= 20.x
```

---

## 2. Konfiguracja portfela Solana

### Generowanie keypair (jeśli nie istnieje)

```bash
# Generuj nowy keypair (zapisz seed phrase!)
solana-keygen new --outfile ~/.config/solana/id.json

# Lub jeśli masz już keypair, sprawdź adres:
solana address
```

### Przełączenie na Devnet

```bash
# Ustaw devnet jako domyślny cluster
solana config set --url https://api.devnet.solana.com

# Sprawdź konfigurację
solana config get
# Powinno pokazać: RPC URL: https://api.devnet.solana.com
```

### Airdrop SOL na Devnet

```bash
# Poproś o 2 SOL (max per request)
solana airdrop 2

# Sprawdź saldo
solana balance
# Powinno pokazać: >= 2 SOL

# Jeśli potrzebujesz więcej, powtórz:
solana airdrop 2
```

> **Uwaga:** Devnet airdrop ma limit rate. Jeśli dostaniesz 429 Too Many Requests,
> poczekaj kilka minut lub użyj [Solana Faucet](https://faucet.solana.com/).

---

## 3. Build i Deploy programu Anchor

### 3.1 Build

```bash
# Z katalogu głównego repozytorium
cd programs/solli

# Build programu (generuje .so + IDL + typy TypeScript)
anchor build
```

Build generuje:
- `target/deploy/programs_solli.so` — zkompilowany program BPF
- `target/idl/programs_solli.json` — IDL (Interface Definition Language)
- `target/types/programs_solli.ts` — TypeScript typy

### 3.2 Pobranie Program ID

```bash
# Wyświetl Program ID z klucza deploymentu
solana-keygen pubkey target/deploy/programs_solli-keypair.json
```

### 3.3 Synchronizacja Program ID

Jeśli Program ID jest inny niż w kodzie, zaktualizuj:

```bash
# 1. Anchor.toml — sekcja [programs.devnet]
#    programs_solli = "<NOWY_PROGRAM_ID>"

# 2. programs/solli/programs/solli/src/lib.rs — declare_id!
#    declare_id!("<NOWY_PROGRAM_ID>");

# 3. apps/web/src/lib/solana/anchor-client.ts — PROGRAM_ID
#    const PROGRAM_ID = new PublicKey('<NOWY_PROGRAM_ID>');

# 4. apps/web/src/lib/solana/server-client.ts — PROGRAM_ID
#    const PROGRAM_ID = new PublicKey('<NOWY_PROGRAM_ID>');

# 5. apps/web/src/lib/solana/idl.json — skopiuj nowy IDL
#    cp target/idl/programs_solli.json ../../apps/web/src/lib/solana/idl.json

# Po aktualizacji ID, przebuduj:
anchor build
```

### 3.4 Deploy na Devnet

```bash
# Deploy (wymaga ~3 SOL na rent-exempt)
anchor deploy --provider.cluster devnet

# Lub za pomocą skryptu:
chmod +x scripts/deploy-devnet.sh
./scripts/deploy-devnet.sh
```

Zapisz output — pokaże deployment signature i Program ID.

### 3.5 Weryfikacja deploymentu

```bash
# Sprawdź czy program istnieje on-chain
solana program show <PROGRAM_ID> --url devnet

# Lub za pomocą skryptu:
chmod +x scripts/verify-devnet.sh
./scripts/verify-devnet.sh
```

---

## 4. Konfiguracja środowiska Web App

### 4.1 Kopiowanie i edycja .env.local

```bash
# Z katalogu głównego repozytorium
cd /path/to/solli  # wróć do root repo
cp .env.example .env.local
```

Edytuj `.env.local`:

```env
# === WYMAGANE ===

# OpenAI (wymagany do działania agentów)
OPENAI_API_KEY=sk-...twój-klucz...

# Solana — WAŻNE: musi wskazywać na devnet!
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
ANCHOR_PROGRAM_ID=<PROGRAM_ID_Z_KROKU_3>

# Database + Redis (domyślne wartości z docker-compose)
DATABASE_URL=postgresql://solli:solli_dev_password@localhost:5432/solli
REDIS_URL=redis://default:solli_dev_password@localhost:6379

# Worker Auth (wygeneruj losowy secret)
WORKER_AUTH_SECRET=$(openssl rand -hex 32)

# === OPCJONALNE ===

# ElevenLabs (wymagany tylko dla voice)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_WEBHOOK_SECRET=...

# Google OAuth (wymagany tylko dla Gmail/Calendar)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 4.2 Instalacja zależności

```bash
pnpm install
```

### 4.3 Uruchomienie infrastruktury (Docker)

```bash
# Uruchom Postgres + Redis
docker-compose up -d

# Sprawdź status
docker-compose ps
# Oba kontenery powinny być "healthy"
```

> **Uwaga:** Jeśli schemat bazy danych się zmienił, przebuduj:
> ```bash
> docker-compose down -v && docker-compose up -d
> ```

---

## 5. Uruchomienie projektu

### Opcja A: Wszystko naraz (Turborepo)

```bash
pnpm dev
```

To uruchamia:
- Web app → http://localhost:3000
- Worker Browser → http://localhost:3002
- Worker Google → http://localhost:3003

### Opcja B: Oddzielne terminale (lepsze do debugowania)

```bash
# Terminal 1: Infrastruktura
docker-compose up -d

# Terminal 2: Web app
pnpm --filter @solli/web dev

# Terminal 3: Browser worker
pnpm --filter @solli/worker-browser dev

# Terminal 4: Google worker (opcjonalny)
pnpm --filter @solli/worker-google dev
```

---

## 6. Testowanie na Devnet

### 6.1 Testy Anchor (localnet)

```bash
cd programs/solli

# Uruchom pełen zestaw testów (wymaga uruchomionego localnet validator)
anchor test

# Lub z istniejącym validatorem:
anchor test --skip-local-validator
```

Testy pokrywają:
- ✅ `initialize_treasury` — tworzenie i podwójna inicjalizacja
- ✅ `fund_agent` — deponowanie SOL
- ✅ `record_session_cost` — odejmowanie kosztów
- ✅ `withdraw` — wypłata SOL
- ✅ `create_session` — tworzenie sesji + walidacja długości query
- ✅ `update_session_status` — aktualizacja statusu + walidacja
- ✅ `create_receipt` — tworzenie paragonów + walidacja

### 6.2 Test z frontendu

1. Otwórz http://localhost:3000
2. Podłącz portfel Solana (Phantom/Backpack w trybie devnet)
3. W dashboardzie:
   - **Initialize Treasury** — tworzy PDA treasury
   - **Fund Agent** — deponuje devnet SOL
   - Rozpocznij sesję przez voice lub text
   - Sprawdź settlement po zakończeniu sesji
4. Sprawdź transakcje na https://explorer.solana.com/?cluster=devnet

### 6.3 Test API endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Utwórz sesję
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"input": "Find AI internships in Poland", "userId": "test-wallet"}'

# Sprawdź sesje
curl http://localhost:3000/api/sessions

# Uruchom sesję (zastąp SESSION_ID)
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/run

# Sprawdź events (SSE)
curl -N http://localhost:3000/api/sessions/SESSION_ID/stream
```

### 6.4 Test Anchor CLI bezpośrednio

```bash
# Initialize treasury z CLI
solana program invoke <PROGRAM_ID> \
  --url devnet \
  -- initialize_treasury

# Lub użyj skryptu Node.js z anchor-client.ts
```

---

## 7. Weryfikacja on-chain

### Solana Explorer

```
https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet
```

### Sprawdzenie stanu konta Treasury

```bash
# Pobierz dane konta PDA
solana account <TREASURY_PDA_ADDRESS> --url devnet --output json
```

### Sprawdzenie transakcji

```bash
# Lista ostatnich transakcji programu
solana transaction-history <PROGRAM_ID> --url devnet --limit 10
```

---

## 8. Troubleshooting

### Program deploy fails — "insufficient funds"

```bash
# Sprawdź saldo i poproś o airdrop
solana balance
solana airdrop 2
```

### "Account already in use" during deploy

Program jest już wdrożony. Użyj `anchor upgrade`:
```bash
anchor upgrade target/deploy/programs_solli.so \
  --program-id <PROGRAM_ID> \
  --provider.cluster devnet
```

### Docker containers not starting

```bash
# Sprawdź logi
docker-compose logs postgres
docker-compose logs redis

# Przebuduj od zera
docker-compose down -v
docker-compose up -d
```

### "Missing required environment variable"

Upewnij się, że `.env.local` zawiera wszystkie wymagane zmienne:
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`

### Treasury PDA not found

Treasury musi być zainicjalizowany przed użyciem. W dashboardzie kliknij "Initialize Treasury" lub:

```typescript
import { initializeTreasury, getVolleProgram } from '@/lib/solana/anchor-client';

const program = getVolleProgram(connection, wallet);
await initializeTreasury(program, wallet.publicKey);
```

### IDL mismatch after program update

```bash
cd programs/solli
anchor build
cp target/idl/programs_solli.json ../../apps/web/src/lib/solana/idl.json
```

### Anchor test failures

```bash
# Wyczyść i przebuduj
anchor clean
anchor build
anchor test
```

---

## Przydatne linki

- [Solana Devnet Faucet](https://faucet.solana.com/)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana CLI Reference](https://docs.solanalabs.com/cli)
