import React, { useState } from 'react';
import { extractGaps, generatePlan } from '../services/api';
import { Search, ChevronRight, GitBranch, Terminal } from 'lucide-react';
import './Analyzer.css';

const Analyzer = () => {
  const [abstract, setAbstract] = useState('');
  const [step, setStep] = useState(1); // 1: Input, 2: Loading Gaps, 3: Show Gaps/Mock GitHub, 4: Loading Plans, 5: Show Plans
  const [gaps, setGaps] = useState([]);
  const [plans, setPlans] = useState([]);
  const [githubRepos, setGithubRepos] = useState('https://github.com/example/repo1, https://github.com/example/repo2');

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
      // Mock parsing the github repos input
      const context = githubRepos.split(',').map(r => ({ url: r.trim() }));
      const res = await generatePlan(abstract, context);
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
        <p>Pipeline: Abstract &rarr; AI Gap Extraction &rarr; GitHub Context &rarr; Hackathon Plan</p>
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
            <h3 className="flex items-center gap-2 text-blue"><GitBranch size={20} /> Dev 2 Step: GitHub Context</h3>
            <p className="text-muted mb-4 text-sm">Provide relevant GitHub repo URLs to ground the plan generation (comma separated).</p>
            <input 
              type="text" 
              value={githubRepos}
              onChange={(e) => setGithubRepos(e.target.value)}
            />
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
          Architecting Hackathon Execution Plans...
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

          <button className="btn-primary mt-4" onClick={() => { setStep(1); setAbstract(''); }}>
            Start New Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default Analyzer;
