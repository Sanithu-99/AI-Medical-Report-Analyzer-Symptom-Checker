# AI Medical Report Analyzer and Symptom Checker

An end-to-end medical insights platform that lets patients and clinicians upload clinical documents, extract the key text with OCR, interpret findings with NLP, predict potential health risks, and run symptom checks through a clean Apple-inspired interface.

## Features
- Secure authentication with JWT-based login and registration.
- Upload PDFs or images; EasyOCR converts imagery into text and stores results in MongoDB.
- spaCy/OpenAI-powered summarisation with optional GPT-4o support.
- Lightweight Random Forest model for health insight predictions with fallback heuristics.
- Symptom checker that maps free-text complaints to likely conditions.
- Responsive Next.js 14 dashboard with TailwindCSS and Chart.js visualisations.

## Project Structure
```
root/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── settings.py
│   ├── requirements.txt
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
│   ├── ocr/
│   │   └── extract_text.py
│   └── nlp/
│       └── interpret_text.py
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── jsconfig.json
│   ├── pages/
│   │   ├── _app.js
│   │   ├── _document.js
│   │   ├── index.js
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   └── report.js
│   ├── components/
│   │   ├── Navbar.js
│   │   ├── UploadBox.js
│   │   ├── ResultCard.js
│   │   └── ChartSection.js
│   ├── lib/api.js
│   ├── styles/globals.css
│   └── public/
└── README.md
```

## Backend Setup
1. **Prerequisites**
   - Python 3.10+
   - MongoDB Atlas connection string
   - Optional: OpenAI API key for enhanced summaries

2. **Environment**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configuration**
   Copy `backend/.env` and update:
   ```ini
   MONGO_URI="your-mongodb-atlas-uri"
   MONGO_DB_NAME="medical_analyzer"
   OPENAI_API_KEY="your-openai-api-key"  # optional
   SECRET_KEY="your-jwt-secret-key"
   CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
    DEFAULT_USER_EMAIL="sanithu.hulathduwage@gmail.com"  # optional auto-seeded account
    DEFAULT_USER_PASSWORD="AiApp@1243"                    # optional auto-seeded account
   ```
   When `DEFAULT_USER_EMAIL` and `DEFAULT_USER_PASSWORD` are present, the API seeds that user on startup so you can log in immediately.

4. **Database & Models**
   - `Auth` endpoints store users in the `users` collection (passwords hashed with bcrypt).
   - Reports live in the `reports` collection, referencing the owning user.

5. **Run the API**
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   The API exposes:
   - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
   - `POST /api/reports/upload` for OCR + NLP + prediction
   - `GET /api/reports` for the user history
   - `POST /api/symptoms` for the symptom checker

6. **Training the ML Model (optional)**
   Provide CSV data containing `text` and `label` columns:
   ```bash
   python backend/ml/train_model.py
   ```
   The script saves `model.joblib` and `vectorizer.joblib` for use by the predictor. Fallback heuristics are used when the model is absent.

7. **OCR & NLP Notes**
   - EasyOCR lazily initialises and supports PDF/image ingestion through PyMuPDF and Pillow conversions.
   - spaCy is the default summariser. If `OPENAI_API_KEY` is present, the app attempts a GPT-4o-mini summary and falls back to spaCy when unavailable.
   - Install the English core model when using spaCy:
     ```bash
     python -m spacy download en_core_web_sm
     ```

## Frontend Setup
1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```
2. **Environment**
   Update `frontend/.env.local` if needed:
   ```bash
   NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
   ```
3. **Development server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` for the Apple-inspired dashboard featuring uploads, summaries, charts, and a symptom checker.

## Deployment Notes
- **Frontend**: Deploy to Vercel. Ensure `NEXT_PUBLIC_API_URL` points to your Render backend URL.
- **Backend**: Deploy to Render (or similar) with environment variables set from `.env`.
- **Database**: Use MongoDB Atlas, whitelisting Render+Vercel IPs or enabling VPC peering.

## Security & Future Enhancements
- Add rate limiting and audit logging for uploads.
- Extend the ML model with additional lab results and integrate more robust clinical ontologies.
- Attach signed URLs for report storage in S3 or similar.
- Expand symptom checker with knowledge graph support and triage pathways.

## Testing Checklist
- [ ] Register and login using `/login`
- [ ] Upload sample PDF/image and verify insights appear in dashboard cards and charts
- [ ] Enter symptoms to confirm predictions render
- [ ] Refresh dashboard to ensure stored reports load from MongoDB
- [ ] Run FastAPI health check at `/health`

Enjoy building with the AI Medical Report Analyzer and Symptom Checker!
