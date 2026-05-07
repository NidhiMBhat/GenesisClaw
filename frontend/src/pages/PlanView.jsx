import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRunById } from '../services/api';
import { Search, ChevronLeft, Terminal } from 'lucide-react';
import './Analyzer.css'; // Reuse plan UI styles from Analyzer

const PlanView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [runData, setRunData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const data = await getRunById(id);
        setRunData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRun();
  }, [id]);

  if (loading) {
    return <div className="loading-state loader-pulse glass-panel p-6">Loading Full Execution Plan...</div>;
  }

  if (error || !runData) {
    return (
      <div className="animate-fade-in p-6">
        <button className="btn-primary mb-6" onClick={() => navigate('/')}>
          <ChevronLeft size={18} /> Back to Dashboard
        </button>
        <div className="glass-panel p-6 text-center">
          <h2 className="text-xl text-danger mb-2">Error Loading Plan</h2>
          <p className="text-muted">{error || "Plan not found."}</p>
        </div>
      </div>
    );
  }

  const { plans, meta } = runData;

  return (
    <div className="analyzer-container animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <button className="btn-primary" onClick={() => navigate('/')} style={{ background: '#2c2c2e', color: '#fff' }}>
          <ChevronLeft size={18} /> Back
        </button>
        <span className="text-muted text-sm">Run ID: {id} • {new Date(meta?.timestamp).toLocaleString()}</span>
      </div>
      
      <header className="page-header">
        <h1>Execution Plan Details</h1>
        <p>Full breakdown of architecture, roles, and timeline for this run.</p>
      </header>

      {plans && plans.map((p, i) => (
        <div key={i} className="plan-container glass-panel mb-6">
          <div className="plan-header">
            <h3>Plan for Gap: <span className="font-normal italic">"{p.gap_text}"</span></h3>
          </div>
          
          <div className="plan-content">
            <div className="plan-section">
              <h4><Terminal size={16} /> Architecture</h4>
              <div className="arch-layers">
                {p.plan.architecture.map((layer) => (
                  <div key={layer.layer} className="layer-item">
                    <div className="layer-num">L{layer.layer}</div>
                    <div className="layer-info">
                      <h5>{layer.name}</h5>
                      <p>{layer.description}</p>
                      <div className="tech-stack">
                        {layer.tech_stack.map(t => <span key={t} className="tech-tag">{t}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="plan-section timeline-section">
              <h4><Search size={16} /> 24-Hour Timeline</h4>
              <div className="timeline-blocks">
                {p.plan.timeline.map((t, idx) => (
                  <div key={idx} className="time-block">
                    <span className="time-range">{t.hour_range}</span>
                    <div className="time-details">
                      <p className="task">{t.task}</p>
                      <span className="owner">{t.owner}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="plan-section">
              <h4>Roles</h4>
              <div className="roles-grid">
                {p.plan.roles.map((r, idx) => (
                  <div key={idx} className="role-card">
                    <h5>{r.role_title}</h5>
                    <div className="text-xs text-muted mb-1">Responsibilities:</div>
                    <ul className="text-sm pl-4 mb-2">
                      {r.responsibilities.map(res => <li key={res}>{res}</li>)}
                    </ul>
                    <div className="text-xs text-muted mb-1">Skills:</div>
                    <div className="flex flex-wrap gap-1">
                        {r.required_skills.map(s => <span key={s} className="tech-tag text-xs">{s}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlanView;
