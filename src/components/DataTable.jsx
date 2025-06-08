// DataTable.jsx
import { useState } from 'react';

export default function DataTable({ headers, rows }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  
  // Define which columns are sortable
  const sortableColumns = ['Name', 'Customer', 'First Name', 'Last Name', 'Role', 'Class', 'Classes'];
  
  // Define column widths - consistent across all tables
  const getColumnClass = (header) => {
    // Name columns - all same width
    if (header === 'Name' || header === 'Customer' || header === 'First Name' || header === 'Last Name') return 'w-32';
    
    // ID columns
    if (header === 'Customer ID' || header === 'Order ID') return 'w-24';
    
    // Class-related columns
    if (header === 'Class' || header === 'Classes') return 'w-32';
    if (header === 'Class Date') return 'w-24';
    
    // Small columns
    if (header === 'Role') return 'w-20';
    if (header === 'Paid' || header === 'Total' || header === 'Attended') return 'w-16';
    
    // Date/Time columns
    if (header === 'Order Date' || header === 'Date') return 'w-32';
    if (header === 'Check-in Time' || header === 'Time') return 'w-36'; // Slightly wider to prevent wrapping
    
    // Week columns - made wider to prevent header wrapping
    if (header.startsWith('Week') || header.match(/^W\d$/)) return 'w-20'; // Increased from w-16
    
    // Other columns
    if (header === 'Email') return 'w-48';
    if (header === 'Notes') return 'w-32'; // Same as name column
    if (header === 'Attendance') return 'w-32'; // For search view
    
    return 'w-32'; // Default width
  };

  // Handle sorting
  const handleSort = (columnIndex) => {
    const header = headers[columnIndex];
    if (!sortableColumns.includes(header)) return;

    let direction = 'asc';
    if (sortConfig.key === columnIndex && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnIndex, direction });
  };

  // Sort rows if needed
  const sortedRows = [...rows];
  if (sortConfig.key !== null) {
    sortedRows.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      // Handle React elements (checkboxes) - don't sort these
      if (typeof aValue !== 'string' || typeof bValue !== 'string') return 0;
      
      // Compare strings
      if (sortConfig.direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }

  return (
    <div className="overflow-x-auto" style={{
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      <style jsx>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((header, idx) => {
              const isSortable = sortableColumns.includes(header);
              const isSorted = sortConfig.key === idx;
              
              return (
                <th 
                  key={idx} 
                  onClick={() => isSortable && handleSort(idx)}
                  className={`${getColumnClass(header)}`}
                  style={{
                    textAlign: 'left',
                    padding: '1.2rem 1.5rem',
                    color: 'var(--text-muted)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontSize: '0.85rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'all 0.3s ease',
                    ...(headers[idx] === 'Attended' || headers[idx] === 'Paid' || headers[idx].startsWith('Week') || headers[idx].match(/^W\d$/) ? { textAlign: 'center' } : {})
                  }}
                  onMouseEnter={(e) => {
                    if (isSortable) {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: headers[idx] === 'Attended' || headers[idx] === 'Paid' || headers[idx].startsWith('Week') || headers[idx].match(/^W\d$/) ? 'center' : 'flex-start' }}>
                    {header}
                    {isSortable && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {!isSorted ? '↕' : sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody style={{
          transition: 'all 0.5s ease'
        }}>
          {sortedRows.map((row, rowIdx) => (
            <tr 
              key={rowIdx} 
              style={{
                transition: 'all 0.3s ease',
                borderRadius: '12px',
                opacity: 0,
                animation: 'fadeInRow 0.5s ease forwards',
                animationDelay: `${rowIdx * 0.05}s`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {row.map((cell, cellIdx) => (
                <td 
                  key={cellIdx} 
                  style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: rowIdx === sortedRows.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: headers[cellIdx] === 'Name' || headers[cellIdx] === 'Customer' || headers[cellIdx] === 'First Name' || headers[cellIdx] === 'Last Name' ? '700' : '500',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: headers[cellIdx] === 'Notes' ? '128px' : 
                             headers[cellIdx] === 'Email' ? '192px' :
                             headers[cellIdx] === 'Classes' ? '128px' :
                             headers[cellIdx] === 'Check-in Time' ? '144px' :
                             undefined,
                    ...(headers[cellIdx].startsWith('Week') || headers[cellIdx].match(/^W\d$/) || headers[cellIdx] === 'Attended' || headers[cellIdx] === 'Paid' ? { textAlign: 'center' } : {})
                  }}
                  title={typeof cell === 'string' ? cell : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <style jsx>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
        @keyframes fadeInRow {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}