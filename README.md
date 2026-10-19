# AI-Based Placement Management and Career Guidance System

A full-stack placement platform built with Flask and React, covering student registration, profile management, resume parsing, eligibility, recommendations, applications, notifications, and dashboard views.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Flask + SQLAlchemy + JWT
- Database: SQLite for local development and MySQL-compatible ORM models for production
- AI: rule-based resume parsing and skill extraction using PyMuPDF and text matching

## Local setup

### Python backend
```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
set FLASK_APP=backend.app
flask --app backend.app run --debug
```

### Frontend
```bash
npm install
npm run dev
```

### Environment
Copy `.env.example` to `.env` and update values before production use.

## Demo credentials
- Student: student@demo.com / Student@123
- Recruiter: recruiter@demo.com / Recruiter@123
- Placement Officer: officer@demo.com / Officer@123

## Testing
```bash
pytest
npm test
```
