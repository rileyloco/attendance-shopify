import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';

function Attendance() {
  const classes = ['Free', 'Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines'];
  const [selectedClass, setSelectedClass] = useState('Level 1');
  const [selectedFreeDate, setSelectedFreeDate] = useState('current');
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Calculate free class dates (always Tuesdays)
  function getFreeclassDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7 || 7; // Next Tuesday
    
    const nextTuesday = new Date(today);
    nextTuesday.setDate(today.getDate() + daysUntilTuesday);
    
    const currentTuesday = new Date(nextTuesday);
    currentTuesday.setDate(nextTuesday.getDate() - 7);
    
    const previousTuesday = new Date(currentTuesday);
    previousTuesday.setDate(currentTuesday.getDate() - 7);
    
    return {
      previous: {
        date: previousTuesday,
        label: `Previous (${previousTuesday.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })})`
      },
      current: {
        date: currentTuesday,
        label: `Current (${currentTuesday.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })})`
      },
      next: {
        date: nextTuesday,
        label: `Next (${nextTuesday.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })})`
      }
    };
  }

  const freeClassDates = getFreeclassDates();

  async function fetchAttendance() {
    setLoading(true);
    try {
      if (selectedClass === 'Free') {
        // Fetch free attendance
        const selectedDate = freeClassDates[selectedFreeDate].date;
        // Format as YYYY-MM-DD for database query
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        console.log('Fetching free attendance for date:', dateStr);
        
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from('free_attendance')
          .select('*')
          .eq('class_date', dateStr);

        if (attendanceError) {
          console.error('Error fetching free attendance:', attendanceError);
          setAttendanceData([]);
          return;
        }

        // Fetch customer details
        if (attendanceRecords && attendanceRecords.length > 0) {
          const customerIds = [...new Set(attendanceRecords.map(r => r.customer_id))];
          
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('customer_id, first_name, last_name')
            .in('customer_id', customerIds);

          if (customerError) {
            console.error('Error fetching customers:', customerError);
          }

          // Create a map for quick lookup
          const customerMap = (customers || []).reduce((acc, customer) => {
            acc[customer.customer_id] = customer;
            return acc;
          }, {});

          // Combine the data
          const combinedData = attendanceRecords.map(record => ({
            ...record,
            customer: customerMap[record.customer_id] || null
          }));

          console.log('Free attendance data:', combinedData);
          setAttendanceData(combinedData);
        } else {
          setAttendanceData([]);
        }
      } else {
        // Fetch paid attendance
        console.log('Fetching attendance for class:', selectedClass);
        
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from('paid_attendance')
          .select('*')
          .ilike('class_name', selectedClass);

        if (attendanceError) {
          console.error('Error fetching attendance:', attendanceError);
          setAttendanceData([]);
          return;
        }

        // Fetch customer details
        if (attendanceRecords && attendanceRecords.length > 0) {
          const customerIds = [...new Set(attendanceRecords.map(r => r.customer_id))];
          
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('customer_id, first_name, last_name')
            .in('customer_id', customerIds);

          if (customerError) {
            console.error('Error fetching customers:', customerError);
          }

          // Create a map for quick lookup
          const customerMap = (customers || []).reduce((acc, customer) => {
            acc[customer.customer_id] = customer;
            return acc;
          }, {});

          // Combine the data
          const combinedData = attendanceRecords.map(record => ({
            ...record,
            customer: customerMap[record.customer_id] || null
          }));

          console.log('Combined data:', combinedData);
          setAttendanceData(combinedData);
        } else {
          setAttendanceData([]);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch attendance across all classes for search
  async function fetchSearchResults() {
    setLoading(true);
    try {
      // First get customers that match the search
      const { data: matchingCustomers, error: customerError } = await supabase
        .from('customers')
        .select('customer_id, first_name, last_name')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

      if (customerError || !matchingCustomers || matchingCustomers.length === 0) {
        console.error('No matching customers found');
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      const customerIds = matchingCustomers.map(c => c.customer_id);
      const customerMap = matchingCustomers.reduce((acc, c) => {
        acc[c.customer_id] = c;
        return acc;
      }, {});

      // Fetch paid attendance for these customers
      const { data: paidRecords, error: paidError } = await supabase
        .from('paid_attendance')
        .select('*')
        .in('customer_id', customerIds);

      if (paidError) {
        console.error('Error searching paid attendance:', paidError);
      }

      // Fetch free attendance for these customers
      const { data: freeRecords, error: freeError } = await supabase
        .from('free_attendance')
        .select('*')
        .in('customer_id', customerIds);

      if (freeError) {
        console.error('Error searching free attendance:', freeError);
      }

      // Combine and format results
      const allResults = [];
      
      // Add paid records
      (paidRecords || []).forEach(record => {
        allResults.push({
          ...record,
          type: 'paid',
          displayClass: record.class_name,
          customer: customerMap[record.customer_id]
        });
      });

      // Add free records
      (freeRecords || []).forEach(record => {
        allResults.push({
          ...record,
          type: 'free',
          displayClass: `Free (${record.class_date})`,
          customer: customerMap[record.customer_id]
        });
      });

      // Sort by customer name, then class
      allResults.sort((a, b) => {
        const nameA = `${a.customer?.first_name || ''} ${a.customer?.last_name || ''}`;
        const nameB = `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`;
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.displayClass.localeCompare(b.displayClass);
      });

      setAttendanceData(allResults);
    } catch (err) {
      console.error('Search error:', err);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (search.length >= 2) {
      fetchSearchResults();
    } else if (!search && selectedClass) {
      fetchAttendance();
    }
  }, [search, selectedClass, selectedFreeDate]);

  // Handle checkbox changes for paid attendance - optimistic update
  async function handleAttendanceChange(rowId, weekNum, checked) {
    const weekColumn = `week_${weekNum}`;
    
    // Update local state immediately (optimistic update)
    setAttendanceData(prev =>
      prev.map(row =>
        row.id === rowId ? { ...row, [weekColumn]: checked } : row
      )
    );

    // Update database in background
    try {
      const { error } = await supabase
        .from('paid_attendance')
        .update({ [weekColumn]: checked })
        .eq('id', rowId);

      if (error) {
        console.error('Error updating attendance:', error);
        // Revert on error
        setAttendanceData(prev =>
          prev.map(row =>
            row.id === rowId ? { ...row, [weekColumn]: !checked } : row
          )
        );
        alert('Failed to update attendance');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      // Revert on error
      setAttendanceData(prev =>
        prev.map(row =>
          row.id === rowId ? { ...row, [weekColumn]: !checked } : row
        )
      );
      alert('Failed to update attendance');
    }
  }

  // Handle checkbox change for free attendance - optimistic update
  async function handleFreeAttendanceChange(rowId, checked) {
    // Update local state immediately (optimistic update)
    setAttendanceData(prev =>
      prev.map(row =>
        row.id === rowId ? { ...row, attended: checked } : row
      )
    );

    // Update database in background
    try {
      const { error } = await supabase
        .from('free_attendance')
        .update({ attended: checked })
        .eq('id', rowId);

      if (error) {
        console.error('Error updating free attendance:', error);
        // Revert on error
        setAttendanceData(prev =>
          prev.map(row =>
            row.id === rowId ? { ...row, attended: !checked } : row
          )
        );
        alert('Failed to update attendance');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      // Revert on error
      setAttendanceData(prev =>
        prev.map(row =>
          row.id === rowId ? { ...row, attended: !checked } : row
        )
      );
      alert('Failed to update attendance');
    }
  }

  // Prepare table data
  const headers = search.length >= 2
    ? ['Name', 'Class', 'Role', 'Attendance', 'Notes']
    : selectedClass === 'Free' 
      ? ['Name', 'Role', 'Attended', 'Notes']
      : ['Name', 'Role', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Notes'];
  
  const rows = attendanceData.map(row => {
    const name = row.customer 
      ? `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim()
      : `Customer ${row.customer_id}`;
    
    if (search.length >= 2) {
      // Search results view
      if (row.type === 'free') {
        return [
          name || 'Unknown',
          row.displayClass,
          row.role || '-',
          <input
            key={`${row.id}-attended`}
            type="checkbox"
            checked={row.attended || false}
            onChange={(e) => handleFreeAttendanceChange(row.id, e.target.checked)}
            style={{
              width: '22px',
              height: '22px',
              accentColor: 'var(--accent-warm)'
            }}
          />,
          '-'
        ];
      } else {
        // Paid attendance in search
        return [
          name || 'Unknown',
          row.displayClass,
          row.role || '-',
          <div key={`${row.id}-weeks`} style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map(week => (
              <input
                key={`${row.id}-${week}`}
                type="checkbox"
                checked={row[`week_${week}`] || false}
                onChange={(e) => handleAttendanceChange(row.id, week, e.target.checked)}
                style={{
                  width: '22px',
                  height: '22px',
                  accentColor: 'var(--accent-warm)'
                }}
                title={`Week ${week}`}
              />
            ))}
          </div>,
          row.notes || '-'
        ];
      }
    } else if (selectedClass === 'Free') {
      return [
        name || 'Unknown',
        row.role || '-',
        <input
          key={`${row.id}-attended`}
          type="checkbox"
          checked={row.attended || false}
          onChange={(e) => handleFreeAttendanceChange(row.id, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        '-'
      ];
    } else {
      return [
        name || 'Unknown',
        row.role || '-',
        <input
          key={`${row.id}-1`}
          type="checkbox"
          checked={row.week_1 || false}
          onChange={(e) => handleAttendanceChange(row.id, 1, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        <input
          key={`${row.id}-2`}
          type="checkbox"
          checked={row.week_2 || false}
          onChange={(e) => handleAttendanceChange(row.id, 2, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        <input
          key={`${row.id}-3`}
          type="checkbox"
          checked={row.week_3 || false}
          onChange={(e) => handleAttendanceChange(row.id, 3, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        <input
          key={`${row.id}-4`}
          type="checkbox"
          checked={row.week_4 || false}
          onChange={(e) => handleAttendanceChange(row.id, 4, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        <input
          key={`${row.id}-5`}
          type="checkbox"
          checked={row.week_5 || false}
          onChange={(e) => handleAttendanceChange(row.id, 5, e.target.checked)}
          style={{
            width: '22px',
            height: '22px',
            accentColor: 'var(--accent-warm)'
          }}
        />,
        row.notes || '-'
      ];
    }
  });

  return (
    <div style={{ padding: '4rem 0' }}>
      {/* Page Title */}
      <h1 style={{
        fontSize: '2.5rem',
        fontWeight: '700',
        marginBottom: '3rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        Attendance
      </h1>
      
      {/* Search Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
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
      </div>
      
      {/* Class Selection */}
      {search.length < 2 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '3rem',
          alignItems: 'center'
        }}>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '14px',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.background = 'var(--glass-hover)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--glass-border)';
              e.target.style.background = 'var(--glass-bg)';
            }}
          >
            {classes.map((cls) => (
              <option key={cls} value={cls} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                {cls}
              </option>
            ))}
          </select>

          {selectedClass === 'Free' && (
            <select
              value={selectedFreeDate}
              onChange={(e) => setSelectedFreeDate(e.target.value)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '14px',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.target.style.background = 'var(--glass-hover)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'var(--glass-border)';
                e.target.style.background = 'var(--glass-bg)';
              }}
            >
              <option value="previous" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{freeClassDates.previous.label}</option>
              <option value="current" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{freeClassDates.current.label}</option>
              <option value="next" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{freeClassDates.next.label}</option>
            </select>
          )}
        </div>
      )}

      {/* Table Section */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          color: 'var(--text-secondary)',
          fontSize: '1.1rem'
        }}>
          Loading attendance data...
        </div>
      ) : rows.length > 0 ? (
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '28px',
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden'
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
          <DataTable headers={headers} rows={rows} />
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          color: 'var(--text-secondary)',
          fontSize: '1.1rem'
        }}>
          {search.length >= 2 
            ? 'No attendance records found for this search.'
            : selectedClass === 'Free' 
              ? `No attendance records found for ${freeClassDates[selectedFreeDate].label}.`
              : `No attendance records found for ${selectedClass}.`
          }
        </div>
      )}
    </div>
  );
}

export default Attendance;