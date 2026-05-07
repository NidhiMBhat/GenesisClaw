import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Beaker, Menu, Database } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Database className="brand-icon loader-pulse" />
        <h2>GenesisClaw</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <Activity size={20} />
          <span>Trending Gaps</span>
        </NavLink>
        <NavLink to="/analyze" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <Beaker size={20} />
          <span>New Analysis</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <p>System Status: <span className="status-indicator"></span> Online</p>
      </div>
    </div>
  );
};

export default Sidebar;
