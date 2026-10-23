import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { apiUrl } from '../config/api';
import '../Styles/Invoices.css'; // Reuse invoice styles for the table

const Clients = ({ editBasePath = '/configure/buyer' }) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Table State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: 'Name', direction: 'asc' });

  const handleViewClient = (client) => {
    const idCust = client.idCust || client.id;
    if (!idCust) return;
    navigate(`${editBasePath}/${encodeURIComponent(idCust)}`);
  };

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/configure/buyers'));
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load buyers');
      }

      setClients(result.data || []);
    } catch (error) {
      console.error('Error fetching buyers:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Table Logic ---

  // Search
  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      (client.Name || client.tradingName || '').toLowerCase().includes(query) ||
      (client.Physical1 || client.addressLine1 || '').toLowerCase().includes(query) ||
      (client.Physical2 || client.addressLine2 || '').toLowerCase().includes(query) ||
      (client.Physical3 || client.addressLine3 || '').toLowerCase().includes(query)
    );
  });

  // Sort
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let aVal = (a[sortConfig.key] || '').toLowerCase();
    let bVal = (b[sortConfig.key] || '').toLowerCase();

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalClients = sortedClients.length;
  const totalPages = Math.max(1, Math.ceil(totalClients / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = totalClients === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage;
  const pageEndIndex = Math.min(pageStartIndex + rowsPerPage, totalClients);
  const paginatedClients = sortedClients.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUp size={14} className="sort-icon-placeholder" style={{ opacity: 0.2 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  return (
    <div className="invoices-page fade-in">
     
      
      <div className="card table-card">
        {/* Controls Bar */}
        <div className="table-controls">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center' }}>
            {isLoading ? 'Loading customers...' : 'Customers'}
          </div>
          <div className="table-actions">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search customers by name or address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sl No</th>
                <th className="sortable-th" onClick={() => handleSort('Name')}>
                  Name {getSortIcon('Name')}
                </th>
                <th className="sortable-th" onClick={() => handleSort('Physical1')}>
                  Address 1 {getSortIcon('Physical1')}
                </th>
                <th className="sortable-th" onClick={() => handleSort('Physical2')}>
                  
                  Address 2 {getSortIcon('Physical2')}
                </th>
                <th className="sortable-th" onClick={() => handleSort('Physical3')}>
                  Address 3 {getSortIcon('Physical3')}
                </th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-secondary">No buyers found</td>
                </tr>
              ) : (
                paginatedClients.map((client, idx) => (
                  <tr key={client.id}>
                    <td className="sl-no">{pageStartIndex + idx + 1}</td>
                    <td className="font-medium">{client.Name || client.tradingName || '-'}</td>
                    <td>{client.Physical1 || client.addressLine1 || '-'}</td>
                    <td>{client.Physical2 || client.addressLine2 || '-'}</td>
                    <td>{client.Physical3 || client.addressLine3 || '-'}</td>
                    <td className="text-right">
                      <button 
                        className="action-btn"
                        onClick={() => handleViewClient(client)}
                        title="View / Edit Details"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Info */}
        <div className="table-footer">
          <div className="footer-left">
            <span className="text-secondary text-sm">
              {totalClients === 0
                ? 'Showing 0 of 0 buyers'
                : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${totalClients} buyers`}
            </span>
            <div className="rows-selector">
              <span className="text-secondary text-sm">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rows-select"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
          <div className="pagination">
            <button
              className={`page-btn ${safeCurrentPage === 1 ? 'disabled' : ''}`}
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className={`page-btn ${safeCurrentPage === totalPages || totalClients === 0 ? 'disabled' : ''}`}
              disabled={safeCurrentPage === totalPages || totalClients === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clients;
