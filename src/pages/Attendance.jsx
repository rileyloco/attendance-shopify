import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';

function Attendance() {
  const classes = ['Free', 'Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines', 'Socials'];
  const [selectedClass, setSelectedClass] = useState('Level 1');
  const [selectedFreeDate, setSelectedFreeDate] = useState('current');
  const [selectedSocialEvent, setSelectedSocialEvent] = useState('');
  const [socialEvents, setSocialEvents] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [ticketCounts, setTicketCounts] = useState(new Map()); // Map of orderId -> number of tickets checked
  const [sortField, setSortField] = useState('name'); // 'name' or 'order'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [statusMessage, setStatusMessage] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [guestFilter, setGuestFilter] = useState('paid'); // 'paid' or 'special'

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

  // Fetch available social events
  async function fetchSocialEvents() {
    try {
      const { data, error } = await supabase
        .from('social_attendance')
        .select('social_name, social_date')
        .order('social_date', { ascending: false });

      if (error) {
        console.error('Error fetching social events:', error);
        return;
      }

      // Get unique social events
      const uniqueEvents = [];
      const seen = new Set();
      
      data.forEach(item => {
        const key = `${item.social_name}-${item.social_date}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEvents.push({
            name: item.social_name,
            date: item.social_date
          });
        }
      });

      setSocialEvents(uniqueEvents);
      
      // Set default selection to first event
      if (uniqueEvents.length > 0 && !selectedSocialEvent) {
        setSelectedSocialEvent(`${uniqueEvents[0].name}-${uniqueEvents[0].date}`);
      }
    } catch (err) {
      console.error('Error fetching social events:', err);
    }
  }

  async function fetchAttendance() {
    setLoading(true);
    try {
      if (selectedClass === 'Free') {
        // Fetch free attendance
        const selectedDate = freeClassDates[selectedFreeDate].date;
        // Format as YYYY-MM-DD for database query using local date
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
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
      } else if (selectedClass === 'Socials') {
        // Fetch social events attendance
        console.log('Fetching social events attendance');
        
        if (!selectedSocialEvent) {
          setAttendanceData([]);
          setCompletedData([]);
          return;
        }
        
        // Extract the date from the selectedSocialEvent
        // Format is "Event Name-YYYY-MM-DD", so we need to extract the last part
        const parts = selectedSocialEvent.split('-');
        const eventDate = parts.slice(-3).join('-'); // Get last 3 parts: YYYY-MM-DD
        
        console.log('Fetching social attendance for date:', eventDate);
        
        const { data: socialAttendance, error: socialError } = await supabase
          .from('social_attendance')
          .select('*')
          .eq('social_date', eventDate)
          .eq('special_guest', guestFilter === 'special')
          .order('customer_name');
        
        if (socialError) {
          console.error('Error fetching social attendance:', socialError);
          setAttendanceData([]);
          setCompletedData([]);
          return;
        }
        
        // Separate into unused and fully used
        const unused = socialAttendance.filter(record => record.tickets_used < record.total_tickets);
        const completed = socialAttendance.filter(record => record.tickets_used >= record.total_tickets);
        
        setAttendanceData(unused);
        setCompletedData(completed);
        
        // Initialize ticket counts with current tickets_used values
        const initialCounts = new Map();
        [...unused, ...completed].forEach(order => {
          initialCounts.set(order.id, order.tickets_used);
        });
        setTicketCounts(initialCounts);
        
        console.log(`Fetched ${unused.length} active and ${completed.length} completed social attendances`);
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
      if (selectedClass === 'Socials') {
        // Search social attendance directly by name
        console.log('Searching social attendance for:', search);
        
        const { data: socialAttendance, error: socialError } = await supabase
          .from('social_attendance')
          .select('*')
          .ilike('customer_name', `%${search}%`)
          .order('customer_name');
        
        if (socialError) {
          console.error('Error searching social attendance:', socialError);
          setAttendanceData([]);
          setCompletedData([]);
          return;
        }
        
        // Separate into unused and fully used
        const unused = socialAttendance.filter(record => record.tickets_used < record.total_tickets);
        const completed = socialAttendance.filter(record => record.tickets_used >= record.total_tickets);
        
        setAttendanceData(unused);
        setCompletedData(completed);
        
        // Initialize ticket counts
        const initialCounts = new Map();
        [...unused, ...completed].forEach(order => {
          initialCounts.set(order.id, order.tickets_used);
        });
        setTicketCounts(initialCounts);
      } else {
        // Original search logic for other classes
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
      }
    } catch (err) {
      console.error('Search error:', err);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  }

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedClass === 'Socials') {
      fetchSocialEvents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (search.length >= 2) {
      fetchSearchResults();
    } else if (!search && selectedClass) {
      fetchAttendance();
    }
  }, [search, selectedClass, selectedFreeDate, selectedSocialEvent, selectedClass === 'Socials' ? guestFilter : null]);

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

  // Handle ticket check for social events (just update count)
  function handleSocialTicketCheck(orderId, checked, maxTickets) {
    setTicketCounts(prev => {
      const newMap = new Map(prev);
      const currentCount = newMap.get(orderId) || 0;
      
      if (checked) {
        // Increase count (but not beyond total tickets)
        newMap.set(orderId, Math.min(currentCount + 1, maxTickets));
      } else {
        // Decrease count (but not below 0)
        newMap.set(orderId, Math.max(currentCount - 1, 0));
      }
      
      return newMap;
    });
  }

  // Check in selected tickets
  async function checkInSelectedTickets() {
    const updates = [];
    const ordersToMoveToCompleted = [];
    const ordersToMoveToActive = [];
    
    // Process all orders (both active and completed)
    const allOrders = [...attendanceData, ...completedData];
    
    for (const order of allOrders) {
      const newTicketsUsed = ticketCounts.get(order.id) || 0;
      
      // Only update if there's a change
      if (newTicketsUsed !== order.tickets_used) {
        updates.push({
          id: order.id,
          tickets_used: newTicketsUsed,
          order: order
        });
        
        // Determine if order should move between sections
        if (newTicketsUsed >= order.total_tickets && order.tickets_used < order.total_tickets) {
          // Moving from active to completed
          ordersToMoveToCompleted.push({...order, tickets_used: newTicketsUsed});
        } else if (newTicketsUsed < order.total_tickets && order.tickets_used >= order.total_tickets) {
          // Moving from completed back to active
          ordersToMoveToActive.push({...order, tickets_used: newTicketsUsed});
        }
      }
    }
    
    if (updates.length === 0) {
      setStatusMessage('No changes to process');
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
      return;
    }
    
    setLoading(true);
    
    try {
      // Update all orders in database
      for (const update of updates) {
        const { error } = await supabase
          .from('social_attendance')
          .update({ tickets_used: update.tickets_used })
          .eq('id', update.id);
        
        if (error) {
          console.error('Error updating ticket:', error);
          setStatusMessage('Failed to update some tickets');
          setShowStatus(true);
          setTimeout(() => setShowStatus(false), 3000);
          setLoading(false);
          return;
        }
      }
      
      // Update local state
      setAttendanceData(prev => {
        // Update existing records
        let updated = prev.map(order => {
          const update = updates.find(u => u.id === order.id);
          return update ? {...order, tickets_used: update.tickets_used} : order;
        });
        
        // Remove orders moving to completed
        updated = updated.filter(order => {
          return !ordersToMoveToCompleted.find(o => o.id === order.id);
        });
        
        // Add orders coming from completed
        return [...updated, ...ordersToMoveToActive];
      });
      
      setCompletedData(prev => {
        // Update existing records
        let updated = prev.map(order => {
          const update = updates.find(u => u.id === order.id);
          return update ? {...order, tickets_used: update.tickets_used} : order;
        });
        
        // Remove orders moving to active
        updated = updated.filter(order => {
          return !ordersToMoveToActive.find(o => o.id === order.id);
        });
        
        // Add orders coming from active
        return [...updated, ...ordersToMoveToCompleted];
      });
      
      // Update ticket counts to reflect new values
      const newCounts = new Map();
      [...attendanceData, ...completedData].forEach(order => {
        const update = updates.find(u => u.id === order.id);
        newCounts.set(order.id, update ? update.tickets_used : order.tickets_used);
      });
      setTicketCounts(newCounts);
      
      // Collapse all expanded rows
      setExpandedOrders(new Set());
      
      // Show success message
      setStatusMessage(`Successfully processed ${updates.length} order${updates.length === 1 ? '' : 's'}`);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 4000);
    } catch (err) {
      console.error('Error during check-in:', err);
      setStatusMessage('Failed to complete check-in');
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  // Handle free attendance checkbox toggle - optimistic update
  async function handleFreeAttendanceChange(rowId, spotIndex, checked) {
    // Find the current row
    const currentRow = attendanceData.find(row => row.id === rowId);
    if (!currentRow) return;

    // Calculate new spots_used value
    const currentSpots = currentRow.spots_used || 0;
    const newSpotsUsed = checked 
      ? currentSpots + 1
      : currentSpots - 1;

    // Update local state immediately (optimistic update)
    setAttendanceData(prev =>
      prev.map(row =>
        row.id === rowId ? { ...row, spots_used: newSpotsUsed } : row
      )
    );

    // Update database in background
    try {
      const { error } = await supabase
        .from('free_attendance')
        .update({ spots_used: newSpotsUsed })
        .eq('id', rowId);

      if (error) {
        console.error('Error updating free attendance:', error);
        // Revert on error
        setAttendanceData(prev =>
          prev.map(row =>
            row.id === rowId ? { ...row, spots_used: currentRow.spots_used || 0 } : row
          )
        );
        alert('Failed to update attendance');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      // Revert on error
      setAttendanceData(prev =>
        prev.map(row =>
          row.id === rowId ? { ...row, spots_used: currentRow.spots_used || 0 } : row
        )
      );
      alert('Failed to update attendance');
    }
  }

  // Sort data function
  function sortData(data) {
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      if (sortField === 'name') {
        aValue = a.customer_name || '';
        bValue = b.customer_name || '';
      } else if (sortField === 'order') {
        aValue = a.order_number || '';
        bValue = b.order_number || '';
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  // Handle header click for sorting
  function handleHeaderClick(field) {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Render social attendance table
  function renderSocialAttendanceTable(data) {
    if (!data || data.length === 0) {
      return <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No orders found</p>;
    }
    
    const sortedData = sortData(data);
    
    // Check if mobile
    const isMobile = windowWidth <= 768;
    
    if (isMobile) {
      // Mobile card view
      return (
        <div className="mobile-cards">
          {sortedData.map(order => {
            const isExpanded = expandedOrders.has(order.id);
            const currentTicketCount = ticketCounts.get(order.id) || 0;
            
            return (
              <div key={order.id} className="mobile-card" style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1rem',
                marginBottom: '1rem',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}>
                {/* Main order info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}>{guestFilter === 'special' ? order.customer_name : `Order #${order.order_number}`}</span>
                  <input
                    type="checkbox"
                    checked={currentTicketCount === order.total_tickets}
                    indeterminate={currentTicketCount > 0 && currentTicketCount < order.total_tickets}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = currentTicketCount > 0 && currentTicketCount < order.total_tickets;
                      }
                    }}
                    onChange={(e) => {
                      const newCount = currentTicketCount < order.total_tickets ? order.total_tickets : 0;
                      setTicketCounts(prev => {
                        const newMap = new Map(prev);
                        newMap.set(order.id, newCount);
                        return newMap;
                      });
                      
                      if (order.total_tickets > 1) {
                        setExpandedOrders(prev => {
                          const newExpanded = new Set(prev);
                          if (currentTicketCount < order.total_tickets && newCount === order.total_tickets) {
                            // Was partial, now all checked - expand to show all selected
                            newExpanded.add(order.id);
                          }
                          // Removed auto-collapse logic
                          return newExpanded;
                        });
                      }
                    }}
                    style={{
                      width: '22px',
                      height: '22px',
                      accentColor: 'var(--accent-warm)',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                
                {/* Customer name - only show for paid guests */}
                {guestFilter !== 'special' && (
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>{order.customer_name}</div>
                )}
                
                {/* Tickets info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.875rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Tickets: {currentTicketCount}/{order.total_tickets}
                  </span>
                  {order.total_tickets > 1 && (
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedOrders);
                        if (isExpanded) {
                          newExpanded.delete(order.id);
                        } else {
                          newExpanded.add(order.id);
                        }
                        setExpandedOrders(newExpanded);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '0.25rem 0.5rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isExpanded ? 'Hide' : 'Show'} Tickets
                    </button>
                  )}
                </div>
                
                {/* Expanded tickets */}
                {isExpanded && order.total_tickets > 1 && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {Array.from({ length: order.total_tickets }, (_, ticketIndex) => {
                      const isChecked = ticketIndex < currentTicketCount;
                      return (
                        <div key={ticketIndex} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.25rem 0'
                        }}>
                          <span style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)'
                          }}>Ticket {ticketIndex + 1}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newCount = e.target.checked 
                                ? Math.max(currentTicketCount, ticketIndex + 1)
                                : ticketIndex;
                              
                              setTicketCounts(prev => {
                                const newMap = new Map(prev);
                                newMap.set(order.id, newCount);
                                return newMap;
                              });
                              
                              // Removed auto-collapse when all tickets are checked
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              accentColor: 'var(--accent-warm)'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    // Desktop table view
    return (
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed'
      }}>
        <thead>
          <tr>
            <th style={{
              width: '40px',
              padding: '0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: '600',
              color: 'var(--accent-warm)',
              whiteSpace: 'nowrap'
            }}></th>
            {guestFilter !== 'special' && (
              <th style={{
                width: '80px',
                padding: '0.75rem',
                textAlign: 'left',
                borderBottom: '1px solid var(--glass-border)',
                fontWeight: '600',
                color: 'var(--accent-warm)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => handleHeaderClick('order')}>Order #</th>
            )}
            <th style={{
              width: '40%',
              padding: '0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: '600',
              color: 'var(--accent-warm)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => handleHeaderClick('name')}>Name</th>
            <th style={{
              display: 'none'
            }}>Email</th>
            <th style={{
              width: '60px',
              padding: '0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: '600',
              color: 'var(--accent-warm)',
              whiteSpace: 'nowrap'
            }}>Tickets</th>
            <th style={{
              width: '50px',
              padding: '0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: '600',
              color: 'var(--accent-warm)',
              whiteSpace: 'nowrap'
            }}>Used</th>
            <th style={{
              width: '50px',
              padding: '0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: '600',
              color: 'var(--accent-warm)',
              whiteSpace: 'nowrap'
            }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map(order => {
            const isExpanded = expandedOrders.has(order.id);
            const currentTicketCount = ticketCounts.get(order.id) || 0;
            
            return (
              <React.Fragment key={order.id}>
                <tr 
                  style={{ 
                    transition: 'all 0.3s ease',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                  <td style={{ padding: '1rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
                    {order.total_tickets > 1 && (
                      <div
                        onClick={() => {
                          const newExpanded = new Set(expandedOrders);
                          if (isExpanded) {
                            newExpanded.delete(order.id);
                          } else {
                            newExpanded.add(order.id);
                          }
                          setExpandedOrders(newExpanded);
                        }}
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          style={{
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        >
                          <path 
                            d="M9 6L15 12L9 18" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </td>
                  {guestFilter !== 'special' && (
                    <td style={{ padding: '1rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
                      {order.order_number}
                    </td>
                  )}
                  <td style={{ 
                    padding: '1rem 0.75rem', 
                    borderBottom: '1px solid var(--glass-border)', 
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 0,
                    fontWeight: '500'
                  }}>
                    {order.customer_name}
                  </td>
                  <td style={{ 
                    display: 'none'
                  }}>
                    {order.customer_email}
                  </td>
                  <td style={{ 
                    padding: '1rem 0.75rem', 
                    borderBottom: '1px solid var(--glass-border)', 
                    whiteSpace: 'nowrap',
                    textAlign: 'center'
                  }}>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      {order.total_tickets}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '1rem 0.75rem', 
                    borderBottom: '1px solid var(--glass-border)', 
                    whiteSpace: 'nowrap',
                    textAlign: 'center'
                  }}>
                    <span style={{
                      background: currentTicketCount > 0 ? 'rgba(94, 188, 126, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: currentTicketCount > 0 ? '#5ebc7e' : 'var(--text-primary)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}>
                      {currentTicketCount}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
                    {/* Show checkbox for all orders */}
                    <input
                      type="checkbox"
                      checked={currentTicketCount === order.total_tickets}
                      indeterminate={currentTicketCount > 0 && currentTicketCount < order.total_tickets}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = currentTicketCount > 0 && currentTicketCount < order.total_tickets;
                        }
                      }}
                      onChange={(e) => {
                        // If less than all are checked, check all. If all are checked, uncheck all.
                        const newCount = currentTicketCount < order.total_tickets ? order.total_tickets : 0;
                        setTicketCounts(prev => {
                          const newMap = new Map(prev);
                          newMap.set(order.id, newCount);
                          return newMap;
                        });
                        
                        // Auto expand based on new state
                        if (order.total_tickets > 1) {
                          setExpandedOrders(prev => {
                            const newExpanded = new Set(prev);
                            if (currentTicketCount < order.total_tickets && newCount === order.total_tickets) {
                              // Was partial, now all checked - expand to show all selected
                              newExpanded.add(order.id);
                            }
                            // Removed auto-collapse logic
                            return newExpanded;
                          });
                        }
                      }}
                      style={{
                        width: '22px',
                        height: '22px',
                        accentColor: 'var(--accent-warm)',
                        cursor: 'pointer'
                      }}
                    />
                  </td>
                </tr>
                {isExpanded && order.total_tickets > 1 && (
                  Array.from({ length: order.total_tickets }, (_, ticketIndex) => {
                    // Check if this ticket is checked (first N tickets where N = currentTicketCount)
                    const isChecked = ticketIndex < currentTicketCount;
                    
                    return (
                      <tr 
                        key={`${order.id}-ticket-${ticketIndex}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.01)',
                          transition: 'all 0.3s ease',
                          borderLeft: '2px solid rgba(255, 255, 255, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                        }}>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}></td>
                        {guestFilter !== 'special' && (
                          <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}></td>
                        )}
                        <td style={{ 
                          padding: '0.5rem 0.75rem', 
                          paddingLeft: '2rem',
                          borderBottom: '1px solid var(--glass-border)', 
                          color: 'var(--text-secondary)', 
                          whiteSpace: 'nowrap',
                          fontSize: '0.9rem'
                        }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isChecked ? '#5ebc7e' : 'rgba(255, 255, 255, 0.3)'
                            }}></span>
                            Ticket {ticketIndex + 1}
                          </span>
                        </td>
                        <td style={{ display: 'none' }}></td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}></td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}></td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              // Calculate new count based on this checkbox change
                              const newCount = e.target.checked 
                                ? Math.max(currentTicketCount, ticketIndex + 1)
                                : ticketIndex;
                              
                              // Update to new count
                              setTicketCounts(prev => {
                                const newMap = new Map(prev);
                                newMap.set(order.id, newCount);
                                return newMap;
                              });
                              
                              // Auto collapse if all tickets are now checked
                              // Removed auto-collapse when all tickets are checked
                            }}
                            style={{
                              width: '22px',
                              height: '22px',
                              accentColor: 'var(--accent-warm)',
                              cursor: 'pointer'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  // Prepare table data - Use W1, W2, etc. instead of "Week 1" to prevent wrapping
  const headers = search.length >= 2
    ? ['Name', 'Class', 'Role', 'Attendance', 'Notes']
    : selectedClass === 'Free' 
      ? ['Name', 'Role', 'Attended', 'Notes']
      : ['Name', 'Role', 'W1', 'W2', 'W3', 'W4', 'W5', 'Notes'];
  
  const rows = attendanceData.map(row => {
    const name = row.customer 
      ? `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim()
      : `Customer ${row.customer_id}`;
    
    if (search.length >= 2) {
      // Search results view
      if (row.type === 'free') {
        const totalSpots = row.total_spots || 1;
        const spotsUsed = row.spots_used || 0;
        const allUsed = spotsUsed >= totalSpots;
        
        return [
          name || 'Unknown',
          row.displayClass,
          row.role || '-',
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {Array.from({ length: totalSpots }, (_, i) => (
              <input
                key={`${row.id}-spot-${i}`}
                type="checkbox"
                checked={i < spotsUsed}
                onChange={(e) => handleFreeAttendanceChange(row.id, i, e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  accentColor: 'var(--accent-warm)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>,
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
      const totalSpots = row.total_spots || 1;
      const spotsUsed = row.spots_used || 0;
      const allUsed = spotsUsed >= totalSpots;
      
      return [
        name || 'Unknown',
        row.role || '-',
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Array.from({ length: totalSpots }, (_, i) => (
            <input
              key={`${row.id}-spot-${i}`}
              type="checkbox"
              checked={i < spotsUsed}
              onChange={(e) => handleFreeAttendanceChange(row.id, i, e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: 'var(--accent-warm)',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>,
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
          alignItems: 'center',
          flexWrap: windowWidth <= 768 ? 'wrap' : 'nowrap'
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
          
          {selectedClass === 'Socials' && (
            <>
              <select
                value={selectedSocialEvent}
                onChange={(e) => setSelectedSocialEvent(e.target.value)}
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
                  transition: 'all 0.3s ease',
                  width: windowWidth <= 768 ? '100%' : 'auto',
                  minWidth: windowWidth <= 768 ? '100%' : '200px'
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
                {socialEvents.map((event) => (
                  <option 
                    key={`${event.name}-${event.date}`} 
                    value={`${event.name}-${event.date}`} 
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    Loco Social - June 14th
                  </option>
                ))}
              </select>
              
              <select
                value={guestFilter}
                onChange={(e) => setGuestFilter(e.target.value)}
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
                  transition: 'all 0.3s ease',
                  width: windowWidth <= 768 ? '100%' : 'auto'
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
                <option value="paid" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Paid</option>
                <option value="special" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Special guests</option>
              </select>
              
              <button
                onClick={checkInSelectedTickets}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
                  color: 'white',
                  borderRadius: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  marginTop: windowWidth <= 768 ? '1rem' : '0'
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
                Process
              </button>
              
            </>
          )}
        </div>
      )}


      {/* Status Message */}
      {showStatus && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.5rem',
          background: statusMessage.includes('Failed') || statusMessage.includes('No changes') 
            ? 'rgba(232, 93, 47, 0.1)' 
            : 'rgba(94, 188, 126, 0.1)',
          border: statusMessage.includes('Failed') || statusMessage.includes('No changes')
            ? '1px solid rgba(232, 93, 47, 0.3)'
            : '1px solid rgba(94, 188, 126, 0.3)',
          borderRadius: '14px',
          color: statusMessage.includes('Failed') || statusMessage.includes('No changes')
            ? 'var(--accent-warm)'
            : '#5ebc7e',
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '1rem',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          animation: 'fadeIn 0.3s ease',
          transition: 'all 0.3s ease'
        }}>
          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          {statusMessage}
        </div>
      )}


      {/* Table Section */}
      {selectedClass === 'Socials' ? (
        <>
          {/* Active Tickets Section */}
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
            transition: 'all 0.5s ease',
            marginBottom: '2rem'
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
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Active Tickets</h3>
            {renderSocialAttendanceTable(attendanceData)}
          </div>
          
          {/* Completed Section */}
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
              background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-coral), var(--accent-warm), var(--accent-gold))'
            }}></div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Completed Check-ins</h3>
            {renderSocialAttendanceTable(completedData)}
          </div>
        </>
      ) : (
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
          <DataTable headers={headers} rows={rows} />
        </div>
      )}
    </div>
  );
}

export default Attendance;