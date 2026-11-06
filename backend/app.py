
from flask import Flask, request, jsonify
import cloudinary
import cloudinary.uploader
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
from functools import wraps
from sqlalchemy import or_
import os

# -----------------------------------
# APPLICATION SETUP
# -----------------------------------

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# -----------------------------------
# DATABASE CONNECTION
# PostgreSQL on Render
# SQLite on local computer
# -----------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace(
            "postgres://",
            "postgresql+psycopg://",
            1
        )

    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1
        )

    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300
    }

else:
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"sqlite:///{BASE_DIR / 'boutique.db'}"
    )

db = SQLAlchemy(app)

# -----------------------------------
# CLOUDINARY SETUP
# -----------------------------------

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# -----------------------------------
# CORS
# -----------------------------------

CORS(
    app,
    resources={r"/api/*": {"origins": "*"}}
)

# -----------------------------------
# ADMIN DETAILS
# Keep existing values for compatibility.
# Move these to environment variables later.
# -----------------------------------
# -----------------------------------
# ADMIN DETAILS
# Read credentials securely from environment variables
# -----------------------------------

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "webp"
}

# -----------------------------------
# DATABASE MODEL
# -----------------------------------

class Design(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    title = db.Column(
        db.String(200),
        nullable=False
    )

    slug = db.Column(
        db.String(220),
        unique=True,
        nullable=False
    )

    description = db.Column(
        db.Text,
        default=""
    )

    category = db.Column(
        db.String(100),
        nullable=False
    )

    price = db.Column(
        db.Float,
        nullable=False,
        default=0
    )

    image_filename = db.Column(
        db.String(300),
        nullable=False
    )

    likes = db.Column(
        db.Integer,
        default=0
    )

    downloads = db.Column(
        db.Integer,
        default=0
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )

    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now()
    )

    def to_dict(self):

        image_url = self.image_filename

        if not image_url.startswith("http"):
            image_url = f"/uploads/{self.image_filename}"

        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "category": self.category,
            "price": self.price,
            "image_url": image_url,
            "likes": self.likes or 0,
            "downloads": self.downloads or 0,
            "created_at": (
                self.created_at.isoformat()
                if self.created_at else None
            )
        }

# -----------------------------------
# ADMIN AUTHENTICATION
# -----------------------------------

def admin_required(fn):

    @wraps(fn)
    def wrapper(*args, **kwargs):

        token = request.headers.get(
            "X-Admin-Token"
        )

        if token != ADMIN_TOKEN:
            return jsonify({
                "error": "Admin authentication required"
            }), 401

        return fn(*args, **kwargs)

    return wrapper

# -----------------------------------
# HELPER FUNCTIONS
# -----------------------------------

def make_slug(title):

    base = "".join(
        c.lower() if c.isalnum() else "-"
        for c in title
    ).strip("-")

    base = "-".join(
        filter(None, base.split("-"))
    ) or "design"

    slug = base
    counter = 2

    while Design.query.filter_by(
        slug=slug
    ).first():

        slug = f"{base}-{counter}"
        counter += 1

    return slug


def allowed_file(filename):

    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )

# -----------------------------------
# HEALTH CHECK
# -----------------------------------

@app.get("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "database": (
            "PostgreSQL"
            if os.getenv("DATABASE_URL")
            else "SQLite"
        )
    })

# -----------------------------------
# ADMIN LOGIN
# -----------------------------------

@app.post("/api/admin/login")
def admin_login():

    data = request.get_json(silent=True) or {}

    if (
        data.get("email") == ADMIN_EMAIL
        and data.get("password") == ADMIN_PASSWORD
    ):

        return jsonify({
            "token": ADMIN_TOKEN,
            "message": "Login successful"
        })

    return jsonify({
        "error": "Invalid email or password"
    }), 401

# -----------------------------------
# GET ALL DESIGNS
# -----------------------------------

@app.get("/api/designs")
def get_designs():

    category = request.args.get("category")

    search = request.args.get(
        "search", ""
    ).strip()

    query = Design.query

    if category and category != "All":

        query = query.filter_by(
            category=category
        )

    if search:

        like = f"%{search}%"

        query = query.filter(
            or_(
                Design.title.ilike(like),
                Design.description.ilike(like)
            )
        )

    designs = query.order_by(
        Design.created_at.desc()
    ).all()

    return jsonify([
        design.to_dict()
        for design in designs
    ])

# -----------------------------------
# GET SINGLE DESIGN
# -----------------------------------

@app.get("/api/designs/<slug>")
def get_design(slug):

    design = Design.query.filter_by(
        slug=slug
    ).first()

    if not design:

        return jsonify({
            "error": "Design not found"
        }), 404

    return jsonify(design.to_dict())

# -----------------------------------
# LIKE DESIGN
# -----------------------------------

