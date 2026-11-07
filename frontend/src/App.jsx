import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, adminHeaders } from "./api";
import "./styles.css";

const categories = [
  "All",
  "Bridal",
  "Wedding",
  "Party Wear",
  "Embroidery",
  "Designer",
  "Simple"
];

function Layout({ children }) {
  return (
    <>
      <header className="navbar">
        <Link to="/" className="brand">🌸 Blouse Studio</Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>

      {children}

      <footer>
        © {new Date().getFullYear()} Blouse Studio · Beautiful designs for every occasion
      </footer>
    </>
  );
}

function Home() {
  const [designs, setDesigns] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get("/designs", {
        params: { search, category }
      });
      setDesigns(data);
    } catch (error) {
      console.error("Unable to load designs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [category]);

  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">BOUTIQUE COLLECTION</span>
          <h1>Beautiful Blouse Designs for Every Occasion</h1>
          <p>
            Explore designer, bridal, embroidery and wedding blouse
            inspirations with current prices.
          </p>
          <a href="#designs" className="primary-btn">Explore Designs</a>
        </div>
        <div className="hero-art">✿</div>
      </section>

      <section className="toolbar" id="designs">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          placeholder="Search blouse designs..."
        />
        <button className="primary-btn" onClick={load}>Search</button>
      </section>

      <div className="categories">
        {categories.map(c => (
          <button
            className={category === c ? "chip active" : "chip"}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="center">Loading designs...</p>
      ) : designs.length === 0 ? (
        <div className="empty">
          No designs found. Admin can add the first design.
        </div>
      ) : (
        <section className="grid">
          {designs.map(d => (
            <DesignCard key={d.id} design={d} />
          ))}
        </section>
      )}
    </main>
  );
}

function DesignCard({ design }) {
  const [likes, setLikes] = useState(design.likes ?? 0);
  const [downloads, setDownloads] = useState(design.downloads ?? 0);
  const navigate = useNavigate();

  async function like(e) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const { data } = await api.post(`/designs/${design.id}/like`);
      setLikes(data.likes);
    } catch (error) {
      console.error("Like failed:", error);
      alert("Unable to like this design.");
    }
  }

  async function download(e) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await api.post(`/designs/${design.id}/download`);
      const imageUrl = response.data.image_url;

      if (!imageUrl) {
        throw new Error("Image URL was not returned by the server.");
      }

      if (window.AndroidShare?.downloadImage) {
        window.AndroidShare.downloadImage(imageUrl, design.title);
      } else {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = `${design.title || "blouse-design"}.jpg`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setDownloads(response.data.downloads ?? downloads + 1);
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    }
  }

  async function share(e) {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (window.AndroidShare?.shareImage) {
        window.AndroidShare.shareImage(design.image_url, design.title);
      } else if (navigator.share && navigator.canShare) {
        const response = await fetch(design.image_url);
        const blob = await response.blob();
        const file = new File(
          [blob],
          `${design.title || "blouse-design"}.jpg`,
          { type: blob.type || "image/jpeg" }
        );

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: design.title
          });
        } else {
          alert("Photo sharing is not supported.");
        }
      } else {
        alert("Photo sharing is not supported on this device.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Photo sharing failed:", error);
        alert("Unable to share photo. Please try again.");
      }
    }
  }

  return (
    <article
      className="card"
      onClick={() => navigate(`/design/${design.slug}`)}
    >
      <img src={design.image_url} alt={design.title} loading="lazy" />

      <div className="card-body">
        <span className="tag">{design.category}</span>
        <h3>{design.title}</h3>

        <p className="price">
          ₹{Number(design.price).toLocaleString("en-IN")}
        </p>

        <div className="actions">
          <button onClick={like} aria-label="Like design">♥ {likes}</button>
          <button onClick={download}>↓ Download {downloads}</button>
          <button onClick={share}>↗ Share</button>
        </div>
      </div>
    </article>
  );
}

