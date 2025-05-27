// Orders.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [orderType, setOrderType] = useState('paid'); // 'paid' or 'free'

  // Term configuration (will come from console later)
  const TERM_START_DATE = '2025-05-01';
  const WEEKS_BEFORE = 5;

  // Fetch orders from database based on type
  async function fetchOrders() {
    try {
      const tableName = orderType === 'paid' ? 'paid_orders' : 'free_orders';
      
      if (orderType === 'paid') {
        const { data, error } = await supabase
          .from(tableName)
          .select(`
            *,
            customers (
              first_name,
              last_name
            )
          `)
          .order('order_date', { ascending: false });

        if (error) {
          console.error(`Error fetching ${orderType} orders:`, error);
          return;
        }

        console.log(`Fetched ${orderType} orders:`, data);
        setOrders(data || []);
      } else {
        // Free orders - fetch without join first
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('class_date', { ascending: false });

        if (error) {
          console.error(`Error fetching ${orderType} orders:`, error);
          return;
        }

        // Then fetch customer details separately
        if (data && data.length > 0) {
          const customerIds = [...new Set(data.map(order => order.customer_id).filter(id => id))];
          
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('customer_id, first_name, last_name')
            .in('customer_id', customerIds);

          if (customerError) {
            console.error('Error fetching customers:', customerError);
          }

          // Merge customer data
          const customerMap = (customers || []).reduce((acc, customer) => {
            acc[customer.customer_id] = customer;
            return acc;
          }, {});

          const ordersWithCustomers = data.map(order => ({
            ...order,
            customers: customerMap[order.customer_id] || null
          }));

          setOrders(ordersWithCustomers);
        } else {
          setOrders(data || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, [orderType]); // Refetch when order type changes

  // Parse date from variant title (e.g., "27th May" -> "2025-05-27")
  function parseClassDate(variantTitle) {
    console.log('parseClassDate input:', variantTitle);
    
    if (!variantTitle) return null;
    
    // Extract date pattern like "27th May", "3rd June", etc.
    const dateMatch = variantTitle.match(/(\d{1,2})(st|nd|rd|th)\s+(\w+)/);
    if (!dateMatch) {
      console.log('No date match found');
      return null;
    }
    
    const day = parseInt(dateMatch[1]);
    const monthName = dateMatch[3];
    
    console.log('Extracted:', { day, monthName });
    
    // Month mapping
    const months = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12',
      // Short versions
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const month = months[monthName];
    if (!month) {
      console.log('Month not found:', monthName);
      return null;
    }
    
    // Simply format as YYYY-MM-DD string without using Date object
    const year = new Date().getFullYear();
    const result = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    
    console.log('parseClassDate output:', result);
    
    return result;
  }

  // Parse Shopify orders into database format
  function parseOrderData(shopifyOrders) {
    const allResults = [];
    
    shopifyOrders.forEach(order => {
      const results = [];
      const roleClasses = {}; // Group by role
      const soloClasses = []; // Body Movement & Shines (no role)
      const freeClasses = []; // Free classes
      
      order.line_items.forEach(item => {
        const title = item.title.toLowerCase();
        const variant = (item.variant_title || '').toLowerCase();
        
        // Check if it's a free class
        if (title.includes('free class')) {
          // Extract role from variant
          let role = '';
          if (variant.includes('leader')) role = 'Leader';
          else if (variant.includes('follower')) role = 'Follower';
          
          // Extract date from variant
          const classDate = parseClassDate(item.variant_title);
          
          if (classDate) {
            const freeOrder = {
              order_id: order.id,
              customer_id: order.customer?.id || null,
              class_date: classDate,
              class: 'Free Class - New York Salsa',
              role: role,
              paid: false,
              notes: order.note || ''
            };
            console.log('Creating free order for customer', order.customer?.id, 'on date', classDate);
            freeClasses.push(freeOrder);
          } else {
            console.log('Failed to parse date from free class variant:', item.variant_title);
          }
          return;
        }
        
        // Skip one class pass
        if (title.includes('one class pass')) return;
        
        // STRICT TERM 2 FILTERING
        // Skip if not a term class
        if (!variant.includes('term')) return;
        
        // Skip if it's Term 1 or Term 3
        if (variant.includes('term 1') || variant.includes('term 3')) {
          console.log('Skipping non-Term 2 order:', variant);
          return;
        }
        
        // Skip if it's Term 2b
        if (variant.includes('term 2b')) {
          console.log('Skipping Term 2b order:', variant);
          return;
        }
        
        // Only accept Term 2 or Term 2a
        if (!variant.includes('term 2')) {
          console.log('Skipping non-Term 2 order:', variant);
          return;
        }
        
        // Extract class name for paid classes - NO LEVEL 4
        let className = '';
        if (title.includes('level 1')) className = 'Level 1';
        else if (title.includes('level 2')) className = 'Level 2';
        else if (title.includes('level 3')) className = 'Level 3';
        else if (title.includes('body movement') && title.includes('open')) className = 'Body Movement';
        else if (title.includes('shines')) className = 'Shines';
        else if (title.includes('unlimited bundle')) {
          handleBundle(order, item, ['Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines'], roleClasses, soloClasses);
          return;
        }
        else if (title.includes('platinum bundle')) {
          handleBundle(order, item, ['Level 1', 'Level 2', 'Level 3'], roleClasses, soloClasses);
          return;
        }
        else return; // Skip unknown classes
        
        // Extract role
        let role = '';
        if (variant.includes('leader')) role = 'Leader';
        else if (variant.includes('follower')) role = 'Follower';
        
        // Group classes by role
        if (className === 'Body Movement' || className === 'Shines') {
          soloClasses.push(className);
        } else if (role) {
          if (!roleClasses[role]) roleClasses[role] = [];
          roleClasses[role].push(className);
        }
      });
      
      // Process paid classes
      // Create rows for each role group
      Object.entries(roleClasses).forEach(([role, classes]) => {
        results.push({
          order_id: order.id,
          customer_id: order.customer?.id || null,
          order_date: order.created_at,
          classes: classes,
          role: role,
          paid: order.financial_status === 'paid',
          notes: order.note || ''
        });
      });
      
      // Create one row for all solo classes (Body Movement & Shines)
      if (soloClasses.length > 0) {
        results.push({
          order_id: order.id,
          customer_id: order.customer?.id || null,
          order_date: order.created_at,
          classes: soloClasses,
          role: '',
          paid: order.financial_status === 'paid',
          notes: order.note || ''
        });
      }
      
      // Add free classes
      results.push(...freeClasses);
      
      allResults.push(...results);
    });
    
    return allResults;
  }

  function handleBundle(order, item, classNames, roleClasses, soloClasses) {
    const variant = (item.variant_title || '').toLowerCase();
    
    // Extract role from bundle variant
    let role = '';
    if (variant.includes('leader')) role = 'Leader';
    else if (variant.includes('follower')) role = 'Follower';
    
    // Add level classes to role group
    if (role) {
      const levelClasses = classNames.filter(c => !['Body Movement', 'Shines'].includes(c));
      if (!roleClasses[role]) roleClasses[role] = [];
      roleClasses[role].push(...levelClasses);
    }
    
    // Add Body Movement/Shines to solo classes
    const solos = classNames.filter(c => ['Body Movement', 'Shines'].includes(c));
    soloClasses.push(...solos);
  }

  // Update attendance table with new entries from orders
  async function updateAttendanceFromOrders(parsedOrders, type) {
    try {
      const tableName = type === 'paid' ? 'paid_attendance' : 'free_attendance';
      setMessage(prev => prev + ` Updating ${type} attendance records...`);
      
      // Filter orders by type
      const ordersToProcess = type === 'paid' 
        ? parsedOrders.filter(o => !o.hasOwnProperty('class_date'))
        : parsedOrders.filter(o => o.hasOwnProperty('class_date'));
      
      if (ordersToProcess.length === 0) {
        console.log(`No ${type} orders to process for attendance`);
        return;
      }
      
      // Get existing attendance records to avoid duplicates
      const { data: existingAttendance, error: fetchError } = await supabase
        .from(tableName)
        .select(type === 'paid' ? 'customer_id, class_name, role' : 'customer_id, class_date, role');
      
      if (fetchError) {
        console.error(`Error fetching existing ${type} attendance:`, fetchError);
        return;
      }
      
      console.log(`Found ${existingAttendance?.length || 0} existing ${type} attendance records`);
      if (type === 'free' && existingAttendance?.length > 0) {
        console.log('Sample existing free attendance records:', existingAttendance.slice(0, 5));
        // Log the actual dates in the database
        existingAttendance.slice(0, 5).forEach(record => {
          console.log(`DB Record - Customer: ${record.customer_id}, Date: ${record.class_date}, Role: ${record.role}`);
        });
      }
      
      // Create a Set of existing combinations
      const existingKeys = new Set(
        type === 'paid'
          ? existingAttendance.map(a => `${a.customer_id}-${a.class_name}-${a.role || ''}`)
          : existingAttendance.map(a => {
              const dateStr = typeof a.class_date === 'string' ? a.class_date : a.class_date.toISOString().split('T')[0];
              return `${a.customer_id}-${dateStr}-${a.role || ''}`;
            })
      );
      
      console.log(`Existing keys for ${type} attendance:`, Array.from(existingKeys).slice(0, 10));
      
      // Prepare new attendance records
      const newAttendanceRecords = [];
      const seenKeys = new Set(); // Track keys we're about to insert
      
      for (const order of ordersToProcess) {
        if (type === 'paid') {
          // Process each class in the order
          for (const className of order.classes) {
            const key = `${order.customer_id}-${className}-${order.role || ''}`;
            
            // Skip if this combination already exists in DB or in our batch
            if (existingKeys.has(key) || seenKeys.has(key)) {
              continue;
            }
            
            seenKeys.add(key);
            
            // Create new attendance record
            newAttendanceRecords.push({
              customer_id: order.customer_id,
              class_name: className,
              role: order.role || '',
              term: 'Term 2', // Default values
              block: 'A',
              week_1: false,
              week_2: false,
              week_3: false,
              week_4: false,
              week_5: false,
              notes: order.notes || ''
            });
          }
        } else {
          // Free attendance
          const key = `${order.customer_id}-${order.class_date}-${order.role || ''}`;
          
          console.log('Checking free attendance key:', key, 'against existing keys');
          
          // Skip if this combination already exists in DB or in our batch
          if (existingKeys.has(key) || seenKeys.has(key)) {
            console.log('Skipping duplicate free attendance:', key);
            continue;
          }
          
          seenKeys.add(key);
          
          // Create new free attendance record
          const newRecord = {
            customer_id: order.customer_id,
            role: order.role || '',
            class_date: order.class_date,
            attended: false
          };
          console.log('Creating new free attendance record:', newRecord);
          console.log('Order class_date type:', typeof order.class_date, 'value:', order.class_date);
          newAttendanceRecords.push(newRecord);
        }
      }
      
      if (newAttendanceRecords.length > 0) {
        console.log(`Inserting ${newAttendanceRecords.length} new ${type} attendance records`);
        
        // Insert without upsert - we already filtered duplicates
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(newAttendanceRecords);
        
        if (insertError) {
          console.error(`Error inserting ${type} attendance records:`, insertError);
          setMessage(prev => prev + ` Failed to update ${type} attendance: ${insertError.message}`);
        } else {
          console.log(`Inserted ${type} attendance records successfully`);
          setMessage(prev => prev + ` Updated ${newAttendanceRecords.length} ${type} attendance records.`);
        }
      } else {
        console.log(`No new ${type} attendance records to add`);
        setMessage(prev => prev + ` ${type} attendance records are up to date.`);
      }
    } catch (err) {
      console.error(`Error updating ${type} attendance:`, err);
    }
  }

  // Sync orders from Shopify
  async function syncFromShopify() {
    setLoading(true);
    setMessage('Fetching orders from Shopify...');

    try {
      // Calculate date range (5 weeks before term start)
      const startDate = new Date(TERM_START_DATE);
      startDate.setDate(startDate.getDate() - (WEEKS_BEFORE * 7));
      const sinceDate = startDate.toISOString();

      // Fetch from Shopify via Netlify function
      const response = await fetch('/.netlify/functions/shopify-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ since: sinceDate })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json();
      const shopifyOrders = data.orders || [];
      
      console.log(`Fetched ${shopifyOrders.length} orders from Shopify`);
      setMessage(`Fetched ${shopifyOrders.length} orders from Shopify...`);

      // Parse ALL orders - this will separate paid and free
      const allParsedOrders = parseOrderData(shopifyOrders);
      
      // Process PAID orders
      const paidOrders = allParsedOrders.filter(o => !o.hasOwnProperty('class_date'));
      console.log(`Parsed into ${paidOrders.length} paid order records`);
      
      if (paidOrders.length > 0) {
        setMessage(`Processing paid orders...`);
        
        // Delete all existing paid orders
        const { error: deletePaidError } = await supabase
          .from('paid_orders')
          .delete()
          .gte('id', 0);
        
        if (deletePaidError) {
          console.error('Error deleting paid orders:', deletePaidError);
        } else {
          // Insert new paid orders
          const { error: insertPaidError } = await supabase
            .from('paid_orders')
            .insert(paidOrders);
          
          if (insertPaidError) {
            console.error('Error inserting paid orders:', insertPaidError);
          } else {
            console.log(`Successfully synced ${paidOrders.length} paid orders`);
          }
        }
      }
      
      // Process FREE orders
      const freeOrders = allParsedOrders.filter(o => o.hasOwnProperty('class_date'));
      console.log(`Parsed into ${freeOrders.length} free order records`);
      console.log('Free orders details:', freeOrders); // Debug log
      
      if (freeOrders.length > 0) {
        setMessage(`Processing free orders...`);
        
        // Delete all existing free orders
        const { error: deleteFreeError } = await supabase
          .from('free_orders')
          .delete()
          .gte('id', 0);
        
        if (deleteFreeError) {
          console.error('Error deleting free orders:', deleteFreeError);
        } else {
          // Insert new free orders
          const { error: insertFreeError } = await supabase
            .from('free_orders')
            .insert(freeOrders);
          
          if (insertFreeError) {
            console.error('Error inserting free orders:', insertFreeError);
          } else {
            console.log(`Successfully synced ${freeOrders.length} free orders`);
          }
        }
      }
      
      // UPDATE BOTH ATTENDANCE TYPES REGARDLESS OF CURRENT VIEW
      setMessage(`Updating attendance records...`);
      await updateAttendanceFromOrders(allParsedOrders, 'paid');
      await updateAttendanceFromOrders(allParsedOrders, 'free');
      
      setMessage(`Successfully synced ${paidOrders.length} paid orders and ${freeOrders.length} free orders from Shopify!`);
      
      // Refresh the current view
      await fetchOrders();
      
      setLoading(false);
    } catch (err) {
      console.error('Error syncing from Shopify:', err);
      setMessage(`Error: ${err.message}`);
      setLoading(false);
    }
  }

  // Filter orders based on search
  const filteredOrders = orders.filter((order) => {
    const customerName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`;
    const classesStr = orderType === 'paid' 
      ? (Array.isArray(order.classes) ? order.classes.join(', ') : '')
      : (order.class || '');
    const searchStr = `${customerName} ${order.order_id} ${classesStr} ${order.role}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  // Prepare table data
  const headers = orderType === 'paid' 
    ? ['Order ID', 'Customer', 'Role', 'Classes', 'Date']
    : ['Order ID', 'Customer', 'Role', 'Class', 'Date'];
    
  const rows = filteredOrders.map((order) => {
    if (orderType === 'paid') {
      return [
        order.order_id,
        `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim() || 'Unknown',
        order.role || '-',
        Array.isArray(order.classes) ? order.classes.join(', ') : '-',
        order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'
      ];
    } else {
      // Free orders - format the date from YYYY-MM-DD to DD/MM/YYYY for display
      let displayDate = '-';
      if (order.class_date) {
        try {
          const date = new Date(order.class_date + 'T00:00:00');
          displayDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        } catch {
          displayDate = order.class_date; // Fallback to original if parsing fails
        }
      }
      
      return [
        order.order_id,
        `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim() || 'Unknown',
        order.role || '-',
        order.class || '-',
        displayDate
      ];
    }
  });

  return (
    <div style={{ padding: '4rem 0' }}>
      {/* Search and Sync Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        <input
          type="text"
          placeholder="Search orders..."
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
          onClick={syncFromShopify}
          disabled={loading}
          style={{
            padding: '1rem 1.5rem',
            background: loading ? 'var(--glass-bg)' : 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
            color: loading ? 'var(--text-secondary)' : 'white',
            borderRadius: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            border: loading ? '1px solid var(--glass-border)' : 'none',
            opacity: loading ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 15px 35px rgba(232, 93, 47, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {loading ? 'Syncing...' : 'Sync from Shopify'}
        </button>
      </div>
      
      {/* Order Type Selection */}
      <div style={{ marginBottom: '3rem' }}>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
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
          <option value="paid" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Paid Orders</option>
          <option value="free" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Free Orders</option>
        </select>
      </div>
      
      {/* Message Display */}
      {message && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.5rem',
          borderRadius: '14px',
          background: message.includes('Error') 
            ? 'rgba(232, 93, 47, 0.1)' 
            : 'rgba(78, 205, 196, 0.1)',
          border: `1px solid ${message.includes('Error') 
            ? 'rgba(232, 93, 47, 0.3)' 
            : 'rgba(78, 205, 196, 0.3)'}`,
          color: message.includes('Error') 
            ? 'var(--accent-warm)' 
            : 'var(--success)'
        }}>
          {message}
        </div>
      )}
      
      {/* Table Section */}
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
    </div>
  );
}

export default Orders;