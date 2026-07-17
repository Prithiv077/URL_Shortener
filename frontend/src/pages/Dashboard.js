import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../Dashboard.css";

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

    {/* Navbar */}
    <nav className="navbar">
      <div className="logo">
        URL <span>Shortener</span>
      </div>

      <div className="nav-right">
        <span className="user-email">{email}</span>
        <button className="btn btn-danger" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>

    {/* Shortener */}
    <section className="shorten-box">
      <h2>Create Short Link</h2>
      <p className="subtitle">
        Paste your long URL below and generate a shareable short link instantly.
      </p>

      <form onSubmit={handleShorten}>
        <div className="input-row">
          <input
            type="url"
            placeholder="https://example.com/very-long-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating..." : "Shorten"}
          </button>
        </div>

        <div className="optional-grid">

          <div className="form-group">
            <label>Custom Alias</label>
            <input
              type="text"
              placeholder="my-link"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

        </div>
      </form>

      {error && <p className="error-msg">{error}</p>}

      {result && (
        <div className="result-box">

          <img src={result.qrCode} alt="QR Code" />

          <div className="result-info">
            <h3>Short URL Created 🎉</h3>

            <a
              href={result.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="short-url"
            >
              {result.shortUrl}
            </a>

            <p className="original-url">
              {result.originalUrl}
            </p>

            <div className="result-actions">
              <button
                className="btn btn-copy"
                onClick={() => handleCopy(result.shortUrl)}
              >
                {copied === result.shortUrl ? "Copied!" : "Copy"}
              </button>

              <a
                href={result.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Open
              </a>
            </div>
          </div>

        </div>
      )}
    </section>

    {/* Dashboard Stats */}

    <section className="stats-grid">

      <div className="stat-card">
        <h4>Total Links</h4>
        <h2>{links.length}</h2>
      </div>

      <div className="stat-card">
        <h4>Total Clicks</h4>
        <h2>{links.reduce((a, b) => a + b.clicks, 0)}</h2>
      </div>

      <div className="stat-card">
        <h4>Active Links</h4>
        <h2>{links.filter(link => !link.expires_at).length}</h2>
      </div>

    </section>

    {/* Search */}

    <section className="toolbar">

      <input
        className="search-box"
        type="text"
        placeholder="Search links..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        value={sortType}
        onChange={(e) => setSortType(e.target.value)}
      >
        <option value="latest">Latest</option>
        <option value="clicks">Most Clicked</option>
      </select>

      <button
        className="btn btn-copy"
        onClick={exportLinks}
      >
        Export JSON
      </button>

    </section>

    {/* Links */}

    <section className="links-section">

      <h2>
        Your Links ({links.length})
      </h2> 

            {links.length === 0 ? (

        <div className="empty-state">
          <h3>No links yet 🚀</h3>
          <p>Create your first shortened URL above.</p>
        </div>

      ) : (

        links
          .filter(
            (link) =>
              link.original_url
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              link.shortUrl
                .toLowerCase()
                .includes(search.toLowerCase())
          )
          .sort((a, b) => {
            if (sortType === "clicks") return b.clicks - a.clicks;
            return new Date(b.created_at) - new Date(a.created_at);
          })
          .map((link) => (

            <div className="link-card" key={link.id}>

              <div className="link-info">

                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="short-link"
                >
                  {link.shortUrl}
                </a>

                <p className="original-link">
                  {link.original_url}
                </p>

                <div className="link-meta">

                  <span>👁 {link.clicks} Clicks</span>

                  <span>
                    📅 {formatDate(link.created_at)}
                  </span>

                  {link.expires_at && (
                    <span>
                      ⏳ {formatDate(link.expires_at)}
                    </span>
                  )}

                </div>

              </div>

              <div className="link-buttons">

                <button
                  className="btn btn-copy"
                  onClick={() => handleCopy(link.shortUrl)}
                >
                  {copied === link.shortUrl ? "Copied!" : "Copy"}
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => handleShowQR(link)}
                >
                  QR
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(link.id)}
                >
                  Delete
                </button>

              </div>

            </div>

          ))

      )}

    </section>

    {/* QR Modal */}

    {qrModal && (
      <div
        className="modal-overlay"
        onClick={() => setQrModal(null)}
      >

        <div
          className="modal"
          onClick={(e) => e.stopPropagation()}
        >

          <h2>QR Code</h2>

          <img
            src={qrModal.qrCode}
            alt="QR Code"
          />

          <p>{qrModal.shortUrl}</p>

          <button
            className="btn btn-primary"
            onClick={() => setQrModal(null)}
          >
            Close
          </button>

        </div>

      </div>
    )}

  </div>
);

}

export default Dashboard;