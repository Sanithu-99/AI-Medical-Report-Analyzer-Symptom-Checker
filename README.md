# Med Analyzr AI · HIPAA Edition

Med Analyzr AI is now an enterprise-grade, HIPAA-aligned workspace that ingests medical reports, anonymises PHI with salted HMAC tokens, and serves de-identified insights to clinicians, patients, and institutions. OCR → NLP → ML pipelines remain, but every layer now enforces TLS, audit logging, VPN/proxy denial, and tiered plan controls.

```
┌──────── Frontend (Next.js/Vercel) ────────┐
│ Auth + plan-aware UI + secure exports     │
└──────────────┬────────────────────────────┘
               │ HTTPS (HSTS + JWT)
┌──────────────▼────────────────────────────┐
│  FastAPI (Render)                         │
│  • Security headers, rate limiting        │
│  • Anonymisation + audit middleware       │
│  • HealthScore AI orchestrator            │
└───────┬───────────────┬───────────────────┘
        │               │
  TLS   │               │ TLS
┌───────▼───────┐  ┌────▼──────────────────┐
│ MongoDB Atlas │  │ AI stack (OCR/NLP/ML) │
│ FLE-ready +   │  │ EasyOCR · spaCy · RF  │
│ field-level   │  │ + optional LLM (Ollama│
│ encryption    │  │ Granite)              │
└───────────────┘  └───────────────────────┘
```

---

## Feature Highlights
- **HIPAA + SOC2 guardrails**: TLS 1.2+, HSTS, strict security headers, audit logging to Mongo plus Cloud logging hooks, VPN/proxy denial, and geolocation-aware session validation.
- **Automatic anonymisation**: Regex + spaCy NER strip PHI, salted HMAC tokens reference encrypted `phi_mapping`, quasi-identifiers get bucketed before any persistence.
- **Subscription intelligence**: Individual, Clinician, and Institution plans enforce quotas, analytics access, secure exports, and API unlocks via `plan_usage`.
- **Smarter HealthScore AI**: TF-IDF + RandomForest blended with optional Ollama Granite reasoning to deliver risk factors, confidence, and recommendations.
- **Secure exports & sharing**: Signed download URLs, anonymised CSV exports, and MFA-protected account settings with device/IP fingerprinting.

---

## Tech Stack
| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 14, React 18, TailwindCSS, Axios, Chart.js |
| Backend | FastAPI, Motor, scikit-learn, pandas, numpy (`<2`), spaCy, EasyOCR, PyMuPDF |
| Database | MongoDB Atlas |
| Deployment targets | Vercel (frontend), Render (backend), MongoDB Atlas |

## Compliance & Security Overview
- **Transport & perimeter**: HTTPS enforced end-to-end with HSTS, TLS 1.2+, Trusted Host middleware, rate limiting (SlowAPI), Content-Security-Policy, and Referrer/Permissions guards.
- **Authentication & sessions**: 15-minute JWTs, rotating refresh tokens stored as double-hashed entries in `session_log`, device fingerprint + IP drift enforcement, VPN/proxy denial (IPinfo), and optional TOTP MFA.
- **Auditability**: Every PHI-touching request logs a redacted trail to `audit_logs` plus stdout, ready for CloudWatch/GCP Logging shipping.
- **Data lifecycle**: Reports are soft-deleted (`storage_state=pending_purge`) and the `backend/scripts/data_retention.py` job purges after configurable grace periods. PHI mappings live in a separate encrypted collection.
- **Storage**: MongoDB Atlas with TLS plus AES-GCM enveloping via `EncryptionManager`, signed download URLs, and strict file MIME validation.

## Anonymisation Pipeline
```
Upload (PDF/JPG) ──▶ EasyOCR/PyMuPDF ──▶ spaCy NER + regex detectors
      │                                      │
      │                           Salted HMAC tokens + AES-GCM payload
      ▼                                      │
De-identified text ──▶ Reports collection ◀──┘
                    ▲
                    └── phi_mapping (encrypted) + quasi-ID buckets (ZIP➜region, DOB➜age-band)
```

## Plan Matrix

| Plan | Monthly Reports | Symptom Checks | Advanced Analytics | Secure Exports | API / Teams |
| --- | --- | --- | --- | --- | --- |
| Individual | 10 | 20 | ✖ | ✖ | ✖ |
| Clinician | 100 | 250 | ✔ | ✔ | ✖ |
| Institution | Unlimited | Unlimited | ✔ | ✔ | ✔ |

- Plans are enforced server-side via `plan_usage` and the `/api/auth/plan/select` endpoint. Exceeding quotas returns `402 Payment Required` so the UI can redirect to `/pricing`.

---

