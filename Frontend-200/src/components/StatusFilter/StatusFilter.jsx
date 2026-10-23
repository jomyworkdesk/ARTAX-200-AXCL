import { Send, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import './StatusFilter.css';

/**
 * StatusFilter Component
 * Reusable status filter tabs for displaying data by status
 * 
 * @param {string} activeStatus - Currently selected status (All, Pending, Success, Failed)
 * @param {Function} onStatusChange - Callback when status tab is clicked
 * @param {Array} tabs - Tab configuration array with {id, label, count}
 */
const StatusFilter = ({ activeStatus = 'All', onStatusChange, tabs = [] }) => {
  const getTabIcon = (tabId) => {
    switch (tabId) {
      case 'Sent': 
        return <Send size={16} className="tab-icon" />;
      case 'Success': 
        return <CheckCircle size={16} className="tab-icon" />;
      case 'Failed': 
        return <AlertTriangle size={16} className="tab-icon" />;
      case 'Pending': 
        return <Clock size={16} className="tab-icon" />;
      default: 
        return null;
    }
  };

  return (
    <div className="status-filter-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`status-tab-btn ${activeStatus === tab.id ? 'active' : ''}`}
          onClick={() => onStatusChange(tab.id)}
          title={`Filter by ${tab.label} (${tab.count})`}
        >
          {getTabIcon(tab.id)}
          <span className="tab-label">{tab.label}</span>
          <span className="tab-count">({tab.count})</span>
        </button>
      ))}
    </div>
  );
};

export default StatusFilter;
