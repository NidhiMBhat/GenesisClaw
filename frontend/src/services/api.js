import { MOCK_LEADERBOARD, MOCK_GAPS, MOCK_ANALYSIS_PLAN } from '../data/mockData';

const API_BASE = 'http://localhost:3000/api';
// Set to true to use real backend, false for mock data during UI dev
const USE_MOCK = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getLeaderboard = async () => {
  if (USE_MOCK) {
    await delay(500);
    return MOCK_LEADERBOARD;
  }

  const res = await fetch(`${API_BASE}/leaderboard`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
};

export const extractGaps = async (abstract) => {
  if (USE_MOCK) {
    await delay(1500);
    return MOCK_GAPS;
  }

  const res = await fetch(`${API_BASE}/analyze/gaps-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abstract })
  });
  if (!res.ok) throw new Error('Failed to extract gaps');
  return res.json();
};

export const generatePlan = async (payload) => {
  if (USE_MOCK) {
    await delay(2000);
    return MOCK_ANALYSIS_PLAN;
  }

  // Payload already contains { abstract, github_context, timeline_hours, team_size }
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to analyze and plan');
  return res.json();
};

export const getRunById = async (id) => {
  if (USE_MOCK) {
    await delay(500);
    return MOCK_ANALYSIS_PLAN; // Return mock plan if in mock mode
  }

  const res = await fetch(`${API_BASE}/run/${id}`);
  if (!res.ok) throw new Error('Failed to fetch run data');
  return res.json();
};