## Repository Layout
```
.
├── backend/
│   ├── main.py                  # FastAPI application
│   ├── database.py              # MongoDB connection helpers
│   ├── settings.py              # Pydantic Settings v2 configuration
│   ├── routers/
│   │   ├── auth.py
│   │   ├── report_analyzer.py
│   │   └── symptom_checker.py
│   ├── models/
│   │   ├── user_model.py
│   │   └── report_model.py
│   ├── ml/
│   │   ├── predictor.py
│   │   ├── train_model.py
│   │   └── sample_training_data.csv
│   ├── ocr/extract_text.py
│   ├── nlp/interpret_text.py
│   └── requirements.txt
├── frontend/
│   ├── pages/                   # Next.js routes
│   ├── components/
│   ├── styles/globals.css
│   ├── lib/api.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Backend Setup

### 1. Prerequisites
- Python 3.10+
- MongoDB Atlas connection string
- Optional: OpenAI API key (for GPT-enabled summaries)

### 2. Virtualenv & Dependencies
```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt      # includes numpy<2 for SciPy/sklearn binary compatibility
```

### 3. Environment Variables
Update `backend/.env` with real values:
```ini
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/medical_analyzer?retryWrites=true&w=majority"
MONGO_DB_NAME="medical_analyzer"
OPENAI_API_KEY="your-openai-api-key"      # optional
SECRET_KEY="your-jwt-secret-key"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
DEFAULT_USER_EMAIL="sanithu.hulathduwage@gmail.com"   # optional auto-seed
DEFAULT_USER_PASSWORD="AiApp@1243"
```
Notes:
- `CORS_ORIGINS` can be a simple comma-separated string (no JSON).
- If `DEFAULT_USER_*` values are present, the account is created or updated on startup.

### 4. Run the API
Always launch from the project root so relative imports resolve:
```bash
cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Keep this process running. In another terminal you can verify:
```bash
curl http://127.0.0.1:8000/health
```

### 5. ML Model (Optional)
The app ships with heuristics and a sample CSV. Train a real model by providing your own dataset:
```bash
python backend/ml/train_model.py
```
This generates `ml/model.joblib` and `ml/vectorizer.joblib`, which are auto-loaded by `predictor.py`.

### 6. NLP/OCR Extras
```bash
python -m spacy download en_core_web_sm
```
EasyOCR and PyMuPDF install automatically; GPU acceleration is disabled by default for portability.

### Sample anonymised dataset
`data/anonymized_samples.json` ships with two fully de-identified reports that you can import for smoke testing the dashboard and HealthScore AI without touching PHI.

## Docker Deployment
Build a full local stack (MongoDB, FastAPI, Next.js) with isolated bridges for the database and app tiers:

```bash
docker compose up --build
```

- `backend/.env.example` documents the required secrets; copy it to `backend/.env` before composing.
- MongoDB runs on `db_net`, while the backend straddles `db_net` + `app_net` to keep the database isolated from the public frontend container.
- Frontend is exposed on [http://localhost:3000](http://localhost:3000) and proxies API calls to `http://backend:8000`.

---

## Frontend Setup
```bash
cd frontend
npm install
```
Environment (`frontend/.env.local`):
```ini
NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
```
Start the dev server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to access the login page, dashboards, uploads, charts, and the symptom checker.

---

## Deployment Checklist
- **MongoDB Atlas**: create a database user, set network access rules (IP allow-list or VPC peering).
- **Backend (Render/other PaaS)**  
  - Build: `pip install -r backend/requirements.txt && python -m spacy download en_core_web_sm`  
  - Start: `uvicorn backend.main:app --host 0.0.0.0 --port 10000`  
  - Environment: replicate `.env` values, update `CORS_ORIGINS` with your production frontend URL.
- **Frontend (Vercel)**: set `NEXT_PUBLIC_API_URL` to the deployed backend endpoint.

---

## Troubleshooting Guide
| Symptom | Likely Cause | Resolution |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'backend'` | Uvicorn started inside `backend/` | Run Uvicorn from repo root (`uvicorn backend.main:app …`). |
| `SettingsError` for `cors_origins` | Env string parsed as JSON | Leave it as a comma-separated string (`http://a.com,http://b.com`). |
| NumPy ABI error (`compiled using NumPy 1.x`) | New numpy 2.x with old SciPy wheel | Use the supplied requirements (installs `numpy<2`). |
| Login inputs not focusable | Hot reload cached old CSS | Restart `npm run dev`, hard refresh the browser (⌘⇧R). |

---

## CI & Security Scans
- `.github/workflows/ci.yml` builds the backend, runs Bandit across the FastAPI app, and lints the Next.js frontend on every push/PR.
- Dependabot monitors `backend/requirements.txt` and `frontend/package.json` weekly.

## Suggested Smoke Test
- [ ] `curl http://127.0.0.1:8000/health`
- [ ] Log in with the seeded credentials on `/login`
- [ ] Upload a sample report; confirm summary, insights, chart, and MongoDB entry
- [ ] Submit symptoms; check prediction response
- [ ] Refresh dashboard to ensure historic reports load correctly

---

## Roadmap Ideas
- Rate limiting and audit logs for uploads/downloads.
- External object storage with signed URLs for original reports.
- Expand the symptom checker with structured clinical ontologies.
- Add automated tests (PyTest for backend, Playwright/Cypress for frontend).

---

### Contributing
Issues and PRs are welcome. Please describe the problem clearly and include reproduction steps. For major changes, open an issue to discuss the approach first.

Enjoy building with the AI Medical Report Analyzer! If you run into snags, feel free to reach out or file an issue. 😊
