import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

function Dashboard() {
  const [links,     setLinks]     = useState([]);
  const [url,       setUrl]       = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState("latest");
  const [result,    setResult]    = useState(null); // newly created link
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [qrModal,   setQrModal]   = useState(null); // link shown in QR popup
  const [copied,    setCopied]    = useState("");
  const navigate = useNavigate();

  const email = localStorage.getItem("email");

  // Fetch all user's links when page first loads
  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await API.get("/links");
      setLinks(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout(); // token expired
    }
  };

  // Shorten a new URL
  const handleShorten = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await API.post("/links", {
        originalUrl: url,
        expiresAt  : expiresAt || null,
        customAlias : customAlias || null,
      });
      setResult(res.data); // contains shortUrl + qrCode
      setUrl("");
      setExpiresAt("");
      setCustomAlias("");
      fetchLinks(); // refresh list
    } catch (err) {
      setError(err.response?.data?.error || "Failed to shorten URL");
    } finally {
      setLoading(false);
    }
  };

  // Delete a link by ID
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this link?")) return;
    try {
      await API.delete(`/links/${id}`);
      setLinks(links.filter((l) => l.id !== id));
    } catch {
      alert("Failed to delete");
    }
  };

  // Copy short URL to clipboard
  const handleCopy = (shortUrl) => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(shortUrl);
    setTimeout(() => setCopied(""), 2000);
  };

  // Fetch and show QR code for an existing link
  const handleShowQR = async (link) => {
    try {
      const res = await API.get(`/links/${link.short_code}/qr`);
      setQrModal({ ...link, qrCode: res.data.qrCode });
    } catch {
      alert("Failed to load QR");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    navigate("/login");
  };

  
  const exportLinks = () => {
    const data = JSON.stringify(links, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "links-backup.json";
    a.click();

    URL.revokeObjectURL(url);
  };


  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  return (
    <div className="dashboard-container">

      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">url-shortener</div>
        <span>{email}</span>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>

      {/* SHORTEN FORM */}
      <div className="shorten-box">
        <h2>Shorten a URL</h2>
        <form onSubmit={handleShorten}>
          <div className="input-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/very-long-url-here"
              required
            />
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: "auto" }}>
              {loading ? "..." : "Shorten"}
            </button>
          </div>

          
          <div className="form-group">
            <label>Custom Alias (optional)</label>
            <input
              type="text"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              placeholder="my-custom-link"
            />
          </div>

          <div className="form-group">

            <label>Expiry Date (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </form>

        {error && <p className="error-msg">{error}</p>}

        {/* RESULT BOX — shown after shortening */}
        {result && (
          <div className="result-box">
            <img src={result.qrCode} alt="QR Code" />
            <div className="result-info">
              <div className="short-url">{result.shortUrl}</div>
              <div className="original-url">→ {result.originalUrl}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-copy" onClick={() => handleCopy(result.shortUrl)}>
                  {copied === result.shortUrl ? "Copied!" : "Copy"}
                </button>
                <a href={result.shortUrl} target="_blank" rel="noreferrer"
                  className="btn btn-copy" style={{ textDecoration: "none" }}>
                  Open
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
          gap:"16px",
          marginBottom:"24px"
        }}>
          <div className="card">
            <h3>Total Links</h3>
            <h1>{links.length}</h1>
          </div>

          <div className="card">
            <h3>Total Clicks</h3>
            <h1>{links.reduce((a,b)=>a+b.clicks,0)}</h1>
          </div>

          <div className="card">
            <h3>Active Links</h3>
            <h1>{links.filter(l => !l.expires_at).length}</h1>
          </div>
        </div>

        <div style={{
          display:"flex",
          gap:"12px",
          marginBottom:"20px",
          flexWrap:"wrap"
        }}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            style={{maxWidth:"250px"}}
          />

          <select
            value={sortType}
            onChange={(e)=>setSortType(e.target.value)}
            style={{
              padding:"12px",
              borderRadius:"10px"
            }}
          >
            <option value="latest">Latest</option>
            <option value="clicks">Most Clicked</option>
          </select>

          <button className="btn btn-copy" onClick={exportLinks}>
            Export JSON
          </button>
        </div>


      {/* LINKS LIST */}
      <div className="links-section">
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2>Your Links ({links.length})</h2>
          <input
            type="text"
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: "220px" }}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div className="card" style={{ padding: "16px", maxWidth: "180px" }}>
            <strong>Total Links</strong>
            <div>{links.length}</div>
          </div>

          <div className="card" style={{ padding: "16px", maxWidth: "180px" }}>
            <strong>Total Clicks</strong>
            <div>{links.reduce((a, b) => a + b.clicks, 0)}</div>
          </div>
        </div>


        {links.length === 0 ? (
          <div className="empty-state">No links yet. Shorten one above!</div>
        ) : (
          links
            .filter((link) =>
              link.original_url.toLowerCase().includes(search.toLowerCase()) ||
              link.shortUrl.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a,b)=>{
              if(sortType === "clicks") return b.clicks - a.clicks;
              return new Date(b.created_at) - new Date(a.created_at);
            })
            .map((link) => (
            <div className="link-item" key={link.id}>
              <div className="link-left">
                <div className="short">{link.shortUrl}</div>
                <div className="original" title={link.original_url}>
                  {link.original_url}
                </div>
                <div className="link-meta">
                  <span>👁 {link.clicks} clicks</span>
                  <span>📅 {formatDate(link.created_at)}</span>
                  {link.expires_at && (
                    <span>⏳ Expires {formatDate(link.expires_at)}</span>
                  )}
                </div>
              </div>
              <div className="link-actions">
                <button className="btn btn-copy" onClick={() => handleCopy(link.shortUrl)}>
                  {copied === link.shortUrl ? "Copied!" : "Copy"}
                </button>
                <button className="btn btn-copy" onClick={() => handleShowQR(link)}>
                  QR
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(link.id)}>
                  Del
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR MODAL POPUP */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>QR Code</h3>
            <img src={qrModal.qrCode} alt="QR" />
            <p>{qrModal.shortUrl}</p>
            <button className="btn btn-primary" onClick={() => setQrModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;