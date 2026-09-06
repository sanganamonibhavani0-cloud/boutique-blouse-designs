import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, adminHeaders } from "./api";

const categories = ["All", "Bridal", "Wedding", "Party Wear", "Embroidery", "Designer", "Simple"];

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
      <footer>© {new Date().getFullYear()} Blouse Studio · Beautiful designs for every occasion</footer>
    </>
  );
}

function Home() {
  const [designs, setDesigns] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await api.get("/designs", { params: { search, category } });
    setDesigns(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [category]);

  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">BOUTIQUE COLLECTION</span>
          <h1>Beautiful Blouse Designs for Every Occasion</h1>
          <p>Explore designer, bridal, embroidery and wedding blouse inspirations with current prices.</p>
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
          <button className={category === c ? "chip active" : "chip"} key={c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading ? <p className="center">Loading designs...</p> :
       designs.length === 0 ? <div className="empty">No designs found. Admin can add the first design.</div> :
       <section className="grid">
        {designs.map(d => <DesignCard key={d.id} design={d} />)}
       </section>}
    </main>
  );
}

function DesignCard({ design }) {
  const [likes, setLikes] = useState(design.likes);
  const navigate = useNavigate();

  async function like(e) {
    e.preventDefault();
    const { data } = await api.post(`/designs/${design.id}/like`);
    setLikes(data.likes);
  }

  async function download(e) {
    e.preventDefault();
    const response = await api.post(`/designs/${design.id}/download`, {}, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.title}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share(e) {
    e.preventDefault();
    const url = `${window.location.origin}/design/${design.slug}`;
    if (navigator.share) await navigator.share({ title: design.title, url });
    else {
      await navigator.clipboard.writeText(url);
      alert("Design link copied!");
    }
  }

  return (
    <article className="card" onClick={() => navigate(`/design/${design.slug}`)}>
      <img src={design.image_url} alt={design.title} />
      <div className="card-body">
        <span className="tag">{design.category}</span>
        <h3>{design.title}</h3>
        <p className="price">₹{Number(design.price).toLocaleString("en-IN")}</p>
        <div className="actions">
          <button onClick={like}>♥ {likes}</button>
          <button onClick={download}>↓ Download</button>
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
    api.get(`/designs/${slug}`).then(r => setDesign(r.data)).catch(() => setDesign(false));
  }, [slug]);

  if (design === null) return <p className="center">Loading...</p>;
  if (!design) return <p className="center">Design not found.</p>;

  return (
    <main className="details">
      <img src={design.image_url} alt={design.title} />
      <div>
        <span className="tag">{design.category}</span>
        <h1>{design.title}</h1>
        <div className="big-price">₹{Number(design.price).toLocaleString("en-IN")}</div>
        <p>{design.description}</p>
        <p>♥ {design.likes} likes · ↓ {design.downloads} downloads</p>
        <Link to="/" className="secondary-btn">← Back to designs</Link>
      </div>
    </main>
  );
}

function Admin() {
  const [logged, setLogged] = useState(!!localStorage.getItem("adminToken"));
  const [designs, setDesigns] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "Bridal", price: "", image: null });

  useEffect(() => { if (logged) load(); }, [logged]);

  async function load() {
    const { data } = await api.get("/designs");
    setDesigns(data);
  }

  if (!logged) return <AdminLogin onLogin={() => setLogged(true)} />;

  function reset() {
    setEditing(null);
    setForm({ title: "", description: "", category: "Bridal", price: "", image: null });
  }

  function edit(d) {
    setEditing(d);
    setForm({ title: d.title, description: d.description, category: d.category, price: d.price, image: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== "") fd.append(k, v);
    });

    if (editing) await api.put(`/admin/designs/${editing.id}`, fd, { headers: adminHeaders() });
    else await api.post("/admin/designs", fd, { headers: adminHeaders() });

    reset();
    await load();
    alert("Design saved successfully.");
  }

  async function remove(id) {
    if (!confirm("Delete this design?")) return;
    await api.delete(`/admin/designs/${id}`, { headers: adminHeaders() });
    load();
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setLogged(false);
  }

  return (
    <main className="admin-page">
      <div className="admin-head">
        <div><span className="eyebrow">ADMIN PANEL</span><h1>{editing ? "Edit Design" : "Add New Design"}</h1></div>
        <button onClick={logout}>Logout</button>
      </div>

      <form className="admin-form" onSubmit={save}>
        <input required placeholder="Design title" value={form.title} onChange={e => setForm({...form, title:e.target.value})} />
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
        <select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
          {categories.slice(1).map(c => <option key={c}>{c}</option>)}
        </select>
        <input required type="number" min="0" step="0.01" placeholder="Price ₹" value={form.price} onChange={e => setForm({...form, price:e.target.value})} />
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setForm({...form, image:e.target.files[0] || null})} />
        <div>
          <button className="primary-btn">{editing ? "Update Design" : "Add Design"}</button>
          {editing && <button type="button" className="secondary-btn" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <h2>Manage Designs</h2>
      <div className="admin-list">
        {designs.map(d => (
          <div className="admin-row" key={d.id}>
            <img src={d.image_url} alt="" />
            <div><strong>{d.title}</strong><p>{d.category} · ₹{Number(d.price).toLocaleString("en-IN")}</p></div>
            <button onClick={() => edit(d)}>Edit / Change Price</button>
            <button className="danger" onClick={() => remove(d.id)}>Delete</button>
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
      const { data } = await api.post("/admin/login", { email, password });
      localStorage.setItem("adminToken", data.token);
      onLogin();
    } catch {
      alert("Invalid admin email or password.");
    }
  }
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={login}>
        <span className="eyebrow">ADMIN ONLY</span>
        <h1>Admin Login</h1>
        <input required type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} />
        <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="primary-btn">Login</button>
        <small>Demo: admin@example.com / admin123</small>
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
