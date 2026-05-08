import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, AlertTriangle, Settings, Radio } from 'lucide-react';
import './Dashboard.css';

// Using standard fetch, assuming your backend is on localhost:3000
const API_BASE = import.meta.env.VITE_API_BASE || 'https://346c9ed611e0dd.lhr.life';

const Dashboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [topGaps, setTopGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Niche Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [availableNiches, setAvailableNiches] = useState([]);
  const [activeNiches, setActiveNiches] = useState([]);
  const [savingNiches, setSavingNiches] = useState(false);

  useEffect(() => {
    // 1. Fetch initial Leaderboard & Niches
    const fetchInitialData = async () => {
      try {
        const [boardRes, nichesRes] = await Promise.all([
          fetch(`${API_BASE}/leaderboard`),
          fetch(`${API_BASE}/niches`)
        ]);
        
        if (boardRes.ok) {
          const boardData = await boardRes.json();
          setEntries(boardData.entries || []);
          calculateTopRanked(boardData.entries || []);
        }
        
        if (nichesRes.ok) {
          const nichesData = await nichesRes.json();
          setAvailableNiches(nichesData.available || []);
          setActiveNiches(nichesData.active || []);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // 2. Connect to SSE Live Stream
    const sse = new EventSource(`${API_BASE}/stream`);
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_result' || data.type === 'NEW_RESEARCH_GAP') {
           // Reload leaderboard to get the fresh data
           fetchInitialData();
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    return () => sse.close();
  }, []);

  // Ranking Logic: High confidence first, then by most plans generated, then newest
  const calculateTopRanked = (data) => {
    const sorted = [...data].sort((a, b) => {
      const confA = a.top_gap_confidence === 'high' ? 2 : 1;
      const confB = b.top_gap_confidence === 'high' ? 2 : 1;
      if (confA !== confB) return confB - confA;
      if (b.plans_generated !== a.plans_generated) return b.plans_generated - a.plans_generated;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    setTopGaps(sorted.slice(0, 3));
  };

  const handleNicheToggle = (niche) => {
    setActiveNiches(prev => 
      prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]
    );
  };

  const saveNicheSettings = async () => {
    if (activeNiches.length === 0) return alert("Select at least one niche.");
    setSavingNiches(true);
    try {
      await fetch(`${API_BASE}/niches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niches: activeNiches })
      });
      setShowSettings(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNiches(false);
    }
  };

  if (loading) return <div className="loading-state loader-pulse">Syncing with GenesisClaw Network...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header flex justify-between items-center">
        <div>
          <h1><Radio size={24} className="inline text-success mr-2 animate-pulse" /> Daily Agent Updates</h1>
          <p>Live stream of autonomous research gaps from arXiv.</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => setShowSettings(!showSettings)}>
          <Settings size={18} /> Engine Settings
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-panel p-4 mb-6 animate-fade-in">
          <h3 className="mb-2">Active Research Niches (arXiv feeds)</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {availableNiches.map(niche => (
              <label key={niche} className={`kw-tag cursor-pointer ${activeNiches.includes(niche) ? 'bg-blue text-white' : 'opacity-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={activeNiches.includes(niche)}
                  onChange={() => handleNicheToggle(niche)} 
                />
                {niche}
              </label>
            ))}
          </div>
          <button className="btn-primary text-sm" onClick={saveNicheSettings} disabled={savingNiches}>
            {savingNiches ? "Updating Heartbeat..." : "Save Engine Config"}
          </button>
        </div>
      )}

      {/* Top 3 Ranked */}
      <h2 className="text-xl mb-4 text-blue">🏆 Top 3 Ranked Opportunities</h2>
      <div className="grid-3 mt-4 mb-8">
        {topGaps.map((entry, index) => (
          <div 
            key={entry.id + "_top"} 
            className="glass-panel gap-card clickable-card border-l-4 border-blue" 
            onClick={() => navigate(`/plan/${entry.id}`)}
          >
            <div className="card-header">
              <span className={`badge badge-${entry.top_gap_confidence}`}>Rank #{index + 1}</span>
              <span className="timestamp"><Clock size={14} /> {new Date(entry.timestamp).toLocaleDateString()}</span>
            </div>
            <h3 className="gap-title text-lg">"{entry.top_gap}"</h3>
            <div className="keywords">
              {entry.top_keywords?.slice(0,3).map(kw => <span key={kw} className="kw-tag text-xs">{kw}</span>)}
            </div>
          </div>
        ))}
      </div>

      <hr className="my-6 border-gray-700" />

      {/* Full Live Feed */}
      <h2 className="text-xl mb-4">Live Analysis Feed ({entries.length})</h2>
      <div className="grid-3 mt-4">
        {entries.map((entry, index) => (
          <div 
            key={entry.id} 
            className="glass-panel gap-card clickable-card" 
            style={{ animationDelay: `${(index % 10) * 0.05}s` }}
            onClick={() => navigate(`/plan/${entry.id}`)}
          >
            <div className="card-header">
              <span className={`badge badge-${entry.top_gap_confidence}`}>
                {entry.top_gap_confidence?.toUpperCase() || "MEDIUM"} CONFIDENCE
              </span>
              <span className="timestamp"><Clock size={14} /> {new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            
            <h3 className="gap-title">"{entry.top_gap || "Multiple gaps extracted"}"</h3>
            <div className="status-banner mt-4">
               {entry.status === 'success' ? (
                 <span className="success"><CheckCircle size={14} /> Pipeline Complete ({entry.plans_generated} Plans)</span>
               ) : (
                 <span className="partial"><AlertTriangle size={14} /> Partial Success</span>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;