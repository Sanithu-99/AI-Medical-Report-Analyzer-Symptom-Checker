# AI Medical Report Analyzer and Symptom Checker

An end-to-end clinical insights platform that transforms uploaded medical reports into clear summaries, predictive health insights, and interactive visualisations. OCR extracts the data, NLP interprets it, an ML layer flags potential risks, and a sleek Apple-inspired UI keeps everything approachable.

---

## Feature Highlights
- **Secure authentication** with JWT, bcrypt hashing, and auto-seeded default accounts for quick demos.
- **Medical report workflow**: PDF/image OCR → NLP summarisation (spaCy with optional GPT-4o-mini) → Random Forest predictions with keyword-based fallback heuristics.
- **Symptom checker** that maps free-text complaints to possible conditions.
- **Persistent insights** stored in MongoDB Atlas and surfaced in a responsive Next.js dashboard.
- **Visualisations** powered by Chart.js with Tailwind-styled cards and glassmorphism UI.

---

## Tech Stack
| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 14, React 18, TailwindCSS, Axios, Chart.js |
| Backend | FastAPI, Motor, scikit-learn, pandas, numpy (`<2`), spaCy, EasyOCR, PyMuPDF |
| Database | MongoDB Atlas |
| Deployment targets | Vercel (frontend), Render (backend), MongoDB Atlas |

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
