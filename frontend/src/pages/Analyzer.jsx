import React, { useState } from 'react';
import { extractGaps, generatePlan } from '../services/api';
import { Search, ChevronRight, GitBranch, Terminal, Clock, Users } from 'lucide-react';
import './Analyzer.css';

const Analyzer = () => {
  const [abstract, setAbstract] = useState('');
  const [step, setStep] = useState(1);
  const [gaps, setGaps] = useState([]);
  const [plans, setPlans] = useState([]);
  
  // Dev 2 & 3 Inputs
  const [githubRepos, setGithubRepos] = useState('https://github.com/example/repo1');
  const [timeline, setTimeline] = useState('24');
  const [teamSize, setTeamSize] = useState('4');

  const handleExtractGaps = async () => {
    if (!abstract || abstract.length < 50) return alert('Abstract too short.');
    setStep(2);
    try {
      const res = await extractGaps(abstract);
      setGaps(res.gaps || []);
      setStep(3);
    } catch (err) {
      console.error(err);
      setStep(1);
    }
  };

  const handleGeneratePlans = async () => {
    setStep(4);
    try {
      const context = githubRepos.split(',').filter(r => r.trim()).map(r => ({ url: r.trim() }));
      
      // Sending timeline and teamSize to the API
      const res = await generatePlan({
        abstract, 
        github_context: context,
        timeline_hours: Number(timeline),
        team_size: Number(teamSize)
      });
      
      setPlans(res.plans || []);
      setStep(5);
    } catch (err) {
      console.error(err);
      setStep(3);
    }
  };

  return (
    <div className="analyzer-container animate-fade-in">
      <header className="page-header">
        <h1>New Analysis Flow</h1>
        <p>Pipeline: Abstract &rarr; AI Gap Extraction &rarr; Project Parameters &rarr; Execution Plan</p>
      </header>

      {step === 1 && (
        <div className="glass-panel p-6">
          <h2 className="mb-4 text-xl">1. Provide Abstract</h2>
          <textarea 
            rows={8} 
            placeholder="Paste your research paper abstract here (min 50 chars)..."
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={handleExtractGaps} disabled={abstract.length < 50}>
              Extract Gaps <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="loading-state loader-pulse glass-panel p-6">
          Analyzing Abstract and Extracting Gaps...
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in">
          <h2 className="mb-4 text-xl">2. Review Extracted Gaps</h2>
          <div className="gaps-list mb-6">
            {gaps.map((g, i) => (
              <div key={i} className="glass-panel p-4 gap-item">
                <span className={`badge badge-${g.confidence} mb-2`}>{g.confidence} Confidence</span>
                <p className="gap-text">"{g.gap_text}"</p>
                <div className="keywords mt-2">
                  {g.keywords.map(kw => <span key={kw} className="kw-tag">{kw}</span>)}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel p-6 mt-6 dev2-mock">
            <h3 className="flex items-center gap-2 text-blue mb-4"><Settings size={20} /> Project Parameters</h3>
            
            <div className="grid-3 gap-4 mb-4">
              <div>
                <label className="text-sm text-muted flex items-center gap-1 mb-1"><Clock size={14}/> Timeline (Hours)</label>
                <select value={timeline} onChange={(e) => setTimeline(e.target.value)} className="w-full p-2 bg-dark border border-gray-700 rounded">
                  <option value="12">12 Hours (Sprint)</option>
                  <option value="24">24 Hours (Hackathon)</option>
                  <option value="48">48 Hours (Weekend)</option>
                  <option value="168">1 Week (Project)</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-muted flex items-center gap-1 mb-1"><Users size={14}/> Team Size</label>
                <input 
                  type="number" min="1" max="10"
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  className="w-full p-2 bg-dark border border-gray-700 rounded"
                />
              </div>
            </div>

            <div className="mb-4">
               <label className="text-sm text-muted flex items-center gap-1 mb-1"><GitBranch size={14}/> GitHub Context URLs (Comma separated)</label>
               <input 
                 type="text" 
                 value={githubRepos}
                 onChange={(e) => setGithubRepos(e.target.value)}
                 className="w-full p-2 bg-dark border border-gray-700 rounded"
               />
            </div>

            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={handleGeneratePlans}>
                Generate Execution Plans <Terminal size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="loading-state loader-pulse glass-panel p-6">
          Architecting {timeline}-Hour Execution Plans for a Team of {teamSize}...
        </div>
      )}

      {step === 5 && (
        <div className="animate-fade-in">
          <h2 className="mb-4 text-xl text-success">3. Execution Plans Generated</h2>
          
          {plans.map((p, i) => (
            <div key={i} className="plan-container glass-panel mb-6">
              <div className="plan-header">
                <h3>Plan for Gap: <span className="font-normal italic">"{p.gap_text}"</span></h3>
              </div>
              
              <div className="plan-content">
                <div className="plan-section">
                  <h4><Terminal size={16} /> Architecture</h4>
                  <div className="arch-layers">
                    {p.plan?.architecture?.map((layer) => (
                      <div key={layer.layer} className="layer-item">
                        <div className="layer-num">L{layer.layer}</div>
                        <div className="layer-info">
                          <h5>{layer.name}</h5>
                          <p>{layer.description}</p>
                          <div className="tech-stack">
                            {layer.tech_stack?.map(t => <span key={t} className="tech-tag">{t}</span>)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="plan-section timeline-section">
                  <h4><Search size={16} /> {timeline}-Hour Timeline</h4>
                  <div className="timeline-blocks">
                    {p.plan?.timeline?.map((t, idx) => (
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
                  <h4>Roles ({teamSize} Members)</h4>
                  <div className="roles-grid">
                    {p.plan?.roles?.map((r, idx) => (
                      <div key={idx} className="role-card">
                        <h5>{r.role_title}</h5>
                        <ul className="text-sm pl-4 mb-2 mt-2">
                          {r.responsibilities?.map(res => <li key={res}>{res}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button className="btn-primary mt-4" onClick={() => { setStep(1); setAbstract(''); }}>
            Start New Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default Analyzer;