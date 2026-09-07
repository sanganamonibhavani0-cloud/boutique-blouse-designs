from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from pathlib import Path
from functools import wraps
import os
import uuid

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{BASE_DIR / 'boutique.db'}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

CORS(app, resources={r"/api/*": {"origins": "*"}})
db = SQLAlchemy(app)

ADMIN_EMAIL = "bhavani@example.com"
ADMIN_PASSWORD = "navya123"

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

class Design(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(220), unique=True, nullable=False)
    description = db.Column(db.Text, default="")
    category = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False, default=0)
    image_filename = db.Column(db.String(300), nullable=False)
    likes = db.Column(db.Integer, default=0)
    downloads = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "category": self.category,
            "price": self.price,
            "image_url": f"/uploads/{self.image_filename}",
            "likes": self.likes,
            "downloads": self.downloads,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = request.headers.get("X-Admin-Token")
        if token != "admin-demo-token":
            return jsonify({"error": "Admin authentication required"}), 401
        return fn(*args, **kwargs)
    return wrapper

def make_slug(title):
    base = "".join(c.lower() if c.isalnum() else "-" for c in title).strip("-")
    base = "-".join(filter(None, base.split("-"))) or "design"
    slug = base
    counter = 2
    while Design.query.filter_by(slug=slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    if data.get("email") == ADMIN_EMAIL and data.get("password") == ADMIN_PASSWORD:
        return jsonify({"token": "admin-demo-token", "message": "Login successful"})
    return jsonify({"error": "Invalid email or password"}), 401

@app.get("/api/designs")
def get_designs():
    category = request.args.get("category")
    search = request.args.get("search", "").strip()

    query = Design.query
    if category and category != "All":
        query = query.filter_by(category=category)
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(Design.title.ilike(like), Design.description.ilike(like))
        )

    designs = query.order_by(Design.created_at.desc()).all()
    return jsonify([d.to_dict() for d in designs])

@app.get("/api/designs/<slug>")
def get_design(slug):
    design = Design.query.filter_by(slug=slug).first()
    if not design:
        return jsonify({"error": "Design not found"}), 404
    return jsonify(design.to_dict())

@app.post("/api/designs/<int:design_id>/like")
def like_design(design_id):
    design = db.session.get(Design, design_id)
    if not design:
        return jsonify({"error": "Design not found"}), 404
    design.likes += 1
    db.session.commit()
    return jsonify({"likes": design.likes})

@app.post("/api/designs/<int:design_id>/download")
def download_design(design_id):
    design = db.session.get(Design, design_id)
    if not design:
        return jsonify({"error": "Design not found"}), 404
    design.downloads += 1
    db.session.commit()
    return send_from_directory(
        UPLOAD_DIR,
        design.image_filename,
        as_attachment=True,
        download_name=design.image_filename
    )

@app.post("/api/admin/designs")
@admin_required
def create_design():
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    category = request.form.get("category", "").strip()
    price_raw = request.form.get("price", "").strip()
    image = request.files.get("image")

    if not title or not category or not price_raw or not image:
        return jsonify({"error": "Title, category, price and image are required"}), 400

    if not allowed_file(image.filename):
        return jsonify({"error": "Allowed images: png, jpg, jpeg, webp"}), 400

    try:
        price = float(price_raw)
    except ValueError:
        return jsonify({"error": "Invalid price"}), 400

    ext = image.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    image.save(UPLOAD_DIR / filename)

    design = Design(
        title=title,
        slug=make_slug(title),
        description=description,
        category=category,
        price=price,
        image_filename=filename,
    )
    db.session.add(design)
    db.session.commit()
    return jsonify(design.to_dict()), 201

@app.put("/api/admin/designs/<int:design_id>")
@admin_required
def update_design(design_id):
    design = db.session.get(Design, design_id)
    if not design:
        return jsonify({"error": "Design not found"}), 404

    data = request.form
    if data.get("title"):
        design.title = data.get("title").strip()
    if data.get("description") is not None:
        design.description = data.get("description").strip()
    if data.get("category"):
        design.category = data.get("category").strip()
    if data.get("price"):
        try:
            design.price = float(data.get("price"))
        except ValueError:
            return jsonify({"error": "Invalid price"}), 400

    image = request.files.get("image")
    if image and image.filename:
        if not allowed_file(image.filename):
            return jsonify({"error": "Invalid image type"}), 400
        old_path = UPLOAD_DIR / design.image_filename
        if old_path.exists():
            old_path.unlink()
        ext = image.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        image.save(UPLOAD_DIR / filename)
        design.image_filename = filename

    db.session.commit()
    return jsonify(design.to_dict())

@app.delete("/api/admin/designs/<int:design_id>")
@admin_required
def delete_design(design_id):
    design = db.session.get(Design, design_id)
    if not design:
        return jsonify({"error": "Design not found"}), 404

    image_path = UPLOAD_DIR / design.image_filename
    if image_path.exists():
        image_path.unlink()

    db.session.delete(design)
    db.session.commit()
    return jsonify({"message": "Design deleted"})

@app.get("/uploads/<path:filename>")
def uploads(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.cli.command("seed")
def seed():
    if Design.query.count() == 0:
        print("No sample designs are created automatically because images are required.")
    else:
        print("Database already contains designs.")

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
