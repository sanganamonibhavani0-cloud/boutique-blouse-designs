# Boutique Blouse Designs Website

A full-stack blouse-design gallery with:
- Public design gallery
- Search and category filters
- Design details
- Like, download and share
- Admin login
- Admin add/edit/delete designs
- Admin can change prices anytime
- Image upload
- SQLite database
- React frontend + Flask backend

## 1. Backend setup

Open a terminal:

```bash
cd backend
python -m venv venv
```

Windows:
```bash
venv\Scripts\activate
```

Install:
```bash
pip install -r requirements.txt
```

Start:
```bash
python app.py
```

Backend:
http://127.0.0.1:5000

Default admin:
- Email: admin@example.com
- Password: admin123

Change these credentials before deploying.

## 2. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:
http://localhost:5173

## 3. Important

This starter uses SQLite and stores uploaded images in `backend/uploads`.

For production, use:
- PostgreSQL/MySQL
- Cloud image storage such as Cloudinary/S3
- Strong admin password
- HTTPS
- Proper JWT/session management
- Rate limiting and CSRF protection
- A production frontend deployment

## Google visibility / SEO

The app includes clean design URLs and page titles. For stronger Google indexing in production, migrating the public frontend to Next.js/SSR and adding a sitemap, robots.txt, canonical URLs and structured data is recommended.