function DesignDetails() {
  const { slug } = useParams();
  const [design, setDesign] = useState(null);

  useEffect(() => {
    api.get(`/designs/${slug}`)
      .then(r => setDesign(r.data))
      .catch(() => setDesign(false));
  }, [slug]);

  async function shareDesign() {
    if (!design) return;

    try {
      if (window.AndroidShare?.shareImage) {
        window.AndroidShare.shareImage(design.image_url, design.title);
      } else if (navigator.share && navigator.canShare) {
        const response = await fetch(design.image_url);
        const blob = await response.blob();
        const file = new File(
          [blob],
          `${design.title || "blouse-design"}.jpg`,
          { type: blob.type || "image/jpeg" }
        );

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: design.title
          });
        } else {
          alert("Photo sharing is not supported.");
        }
      } else {
        alert("Photo sharing is not supported on this device.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Photo sharing failed:", error);
        alert("Unable to share photo. Please try again.");
      }
    }
  }

  if (design === null) {
    return <p className="center">Loading...</p>;
  }

  if (!design) {
    return <p className="center">Design not found.</p>;
  }

  return (
    <main className="details">
      <img src={design.image_url} alt={design.title} />

      <div className="details-info">
        <span className="tag">{design.category}</span>
        <h1>{design.title}</h1>

        <div className="big-price">
          ₹{Number(design.price).toLocaleString("en-IN")}
        </div>

        {design.description && <p>{design.description}</p>}
        <p className="detail-stats">
          ♥ {design.likes ?? 0} likes · ↓ {design.downloads ?? 0} downloads
        </p>

        <div className="detail-actions">
          <button type="button" onClick={shareDesign}>
            ↗ Share Design
          </button>

          <Link to="/" className="secondary-btn">
            ← Back to designs
          </Link>
        </div>
      </div>
    </main>
  );
}

function Admin() {
  const [logged, setLogged] = useState(
    !!localStorage.getItem("adminToken")
  );

  const [designs, setDesigns] = useState([]);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Bridal",
    price: "",
    image: null
  });

  useEffect(() => {
    if (logged) load();
  }, [logged]);

  async function load() {
    try {
      const { data } = await api.get("/designs");
      setDesigns(data);
    } catch (error) {
      console.error("Unable to load admin designs:", error);
    }
  }

  function reset() {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      category: "Bridal",
      price: "",
      image: null
    });
  }

  function edit(d) {
    setEditing(d);
    setForm({
      title: d.title,
      description: d.description,
      category: d.category,
      price: d.price,
      image: null
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e) {
    e.preventDefault();

    try {
      const fd = new FormData();

      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== "") {
          fd.append(k, v);
        }
      });

      if (editing) {
        await api.put(
          `/admin/designs/${editing.id}`,
          fd,
          { headers: adminHeaders() }
        );
      } else {
        await api.post(
          "/admin/designs",
          fd,
          { headers: adminHeaders() }
        );
      }

      reset();
      await load();
      alert("Design saved successfully.");
    } catch (error) {
      console.error("Save failed:", error);
      alert("Unable to save design. Please try again.");
    }
  }

  async function remove(id) {
    if (!confirm("Delete this design?")) return;

    try {
      await api.delete(`/admin/designs/${id}`, {
        headers: adminHeaders()
      });
      await load();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Unable to delete design.");
    }
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setLogged(false);
  }

  if (!logged) {
    return <AdminLogin onLogin={() => setLogged(true)} />;
  }

  return (
    <main className="admin-page">
      <div className="admin-head">
        <div>
          <span className="eyebrow">ADMIN PANEL</span>
          <h1>{editing ? "Edit Design" : "Add New Design"}</h1>
        </div>
        <button onClick={logout}>Logout</button>
      </div>

      <form className="admin-form" onSubmit={save}>
        <input
          required
          placeholder="Design title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />

        <select
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
        >
          {categories.slice(1).map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="Price ₹"
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
        />

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={e =>
            setForm({ ...form, image: e.target.files[0] || null })
          }
        />

        <div>
          <button className="primary-btn">
            {editing ? "Update Design" : "Add Design"}
          </button>

          {editing && (
            <button
              type="button"
              className="secondary-btn"
              onClick={reset}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2>Manage Designs</h2>

      <div className="admin-list">
        {designs.map(d => (
          <div className="admin-row" key={d.id}>
            <img src={d.image_url} alt={d.title} />

            <div>
              <strong>{d.title}</strong>
              <p>
                {d.category} · ₹{Number(d.price).toLocaleString("en-IN")}
              </p>
            </div>

            <button onClick={() => edit(d)}>
              Edit / Change Price
            </button>

            <button className="danger" onClick={() => remove(d.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login(e) {
    e.preventDefault();

    try {
      const { data } = await api.post("/admin/login", {
        email,
        password
      });

      localStorage.setItem("adminToken", data.token);
      onLogin();
    } catch (error) {
      console.error("Admin login failed:", error);
      alert("Invalid admin email or password.");
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={login}>
        <span className="eyebrow">ADMIN ONLY</span>
        <h1>Admin Login</h1>

        <input
          required
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button className="primary-btn">Login</button>
      </form>
    </main>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/design/:slug" element={<DesignDetails />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  );
}