@app.post("/api/designs/<int:design_id>/like")
def like_design(design_id):

    design = db.session.get(
        Design, design_id
    )

    if not design:

        return jsonify({
            "error": "Design not found"
        }), 404

    design.likes = (design.likes or 0) + 1

    db.session.commit()

    return jsonify({
        "likes": design.likes
    })

# -----------------------------------
# DOWNLOAD DESIGN
# -----------------------------------

@app.post("/api/designs/<int:design_id>/download")
def download_design(design_id):
    design = db.session.get(Design, design_id)

    if not design:
        return jsonify({"error": "Design not found"}), 404

    if not design.image_filename:
        return jsonify({"error": "Image not found"}), 404

    design.downloads = (design.downloads or 0) + 1
    db.session.commit()

    return jsonify({
        "image_url": design.image_filename,
        "downloads": design.downloads
    }), 200


# -----------------------------------
# CREATE DESIGN
# ADMIN ONLY
# -----------------------------------

@app.post("/api/admin/designs")
@admin_required
def create_design():

    title = request.form.get(
        "title", ""
    ).strip()

    description = request.form.get(
        "description", ""
    ).strip()

    category = request.form.get(
        "category", ""
    ).strip()

    price_raw = request.form.get(
        "price", ""
    ).strip()

    image = request.files.get("image")

    if not title or not category or not price_raw or not image:

        return jsonify({
            "error": "Title, category, price and image are required"
        }), 400

    if not allowed_file(image.filename):

        return jsonify({
            "error": "Allowed images: png, jpg, jpeg, webp"
        }), 400

    try:

        price = float(price_raw)

        if price < 0:
            raise ValueError()

    except ValueError:

        return jsonify({
            "error": "Invalid price"
        }), 400

    try:

        upload_result = cloudinary.uploader.upload(
            image,
            folder="boutique_blouse_designs"
        )

        filename = upload_result["secure_url"]

        design = Design(
            title=title,
            slug=make_slug(title),
            description=description,
            category=category,
            price=price,
            image_filename=filename
        )

        db.session.add(design)
        db.session.commit()

        return jsonify(
            design.to_dict()
        ), 201

    except Exception:

        db.session.rollback()

        app.logger.exception(
            "Design upload failed"
        )

        return jsonify({
            "error": "Unable to upload design. Please try again."
        }), 500

# -----------------------------------
# UPDATE DESIGN
# ADMIN ONLY
# -----------------------------------

@app.put("/api/admin/designs/<int:design_id>")
@admin_required
def update_design(design_id):

    design = db.session.get(
        Design, design_id
    )

    if not design:

        return jsonify({
            "error": "Design not found"
        }), 404

    data = request.form

    if data.get("title"):

        design.title = data.get(
            "title"
        ).strip()

        design.slug = make_slug(
            design.title
        )

    if data.get("description") is not None:

        design.description = data.get(
            "description"
        ).strip()

    if data.get("category"):

        design.category = data.get(
            "category"
        ).strip()

    if data.get("price"):

        try:

            price = float(
                data.get("price")
            )

            if price < 0:
                raise ValueError()

            design.price = price

        except ValueError:

            return jsonify({
                "error": "Invalid price"
            }), 400

    image = request.files.get("image")

    try:

        if image and image.filename:

            if not allowed_file(image.filename):

                return jsonify({
                    "error": "Invalid image type"
                }), 400

            upload_result = cloudinary.uploader.upload(
                image,
                folder="boutique_blouse_designs"
            )

            design.image_filename = (
                upload_result["secure_url"]
            )

        db.session.commit()

        return jsonify(
            design.to_dict()
        )

    except Exception:

        db.session.rollback()

        app.logger.exception(
            "Design update failed"
        )

        return jsonify({
            "error": "Unable to update design"
        }), 500

# -----------------------------------
# DELETE DESIGN
# ADMIN ONLY
# -----------------------------------

@app.delete("/api/admin/designs/<int:design_id>")
@admin_required
def delete_design(design_id):

    design = db.session.get(
        Design, design_id
    )

    if not design:

        return jsonify({
            "error": "Design not found"
        }), 404

    try:

        db.session.delete(design)
        db.session.commit()

        return jsonify({
            "message": "Design deleted"
        })

    except Exception:

        db.session.rollback()

        app.logger.exception(
            "Design deletion failed"
        )

        return jsonify({
            "error": "Unable to delete design"
        }), 500

# -----------------------------------
# INITIALIZE DATABASE TABLES
# -----------------------------------

with app.app_context():

    db.create_all()

    app.logger.info(
        "Database tables checked successfully"
    )

# -----------------------------------
# RUN APPLICATION
# -----------------------------------

if __name__ == "__main__":

    app.run(
        debug=False,
        port=int(os.environ.get("PORT", 5000))
    )
