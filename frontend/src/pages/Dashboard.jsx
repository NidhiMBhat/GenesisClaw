import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../services/api';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState({ entries: [], count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getLeaderboard();
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading-state loader-pulse">Syncing with GenesisClaw Network...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Trending Gaps</h1>
        <p>Live analysis of recently discovered research opportunities and execution plans.</p>
      </header>

      <div className="grid-3 mt-4">
        {data.entries.map((entry, index) => (
          <div key={entry.id} className="glass-panel gap-card" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="card-header">
              <span className={`badge badge-${entry.top_gap_confidence}`}>
                {entry.top_gap_confidence.toUpperCase()} CONFIDENCE
              </span>
              <span className="timestamp"><Clock size={14} /> {new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            
            <h3 className="gap-title">"{entry.top_gap}"</h3>
            
            <div className="keywords">
              {entry.top_keywords?.map(kw => (
                <span key={kw} className="kw-tag">{kw}</span>
              ))}
            </div>

            <div className="stats-row">
              <div className="stat">
                <span className="label">Gaps</span>
                <span className="value">{entry.gaps_found}</span>
              </div>
              <div className="stat">
                <span className="label">Plans</span>
                <span className="value">{entry.plans_generated}</span>
              </div>
              <div className="stat">
                <span className="label">Speed</span>
                <span className="value">{entry.duration_ms}ms</span>
              </div>
            </div>

            <div className="models-info">
              <span className="label">Target: </span>
              {entry.recommended_models?.join(', ')}
              {entry.on_device_compatible && <span className="device-badge">Edge Ready</span>}
            </div>
            
            <div className="status-banner">
               {entry.status === 'success' ? (
                 <span className="success"><CheckCircle size={14} /> Pipeline Complete</span>
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
