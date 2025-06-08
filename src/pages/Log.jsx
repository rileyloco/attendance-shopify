// Log.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function Log() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [message, setMessage] = useState('');
  const [recentlyLogged, setRecentlyLogged] = useState(new Set());

  // Fetch all logs
  async function fetchLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('log')
        .select('*')
        .order('date_time', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      console.log('Fetched logs:', data);
      setLogs(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  // Toggle row selection
  function toggleRowSelection(logId) {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  }

// Get current week number based on term start date
  function getCurrentWeek() {
    // Get term settings from localStorage (set by Console)
    const termSettings = JSON.parse(localStorage.getItem('termSettings') || '{}');
    const startDate = termSettings.startDate;
    
    if (!startDate) {
      console.warn('No term start date found in settings, defaulting to week 1');
      return 1;
    }
    
    // Calculate weeks since term start
    const termStart = new Date(startDate);
    const today = new Date();
    
    // Reset time parts for accurate day calculation
    termStart.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Calculate difference in days
    const diffTime = today - termStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate week number (0-indexed, then add 1)
    const weekNumber = Math.floor(diffDays / 7) + 1;
    
    console.log('Week calculation:', {
      termStart: termStart.toDateString(),
      today: today.toDateString(),
      diffDays,
      weekNumber
    });
    
    // Cap at 5 weeks
    return Math.max(1, Math.min(weekNumber, 5));
  }

  // Log selected rows and update attendance
  async function logSelectedRows() {
    if (selectedRows.size === 0) {
      setMessage('Please select at least one row to log');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const selectedLogs = logs.filter(log => selectedRows.has(log.id));
    const logIds = Array.from(selectedRows);
    
    // Immediately move to logged section
    setLogs(prevLogs => 
      prevLogs.map(log => 
        selectedRows.has(log.id) ? { ...log, logged: true } : log
      )
    );
    
    // Add to recently logged for highlighting
    setRecentlyLogged(new Set(logIds));
    
    // Clear selection
    setSelectedRows(new Set());
    
    // Remove highlight after 1.5 seconds
    setTimeout(() => {
      setRecentlyLogged(new Set());
    }, 1500);

    // Update database in the background
    try {
      // Group logs by type (paid vs free)
      const paidLogs = [];
      const freeLogs = [];
      
      selectedLogs.forEach(log => {
        if (log.class === 'Free Class - New York Salsa') {
          freeLogs.push(log);
        } else {
          paidLogs.push(log);
        }
      });

      // Update paid attendance
      if (paidLogs.length > 0) {
        const currentWeek = getCurrentWeek();
        const weekColumn = `week_${currentWeek}`;
        
        for (const log of paidLogs) {
          // Find the attendance record
          const { data: attendanceRecord, error: findError } = await supabase
            .from('paid_attendance')
            .select('id')
            .eq('customer_id', log.customer_id)
            .eq('class_name', log.class)
            .eq('role', log.role || '')
            .single();

          if (findError) {
            console.error('Error finding attendance record:', findError);
            continue;
          }

          if (attendanceRecord) {
            // Update the attendance record
            const { error: updateError } = await supabase
              .from('paid_attendance')
              .update({ [weekColumn]: true })
              .eq('id', attendanceRecord.id);

            if (updateError) {
              console.error('Error updating paid attendance:', updateError);
            }
          }
        }
      }

      // Update free attendance
      if (freeLogs.length > 0) {
        for (const log of freeLogs) {
          // Extract date from notes (e.g., "Free class 27/05/2025")
          const dateMatch = log.notes?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!dateMatch) continue;
          
          // Convert DD/MM/YYYY to YYYY-MM-DD for database
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3];
          const classDate = `${year}-${month}-${day}`;
          
          // Find the attendance record
          const { data: attendanceRecord, error: findError } = await supabase
            .from('free_attendance')
            .select('id')
            .eq('customer_id', log.customer_id)
            .eq('class_date', classDate)
            .eq('role', log.role || '')
            .single();

          if (findError) {
            console.error('Error finding free attendance record:', findError);
            continue;
          }

          if (attendanceRecord) {
            // Update the attendance record
            const { error: updateError } = await supabase
              .from('free_attendance')
              .update({ attended: true })
              .eq('id', attendanceRecord.id);

            if (updateError) {
              console.error('Error updating free attendance:', updateError);
            }
          }
        }
      }

      // Mark logs as logged in database
      const { error: logError } = await supabase
        .from('log')
        .update({ logged: true })
        .in('id', logIds);

      if (logError) {
        console.error('Error marking logs as logged:', logError);
        // Revert on error
        setLogs(prevLogs => 
          prevLogs.map(log => 
            logIds.includes(log.id) ? { ...log, logged: false } : log
          )
        );
        setMessage('Failed to update log status');
        return;
      }

      setMessage(`Successfully logged ${logIds.length} records and updated attendance`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error logging records:', err);
      setMessage('Failed to log records');
    }
  }

  // Log all unlogged entries
  async function logAllUnlogged() {
    const unloggedLogs = logs.filter(log => !log.logged);
    if (unloggedLogs.length === 0) {
      setMessage('No unlogged entries to process');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const allUnloggedIds = unloggedLogs.map(log => log.id);
    
    try {
      // Mark all as logged in UI immediately for responsiveness
      setLogs(prevLogs => 
        prevLogs.map(log => 
          !log.logged ? { ...log, logged: true } : log
        )
      );

      // Add to recently logged
      setRecentlyLogged(new Set(allUnloggedIds));

      // Get current week
      const currentWeek = getCurrentWeek();
      const weekColumn = `week_${currentWeek}`;

      // Process paid attendance updates
      const paidClasses = unloggedLogs.filter(log => 
        !log.class.includes('FREE') && !log.class.includes('TRIAL')
      );

      if (paidClasses.length > 0) {
        const attendanceUpdates = paidClasses.map(log => ({
          customer_id: log.customer_id,
          class_name: log.class,
          role: log.role || '',
          [weekColumn]: true
        }));

        for (const update of attendanceUpdates) {
          const { error: updateError } = await supabase
            .from('paid_attendance')
            .update({ [weekColumn]: update[weekColumn] })
            .eq('customer_id', update.customer_id)
            .eq('class_name', update.class_name)
            .eq('role', update.role);

          if (updateError) {
            console.error('Error updating paid attendance:', updateError);
          }
        }
      }

      // Process free attendance updates
      const freeClasses = unloggedLogs.filter(log => 
        log.class.includes('FREE') || log.class.includes('TRIAL')
      );

      if (freeClasses.length > 0) {
        for (const log of freeClasses) {
          const classDateMatch = log.class.match(/\(([^)]+)\)/);
          if (classDateMatch) {
            const classDate = classDateMatch[1];
            
            const { error: updateError } = await supabase
              .from('free_attendance')
              .update({ attended: true })
              .eq('customer_id', log.customer_id)
              .eq('class_date', classDate)
              .eq('role', log.role || '');

            if (updateError) {
              console.error('Error updating free attendance:', updateError);
            }
          }
        }
      }

      // Mark all logs as logged in database
      const { error: logError } = await supabase
        .from('log')
        .update({ logged: true })
        .in('id', allUnloggedIds);

      if (logError) {
        console.error('Error marking logs as logged:', logError);
        // Revert on error
        setLogs(prevLogs => 
          prevLogs.map(log => 
            allUnloggedIds.includes(log.id) ? { ...log, logged: false } : log
          )
        );
        setMessage('Failed to update log status');
        return;
      }

      setMessage(`Successfully logged all ${allUnloggedIds.length} records and updated attendance`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error logging all records:', err);
      setMessage('Failed to log all records');
    }
  }

  // Filter logs based on search
  const filteredLogs = logs.filter((log) => {
    const searchStr = `${log.first_name} ${log.last_name} ${log.class} ${log.role || ''} ${log.notes || ''}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  // Separate unlogged and logged entries
  const unloggedEntries = filteredLogs.filter(log => !log.logged);
  const loggedEntries = filteredLogs.filter(log => log.logged);

  // Format date/time for display
  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Custom DataTable wrapper with glass UI
  function LogDataTable({ headers, entries, isLogged = false }) {
    return (
      <div className="overflow-x-auto" style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th 
                  key={idx} 
                  style={{
                    textAlign: 'left',
                    padding: '1.2rem 1.5rem',
                    color: 'var(--text-muted)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontSize: '0.85rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    width: header === 'Name' ? '200px' :
                           header === 'Class' ? '160px' :
                           header === 'Role' ? '100px' :
                           header === 'Time' ? '100px' :
                           header === 'Notes' ? '160px' : 'auto'
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{
            transition: 'all 0.5s ease'
          }}>
            {entries.map((log, rowIdx) => {
              const isSelected = !isLogged && selectedRows.has(log.id);
              const isRecentlyLogged = isLogged && recentlyLogged.has(log.id);
              
              return (
                <tr 
                  key={log.id}
                  onClick={!isLogged ? () => toggleRowSelection(log.id) : undefined}
                  style={{
                    transition: 'all 0.3s ease',
                    cursor: !isLogged ? 'pointer' : 'default',
                    background: isLogged 
                      ? (isRecentlyLogged ? 'rgba(78, 205, 196, 0.1)' : 'transparent')
                      : (isSelected ? 'rgba(78, 205, 196, 0.15)' : 'transparent'),
                    borderLeft: isSelected && !isLogged ? '3px solid var(--success)' : 'none',
                    paddingLeft: isSelected && !isLogged ? 'calc(1.5rem - 3px)' : '1.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLogged && !isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLogged && !isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <td style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {`${log.first_name || ''} ${log.last_name || ''}`.trim() || 'Unknown'}
                  </td>
                  <td style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {log.class || '-'}
                  </td>
                  <td style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {log.role || '-'}
                  </td>
                  <td style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {formatDateTime(log.date_time)}
                  </td>
                  <td style={{
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={log.notes || ''}>
                    {log.notes || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: '4rem 0' }}>
      {/* Search and Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '2rem',
        marginBottom: '3rem'
      }}>
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '1rem 1.5rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '14px',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            outline: 'none',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            transition: 'all 0.3s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.background = 'var(--glass-hover)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--glass-border)';
            e.target.style.background = 'var(--glass-bg)';
          }}
        />
        <button
          onClick={fetchLogs}
          style={{
            padding: '1rem 1.5rem',
            background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
            color: 'white',
            borderRadius: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(232, 93, 47, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Refresh
        </button>
      </div>
      
      {/* Message Display */}
      {message && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.5rem',
          borderRadius: '14px',
          background: message.includes('Failed') 
            ? 'rgba(232, 93, 47, 0.1)' 
            : 'rgba(78, 205, 196, 0.1)',
          border: `1px solid ${message.includes('Failed') 
            ? 'rgba(232, 93, 47, 0.3)' 
            : 'rgba(78, 205, 196, 0.3)'}`,
          color: message.includes('Failed') 
            ? 'var(--accent-warm)' 
            : 'var(--success)'
        }}>
          {message}
        </div>
      )}
      
      {/* Unlogged entries */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Unlogged Check-ins ({unloggedEntries.length})
          </h2>
          <div className="log-buttons" style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={logSelectedRows}
              disabled={loading || selectedRows.size === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: selectedRows.size === 0 
                  ? 'var(--glass-bg)' 
                  : 'rgba(78, 205, 196, 0.2)',
                color: selectedRows.size === 0 ? 'var(--text-secondary)' : 'var(--success)',
                borderRadius: '14px',
                fontWeight: '600',
                cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                border: selectedRows.size === 0 
                  ? '1px solid var(--glass-border)' 
                  : '1px solid rgba(78, 205, 196, 0.4)',
                opacity: selectedRows.size === 0 ? 0.7 : 1,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}
              onMouseEnter={(e) => {
                if (selectedRows.size > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(78, 205, 196, 0.3)';
                  e.currentTarget.style.background = 'rgba(78, 205, 196, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRows.size > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = 'rgba(78, 205, 196, 0.2)';
                }
              }}
            >
              Log Selected ({selectedRows.size})
            </button>
            <button
              onClick={logAllUnlogged}
              disabled={loading || unloggedEntries.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: unloggedEntries.length === 0 
                  ? 'var(--glass-bg)' 
                  : 'rgba(232, 93, 47, 0.2)',
                color: unloggedEntries.length === 0 ? 'var(--text-secondary)' : 'var(--accent-warm)',
                borderRadius: '14px',
                fontWeight: '600',
                cursor: unloggedEntries.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                border: unloggedEntries.length === 0 
                  ? '1px solid var(--glass-border)' 
                  : '1px solid rgba(232, 93, 47, 0.4)',
                opacity: unloggedEntries.length === 0 ? 0.7 : 1,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}
              onMouseEnter={(e) => {
                if (unloggedEntries.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(232, 93, 47, 0.3)';
                  e.currentTarget.style.background = 'rgba(232, 93, 47, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (unloggedEntries.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = 'rgba(232, 93, 47, 0.2)';
                }
              }}
            >
              Log All ({unloggedEntries.length})
            </button>
          </div>
        </div>
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '28px',
          padding: '1.5rem 3rem 3rem 3rem',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '200px',
          transition: 'all 0.5s ease'
        }}>
          <div style={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--accent-warm), var(--accent-gold), var(--accent-coral), var(--accent-teal))'
          }}></div>
          <LogDataTable 
            headers={['Name', 'Class', 'Role', 'Time', 'Notes']} 
            entries={unloggedEntries}
            isLogged={false}
          />
        </div>
      </div>
      
      {/* Logged entries */}
      <div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, var(--success) 0%, var(--accent-teal) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Logged Check-ins ({loggedEntries.length})
        </h2>
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '28px',
          padding: '1.5rem 3rem 3rem 3rem',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '200px',
          transition: 'all 0.5s ease'
        }}>
          <div style={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--success), var(--accent-teal), var(--accent-gold))'
          }}></div>
          <LogDataTable 
            headers={['Name', 'Class', 'Role', 'Time', 'Notes']} 
            entries={loggedEntries}
            isLogged={true}
          />
        </div>
      </div>
    </div>
  );
}

export default Log;