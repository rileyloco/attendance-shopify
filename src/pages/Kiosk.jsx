// Kiosk.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function Kiosk() {
  const [searchName, setSearchName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [eligibleClasses, setEligibleClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isKioskWindow, setIsKioskWindow] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Check if this is kiosk mode
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isKiosk = searchParams.get('mode') === 'kiosk';
    
    if (isKiosk) {
      setIsKioskWindow(true);
      
      // Add kiosk class to body
      document.body.classList.add('kiosk-mode');
      
      // Disable right-click context menu
      const preventContextMenu = (e) => e.preventDefault();
      document.addEventListener('contextmenu', preventContextMenu);
      
      // Disable text selection
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      // Prevent navigation with keyboard shortcuts
      const preventNavigation = (e) => {
        // Prevent F5, Ctrl+R (refresh)
        if ((e.key === 'F5') || (e.ctrlKey && e.key === 'r')) {
          e.preventDefault();
        }
        // Prevent Alt+Left Arrow (back)
        if (e.altKey && e.key === 'ArrowLeft') {
          e.preventDefault();
        }
        // Prevent Ctrl+L (focus address bar)
        if (e.ctrlKey && e.key === 'l') {
          e.preventDefault();
        }
      };
      document.addEventListener('keydown', preventNavigation);
      
      // Disable back button by manipulating history
      history.pushState(null, null, location.href);
      window.onpopstate = function () {
        history.go(1);
      };
      
      // Try to go fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen request failed:', err);
        });
      }
      
      // Cleanup function
      return () => {
        document.body.classList.remove('kiosk-mode');
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('keydown', preventNavigation);
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
      };
    }
  }, []);

  // Preload customers on mount
  useEffect(() => {
    async function preloadCustomers() {
      console.log('Preloading customers from paid_attendance...');
      
      const { data, error } = await supabase
        .from('paid_attendance')
        .select('customer_id, customers(customer_id, first_name, last_name)')
        .not('customer_id', 'is', null)
        .order('customer_id', { ascending: true });

      if (error) {
        console.error('Error preloading customers:', error);
        return;
      }

      // Get unique customers
      const uniqueCustomersMap = new Map();
      data.forEach(record => {
        if (record.customers) {
          uniqueCustomersMap.set(record.customer_id, {
            customer_id: record.customer_id,
            first_name: record.customers.first_name,
            last_name: record.customers.last_name
          });
        }
      });

      const uniqueCustomers = Array.from(uniqueCustomersMap.values());
      localStorage.setItem('customers', JSON.stringify(uniqueCustomers));
      console.log(`Preloaded ${uniqueCustomers.length} unique customers`);
    }

    preloadCustomers();
  }, []);

  // Fetch customer suggestions
  async function fetchCustomerSuggestions(query) {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Try local storage first
    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    if (customers.length > 0) {
      const filtered = customers.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
      setSuggestions(filtered);
      return;
    }

    // Fallback to database
    const { data, error } = await supabase
      .from('paid_attendance')
      .select('customer_id, customers(first_name, last_name)')
      .not('customer_id', 'is', null)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`, { referencedTable: 'customers' })
      .limit(10);

    if (error) {
      console.error('Error fetching customers:', error);
      return;
    }

    // Get unique customers
    const uniqueMap = new Map();
    data.forEach(record => {
      if (record.customers) {
        uniqueMap.set(record.customer_id, {
          customer_id: record.customer_id,
          first_name: record.customers.first_name,
          last_name: record.customers.last_name
        });
      }
    });

    setSuggestions(Array.from(uniqueMap.values()));
  }

  // Handle name input change
  function handleNameChange(e) {
    const value = e.target.value;
    setSearchName(value);
    
    // If we already selected a customer and now editing
    if (selectedCustomer) {
      // ANY change means they're editing - reset everything
      setSelectedCustomer(null);
      setEligibleClasses([]);
      setSelectedClasses([]);
    }
    
    fetchCustomerSuggestions(value);
  }

  // When customer is selected from suggestions
  async function selectCustomer(customer) {
    // Start loading state
    setLoadingClasses(true);
    setSelectedCustomer(customer);
    setSearchName(`${customer.first_name} ${customer.last_name}`);
    setSuggestions([]); // Clear suggestions immediately
    
    // Focus away from input to hide keyboard on mobile
    document.getElementById('name-input')?.blur();

    // Fetch classes they're enrolled in
    const { data, error } = await supabase
      .from('paid_attendance')
      .select('class_name, role')
      .eq('customer_id', customer.customer_id);

    if (error) {
      console.error('Error fetching classes:', error);
      setLoadingClasses(false);
      return;
    }

    // Create unique class entries
    const uniqueClasses = [];
    const seen = new Set();
    
    data.forEach(record => {
      const key = `${record.class_name}-${record.role || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueClasses.push({
          className: record.class_name,
          role: record.role || null,
          display: record.role ? `${record.class_name} (${record.role})` : record.class_name
        });
      }
    });

    // Update everything at once for smooth transition
    setEligibleClasses(uniqueClasses);
    setSelectedClasses([]);
    setLoadingClasses(false);
  }

  // Toggle class selection
  function toggleClass(classInfo) {
    setSelectedClasses(prev => {
      const key = `${classInfo.className}-${classInfo.role || ''}`;
      const isSelected = prev.some(c => `${c.className}-${c.role || ''}` === key);
      
      if (isSelected) {
        return prev.filter(c => `${c.className}-${c.role || ''}` !== key);
      } else {
        return [...prev, classInfo];
      }
    });
  }

  // Submit check-in
  async function submitCheckIn() {
    if (!selectedCustomer || selectedClasses.length === 0) return;

    setSubmitting(true);

    // Create log entries
    const logEntries = selectedClasses.map(classInfo => ({
      customer_id: selectedCustomer.customer_id,
      first_name: selectedCustomer.first_name,
      last_name: selectedCustomer.last_name,
      class: classInfo.className,
      role: classInfo.role || '',
      date_time: new Date().toISOString(),
      logged: false,
      notes: ''
    }));

    const { error } = await supabase
      .from('log')
      .insert(logEntries);

    if (error) {
      console.error('Error creating log entries:', error);
      alert('Failed to check in. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    
    // Show confirmation using DOM manipulation like the working example
    showConfirmation();
  }
  
  // Show confirmation pop-up (following the working example's pattern)
  function showConfirmation() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
      modal.style.display = 'flex';
      
      const timeout = setTimeout(() => {
        modal.style.display = 'none';
        resetForm();
      }, 3000);
      
      const okButton = document.getElementById('modal-ok-btn');
      if (okButton) {
        okButton.onclick = () => {
          clearTimeout(timeout);
          modal.style.display = 'none';
          resetForm();
        };
      }
    }
  }

  // Reset form
  function resetForm() {
    setSearchName('');
    setSuggestions([]);
    setSelectedCustomer(null);
    setEligibleClasses([]);
    setSelectedClasses([]);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: window.innerWidth <= 768 ? '1.5rem 1rem' : '3rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: window.innerWidth <= 768 ? '100%' : '600px',
        margin: '0 auto',
        padding: window.innerWidth <= 768 ? '0 0.5rem' : '0'
      }}>
        {/* Logo/Title */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: window.innerWidth <= 768 ? '3rem' : '7rem'
        }}>
          <img 
            src="/logo7.png" 
            alt="LocoMojo" 
            style={{
              height: window.innerWidth <= 768 ? '100px' : '160px',
              width: 'auto',
              opacity: 0.9,
              maxWidth: '90%'
            }}
          />
        </div>

        {/* Main Card with smooth transitions */}
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid var(--glass-border)',
          borderRadius: window.innerWidth <= 768 ? '20px' : '28px',
          padding: window.innerWidth <= 768 ? '1.5rem' : '3rem',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.5s ease',
          minHeight: selectedCustomer && eligibleClasses.length > 0 
            ? (window.innerWidth <= 768 ? '350px' : '420px') 
            : (window.innerWidth <= 768 ? '140px' : '180px'),
          fontSize: window.innerWidth <= 768 ? '14px' : '16px'
        }}>
          <div style={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #5ebc7e, #4ca76d, #48a368)'
          }}></div>

          {/* Always visible input field */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <input
              id="name-input"
              type="text"
              placeholder="Start typing your name..."
              value={searchName}
              onChange={handleNameChange}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              style={{
                width: '100%',
                padding: window.innerWidth <= 768 ? '1rem 1.25rem' : '1.25rem 1.5rem',
                fontSize: window.innerWidth <= 768 ? '16px' : '1.1rem',
                background: selectedCustomer ? 'rgba(94, 188, 126, 0.08)' : 'var(--glass-bg)',
                border: '2px solid',
                borderColor: selectedCustomer ? 'rgba(94, 188, 126, 0.4)' : 'var(--glass-border)',
                borderRadius: '16px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.3s ease',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5ebc7e';
                e.target.style.background = selectedCustomer ? 'rgba(94, 188, 126, 0.12)' : 'var(--glass-hover)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = selectedCustomer ? 'rgba(94, 188, 126, 0.4)' : 'var(--glass-border)';
                e.target.style.background = selectedCustomer ? 'rgba(94, 188, 126, 0.08)' : 'var(--glass-bg)';
              }}
            />
            
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                zIndex: 10
              }}>
                {suggestions.map((customer, index) => (
                  <div
                    key={customer.customer_id}
                    onClick={() => selectCustomer(customer)}
                    style={{
                      padding: '1rem 1.5rem',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: '500',
                      borderBottom: index < suggestions.length - 1 ? '1px solid var(--glass-border)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--glass-hover)';
                      e.currentTarget.style.paddingLeft = '2rem';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '1.5rem';
                    }}
                  >
                    {customer.first_name} {customer.last_name}
                  </div>
                ))}
              </div>
            )}
          </div>



          {/* Class Selection with fade transition */}
          <div style={{
            opacity: eligibleClasses.length > 0 && !loadingClasses && !suggestions.length ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: eligibleClasses.length > 0 && !loadingClasses && !suggestions.length ? 'auto' : 'none'
          }}>
            {eligibleClasses.length > 0 && (
              <>
                <label style={{
                  display: 'block',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '1rem'
                }}>
                  Select your classes
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {eligibleClasses.map((classInfo, idx) => {
                    const isSelected = selectedClasses.some(c => 
                      c.className === classInfo.className && c.role === classInfo.role
                    );
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleClass(classInfo)}
                        style={{
                          padding: '1.25rem 1.5rem',
                          borderRadius: '16px',
                          border: '2px solid',
                          borderColor: isSelected ? 'rgba(94, 188, 126, 0.6)' : 'var(--glass-border)',
                          background: isSelected ? 'rgba(94, 188, 126, 0.1)' : 'var(--glass-bg)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.background = 'var(--glass-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                            e.currentTarget.style.background = 'var(--glass-bg)';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '1.05rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)'
                          }}>
                            {classInfo.display}
                          </span>
                          {isSelected && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#5ebc7e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Submit Button with smooth transition */}
          <div style={{
            marginTop: '2rem',
            opacity: selectedClasses.length > 0 && !suggestions.length ? 1 : 0,
            transform: selectedClasses.length > 0 && !suggestions.length ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'all 0.3s ease',
            pointerEvents: selectedClasses.length > 0 && !suggestions.length ? 'auto' : 'none'
          }}>
            <button
              onClick={submitCheckIn}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '1.25rem',
                fontSize: '1.1rem',
                fontWeight: '700',
                background: submitting 
                  ? 'var(--glass-bg)' 
                  : 'rgba(94, 188, 126, 0.2)',
                color: submitting ? 'var(--text-secondary)' : '#5ebc7e',
                borderRadius: '16px',
                border: submitting ? '1px solid var(--glass-border)' : '1px solid rgba(94, 188, 126, 0.4)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: submitting ? 0.7 : 1,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(94, 188, 126, 0.3)';
                  e.currentTarget.style.background = 'rgba(94, 188, 126, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = 'rgba(94, 188, 126, 0.2)';
                }
              }}
            >
              {submitting ? 'Checking in...' : `Check In (${selectedClasses.length} ${selectedClasses.length === 1 ? 'class' : 'classes'})`}
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <div 
        id="confirmation-modal" 
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}
      >
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid var(--glass-border)',
          padding: '3rem',
          borderRadius: '28px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{ 
            marginBottom: '2rem',
            display: 'inline-block'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(94, 188, 126, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <svg width="40" height="40" fill="none" stroke="#5ebc7e" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h2 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            marginBottom: '0.75rem',
            background: 'linear-gradient(135deg, #5ebc7e 0%, #4ca76d 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Check-in Successful!
          </h2>
          
          <p style={{ 
            fontSize: '1.1rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem'
          }}>
            Have a great class!
          </p>
          
          <button
            id="modal-ok-btn"
            style={{
              padding: '0.75rem 3rem',
              background: 'rgba(94, 188, 126, 0.2)',
              color: '#5ebc7e',
              borderRadius: '12px',
              border: '1px solid rgba(94, 188, 126, 0.4)',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(94, 188, 126, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(94, 188, 126, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default Kiosk;