import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function Reports() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Global data storage
  const [globalData, setGlobalData] = useState({
    orders: [],
    customers: {},
    lastFetch: null
  });

  // Report states
  const [incomeReport, setIncomeReport] = useState(null);
  const [term2bReport, setTerm2bReport] = useState(null);
  const [timingReport, setTimingReport] = useState(null);
  const [enrollmentAnalysis, setEnrollmentAnalysis] = useState(null);

  // Show/hide states for buttons
  const [showIncomeButtons, setShowIncomeButtons] = useState(false);
  const [showTerm2bButtons, setShowTerm2bButtons] = useState(false);
  const [showTimingButtons, setShowTimingButtons] = useState(false);
  const [showAnalysisButtons, setShowAnalysisButtons] = useState(false);

  // Loading states for each report
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [term2bLoading, setTerm2bLoading] = useState(false);
  const [timingLoading, setTimingLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Fetch Shopify orders
  async function fetchShopifyOrders(fromDate = null) {
    const since = fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const response = await fetch('/.netlify/functions/shopify-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ since })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json();
      return data.orders || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      showStatus('Failed to fetch Shopify orders', false);
      return [];
    }
  }

  // Fetch customer data from Supabase
  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id, first_name, last_name, email');

      if (error) {
        console.error('Error fetching customers:', error);
        return {};
      }

      // Create a lookup map
      const customerMap = {};
      data.forEach(customer => {
        customerMap[customer.customer_id] = customer;
      });
      
      return customerMap;
    } catch (error) {
      console.error('Error fetching customers:', error);
      return {};
    }
  }

  // Show status message
  function showStatus(msg, isSuccess = true) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  // Income Report Functions
  async function generateIncomeReport() {
    setIncomeLoading(true);
    const fromDate = document.getElementById('income-from-date').value;
    
    if (!fromDate) {
      showStatus('Please select a from date', false);
      setIncomeLoading(false);
      return;
    }

    const orders = await fetchShopifyOrders(fromDate);
    
    // Filter orders from the specified date
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= new Date(fromDate);
    });

    // Process orders for display
    const reportData = filteredOrders.map(order => ({
      orderNumber: order.order_number || order.name,
      date: new Date(order.created_at).toLocaleDateString(),
      customerId: order.customer?.id || 'N/A',
      items: order.line_items.map(item => item.title).join(', '),
      amount: parseFloat(order.total_price || 0),
      status: order.financial_status || 'paid'
    }));

    // Calculate totals
    const totalIncome = reportData.reduce((sum, order) => sum + order.amount, 0);

    setIncomeReport({
      data: reportData,
      summary: {
        totalOrders: reportData.length,
        totalIncome
      }
    });

    setShowIncomeButtons(true);
    setIncomeLoading(false);
    showStatus(`Generated income report: ${reportData.length} orders`, true);
  }

  function resetIncomeReport() {
    setIncomeReport(null);
    setShowIncomeButtons(false);
    document.getElementById('income-from-date').value = '2025-01-01';
  }

  // Term 2b Report Functions
  async function generateTerm2bReport() {
    setTerm2bLoading(true);
    
    // Fetch both orders and customers
    const [orders, customers] = await Promise.all([
      fetchShopifyOrders(),
      fetchCustomers()
    ]);

    // Update global data
    setGlobalData({
      orders,
      customers,
      lastFetch: new Date()
    });

    // Process Term 2b enrollments
    const enrollments = [];
    const processedCustomers = new Set();

    orders.forEach(order => {
      const customerId = order.customer?.id;
      if (!customerId) return;

      order.line_items.forEach(item => {
        const title = item.title.toLowerCase();
        const variant = (item.variant_title || '').toLowerCase();
        
        // Skip free classes and one class passes
        if (title.includes('free class') || title.includes('one class pass')) return;
        
        // Check if it's a Term 2b class
        if (!variant.includes('term 2b') && !variant.includes('term 2')) return;
        
        // Skip if not a valid term class
        if (!variant.includes('term')) return;

        // Extract class info
        let classes = [];
        let role = '';
        
        // Extract role
        if (variant.includes('leader')) role = 'Leader';
        else if (variant.includes('follower')) role = 'Follower';
        
        // Determine classes
        if (title.includes('unlimited bundle') || title.includes('platinum bundle')) {
          classes = ['Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines'];
        } else if (title.includes('level 1')) {
          classes = ['Level 1'];
        } else if (title.includes('level 2')) {
          classes = ['Level 2'];
        } else if (title.includes('level 3')) {
          classes = ['Level 3'];
        } else if (title.includes('body movement')) {
          classes = ['Body Movement'];
          role = 'N/A';
        } else if (title.includes('shines')) {
          classes = ['Shines'];
          role = 'N/A';
        }

        if (classes.length > 0) {
          const customerInfo = customers[customerId] || {};
          const customerName = customerInfo.first_name && customerInfo.last_name
            ? `${customerInfo.first_name} ${customerInfo.last_name}`
            : order.customer?.first_name && order.customer?.last_name
            ? `${order.customer.first_name} ${order.customer.last_name}`
            : 'Unknown';

          enrollments.push({
            customerId,
            customerName,
            email: customerInfo.email || order.customer?.email || '',
            classes: classes.join(', '),
            role: role || 'N/A',
            orderDate: new Date(order.created_at).toLocaleDateString(),
            amount: parseFloat(item.price || 0),
            orderNumber: order.order_number || order.name
          });

          processedCustomers.add(customerId);
        }
      });
    });

    setTerm2bReport({
      data: {
        enrollments,
        uniqueStudents: processedCustomers.size
      }
    });

    setShowTerm2bButtons(true);
    setTerm2bLoading(false);
    showStatus(`Found ${enrollments.length} Term 2b enrollments`, true);
  }

  function resetTerm2bReport() {
    setTerm2bReport(null);
    setShowTerm2bButtons(false);
  }

  // Enrollment Timing Report Functions
  async function generateEnrollmentTimingReport() {
    setTimingLoading(true);
    
    // Use existing data or fetch new
    let orders = globalData.orders;
    if (!orders.length) {
      orders = await fetchShopifyOrders();
    }

    const classStartDate = new Date('2025-06-10'); // Term 2b start date
    const timingData = {
      byClass: {},
      byDayOfWeek: {},
      allEnrollments: []
    };

    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      
      order.line_items.forEach(item => {
        const title = item.title.toLowerCase();
        const variant = (item.variant_title || '').toLowerCase();
        
        // Skip non-Term 2b items
        if (!variant.includes('term 2b')) return;
        if (title.includes('free class') || title.includes('one class pass')) return;
        
        // Calculate days before class start
        const daysBeforeStart = Math.floor((classStartDate - orderDate) / (1000 * 60 * 60 * 24));
        const dayOfWeek = orderDate.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Determine class level
        let classLevel = '';
        if (title.includes('unlimited bundle') || title.includes('platinum bundle')) {
          classLevel = 'Bundle';
        } else if (title.includes('level 1')) {
          classLevel = 'Level 1';
        } else if (title.includes('level 2')) {
          classLevel = 'Level 2';
        } else if (title.includes('level 3')) {
          classLevel = 'Level 3';
        } else if (title.includes('body movement')) {
          classLevel = 'Body Movement';
        } else if (title.includes('shines')) {
          classLevel = 'Shines';
        }

        if (classLevel) {
          // Initialize class data if needed
          if (!timingData.byClass[classLevel]) {
            timingData.byClass[classLevel] = {
              early: 0,
              dayOf: 0,
              total: 0
            };
          }

          // Categorize enrollment
          if (daysBeforeStart > 0) {
            timingData.byClass[classLevel].early++;
          } else {
            timingData.byClass[classLevel].dayOf++;
          }
          timingData.byClass[classLevel].total++;

          // Track by day of week
          timingData.byDayOfWeek[dayOfWeek] = (timingData.byDayOfWeek[dayOfWeek] || 0) + 1;

          // Store enrollment details
          timingData.allEnrollments.push({
            classLevel,
            daysBeforeStart,
            dayOfWeek,
            orderDate: orderDate.toISOString()
          });
        }
      });
    });

    // Calculate statistics
    const totalEnrollments = timingData.allEnrollments.length;
    const avgDaysEarly = totalEnrollments > 0
      ? Math.round(timingData.allEnrollments.reduce((sum, e) => sum + Math.max(0, e.daysBeforeStart), 0) / totalEnrollments)
      : 0;

    // Find most popular day
    let popularDay = '-';
    let maxCount = 0;
    Object.entries(timingData.byDayOfWeek).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        popularDay = day;
      }
    });

    setTimingReport({
      data: {
        byClass: timingData.byClass,
        totalEnrollments,
        avgDaysEarly,
        popularDay,
        popularDayCount: maxCount
      }
    });

    setShowTimingButtons(true);
    setTimingLoading(false);
    showStatus('Generated enrollment timing analysis', true);
  }

  function resetTimingReport() {
    setTimingReport(null);
    setShowTimingButtons(false);
  }

  // Term 2b Enrollment Analysis Functions
  async function generateEnrollmentAnalysis() {
    setAnalysisLoading(true);
    showStatus('Analyzing Term 2b enrollment from Shopify orders...', true);
    
    try {
      // Calculate date range (5 weeks before term start)
      const startDate = new Date('2025-05-01'); // Term 2 start
      startDate.setDate(startDate.getDate() - (5 * 7));
      const sinceDate = startDate.toISOString();

      // Fetch orders and customers
      const [shopifyOrders, customersData] = await Promise.all([
        fetchShopifyOrders(sinceDate),
        fetchCustomers()
      ]);

      // Process orders to identify enrollments
      const customerEnrollments = {};

      shopifyOrders.forEach(order => {
        if (!order.customer?.id) return;
        
        const customerId = order.customer.id;
        const customerInfo = customersData[customerId] || {
          first_name: order.customer.first_name || '',
          last_name: order.customer.last_name || '',
          email: order.customer.email || ''
        };

        if (!customerEnrollments[customerId]) {
          customerEnrollments[customerId] = {
            customer_id: customerId,
            name: `${customerInfo.first_name} ${customerInfo.last_name}`.trim() || 'Unknown',
            email: customerInfo.email || order.customer.email || '',
            orders: [],
            enrollments_2a: [],
            enrollments_2b: [],
            has_platinum: false
          };
        }

        // Process each line item in the order
        order.line_items.forEach(item => {
          const title = item.title.toLowerCase();
          const variant = (item.variant_title || '').toLowerCase();
          
          // Skip free classes and one class passes
          if (title.includes('free class') || title.includes('one class pass')) return;
          
          // Check if it's a term class
          if (!variant.includes('term')) return;
          
          // Determine which term/block
          let term = '';
          let block = '';
          
          if (variant.includes('term 2b')) {
            term = '2';
            block = 'b';
          } else if (variant.includes('term 2a')) {
            term = '2';
            block = 'a';
          } else if (variant.includes('term 2') && !variant.includes('term 1') && !variant.includes('term 3')) {
            // "Term 2" without specific block = both blocks
            term = '2';
            block = 'both';
          } else {
            // Skip other terms
            return;
          }

          // Extract class and role
          let className = '';
          if (title.includes('level 1')) className = 'Level 1';
          else if (title.includes('level 2')) className = 'Level 2';
          else if (title.includes('level 3')) className = 'Level 3';
          else if (title.includes('body movement') && title.includes('open')) className = 'Body Movement';
          else if (title.includes('shines')) className = 'Shines';
          else if (title.includes('unlimited bundle') || title.includes('platinum bundle')) {
            // Bundles include all classes
            customerEnrollments[customerId].has_platinum = true;
            const allClasses = ['Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines'];
            
            // Extract role
            let role = '';
            if (variant.includes('leader')) role = 'Leader';
            else if (variant.includes('follower')) role = 'Follower';
            
            // Add all classes for this bundle
            allClasses.forEach(cls => {
              if (cls === 'Body Movement' || cls === 'Shines') {
                // No role for these classes
                addEnrollment(customerEnrollments[customerId], cls, 'No Role', block, order.id);
              } else if (role) {
                // Level classes need role
                addEnrollment(customerEnrollments[customerId], cls, role, block, order.id);
              }
            });
            return;
          } else {
            return; // Unknown class
          }

          // Extract role for non-bundle classes
          let role = '';
          if (className === 'Body Movement' || className === 'Shines') {
            role = 'No Role';
          } else {
            if (variant.includes('leader')) role = 'Leader';
            else if (variant.includes('follower')) role = 'Follower';
            else return; // Level classes need a role
          }

          // Add enrollment
          addEnrollment(customerEnrollments[customerId], className, role, block, order.id);
        });

        // Store order info
        customerEnrollments[customerId].orders.push({
          order_id: order.id,
          order_date: order.created_at,
          items: order.line_items
        });
      });

      // Helper function to add enrollment
      function addEnrollment(customer, className, role, block, orderId) {
        const enrollment = { class: className, role: role, order_id: orderId };
        
        if (block === 'a') {
          customer.enrollments_2a.push(enrollment);
        } else if (block === 'b') {
          customer.enrollments_2b.push(enrollment);
        } else if (block === 'both') {
          // Term 2 without specific block = enrolled in both
          customer.enrollments_2a.push({...enrollment});
          customer.enrollments_2b.push({...enrollment});
        }
      }

      // Now create the analysis data - grouped by customer
      const enrolled2b = [];
      const notEnrolled2b = [];
      const allCurrent2bEnrollments = [];

      Object.values(customerEnrollments).forEach(customer => {
        // Skip if no Term 2 enrollments at all
        if (customer.enrollments_2a.length === 0 && customer.enrollments_2b.length === 0) {
          return;
        }

        // Check enrollment status
        const hasAny2aEnrollment = customer.enrollments_2a.length > 0;
        const hasAny2bEnrollment = customer.enrollments_2b.length > 0;

        // Get unique classes for 2a and 2b
        const classes2a = [...new Set(customer.enrollments_2a.map(e => e.class))].sort();
        const classes2b = [...new Set(customer.enrollments_2b.map(e => e.class))].sort();
        
        // Get unique roles
        const roles = [...new Set([
          ...customer.enrollments_2a.map(e => e.role),
          ...customer.enrollments_2b.map(e => e.role)
        ])].filter(r => r !== 'No Role').sort();

        // Format classes string
        const formatClasses = (classList) => {
          if (classList.length === 5) return 'All Classes (L1, L2, L3, BM, Shines)';
          if (classList.length === 3 && classList.includes('Level 1') && classList.includes('Level 2') && classList.includes('Level 3')) {
            return 'All Levels (L1, L2, L3)';
          }
          return classList.join(', ');
        };

        // Determine order details based on actual enrolled classes
        let orderDetails = '';
        const allClasses = [...new Set([...classes2a, ...classes2b])];
        if (customer.has_platinum) {
          orderDetails = 'Platinum/Unlimited Bundle';
        } else if (allClasses.length > 1) {
          orderDetails = `Bundle: ${formatClasses(allClasses)}`;
        } else if (allClasses.length === 1) {
          orderDetails = allClasses[0];
        } else {
          orderDetails = 'Individual Class';
        }

        // Get first order ID
        const orderId = customer.orders[0]?.order_id || 
                        customer.enrollments_2a[0]?.order_id || 
                        customer.enrollments_2b[0]?.order_id || 
                        'N/A';

        // Only process for categories 1 and 2 if they have 2a enrollment
        if (hasAny2aEnrollment) {
          if (hasAny2bEnrollment) {
            // Customer has 2a AND is enrolled in at least one 2b class
            enrolled2b.push({
              customer_id: customer.customer_id,
              name: customer.name,
              email: customer.email,
              order_id: orderId,
              class: formatClasses(classes2a),
              role: roles.join(', ') || 'No Role',
              order_details: orderDetails,
              notes: customer.has_platinum ? 'Bundle includes both blocks' : ''
            });
          } else {
            // Customer has 2a but NO 2b enrollments
            notEnrolled2b.push({
              customer_id: customer.customer_id,
              name: customer.name,
              email: customer.email,
              order_id: orderId,
              class: formatClasses(classes2a),
              role: roles.join(', ') || 'No Role',
              order_details: orderDetails,
              notes: ''
            });
          }
        }

        // Add to all current 2b enrollments (if they have any 2b enrollment OR platinum/unlimited)
        if (classes2b.length > 0 || (customer.has_platinum && classes2a.length > 0)) {
          // For platinum/unlimited customers without explicit 2b, their 2b classes are same as 2a classes
          const classes2bToShow = classes2b.length > 0 ? classes2b : classes2a;
          
          allCurrent2bEnrollments.push({
            customer_id: customer.customer_id,
            name: customer.name,
            email: customer.email,
            order_id: orderId,
            class: formatClasses(classes2bToShow),
            role: roles.join(', ') || 'No Role',
            order_details: orderDetails,
            notes: customer.has_platinum && classes2b.length === 0 ? 'Auto-enrolled via bundle' : ''
          });
        }
      });

      // Sort all three categories by class first, then by name
      enrolled2b.sort((a, b) => {
        const classCompare = a.class.localeCompare(b.class);
        if (classCompare !== 0) return classCompare;
        return a.name.localeCompare(b.name);
      });
      
      notEnrolled2b.sort((a, b) => {
        const classCompare = a.class.localeCompare(b.class);
        if (classCompare !== 0) return classCompare;
        return a.name.localeCompare(b.name);
      });
      
      allCurrent2bEnrollments.sort((a, b) => {
        const classCompare = a.class.localeCompare(b.class);
        if (classCompare !== 0) return classCompare;
        return a.name.localeCompare(b.name);
      });

      // Fetch free class students
      showStatus('Fetching free class orders from Shopify...', true);
      
      // Calculate date range (5 weeks before current date)
      const fiveWeeksAgo = new Date();
      fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - (5 * 7));
      const freeClassOrders = await fetchShopifyOrders(fiveWeeksAgo.toISOString());

      // Extract free class students from Shopify orders
      const freeClassStudents = {};
      
      freeClassOrders.forEach(order => {
        order.line_items.forEach(item => {
          const title = item.title.toLowerCase();
          const variant = (item.variant_title || '').toLowerCase();
          
          // Check if it's a free class
          if (title.includes('free class')) {
            const customerId = order.customer?.id;
            if (!customerId) return;
            
            // Extract role from variant
            let role = '';
            if (variant.includes('leader')) role = 'Leader';
            else if (variant.includes('follower')) role = 'Follower';
            
            // Parse date from variant (e.g., "27th May")
            const dateMatch = item.variant_title?.match(/(\d{1,2})(st|nd|rd|th)\s+(\w+)/);
            let classDate = 'Date not parsed';
            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const monthName = dateMatch[3];
              classDate = `${day} ${monthName}`;
            }
            
            if (!freeClassStudents[customerId]) {
              freeClassStudents[customerId] = {
                customer_id: customerId,
                name: 'Unknown',
                email: '',
                hasSignedUp: false,
                classSignedUpTo: '',
                freeClassDates: [],
                freeClassRole: role
              };
            }
            
            // Add this free class date
            freeClassStudents[customerId].freeClassDates.push(classDate);
            if (role && !freeClassStudents[customerId].freeClassRole) {
              freeClassStudents[customerId].freeClassRole = role;
            }
          }
        });
      });

      // Update free class student names from customer data
      Object.keys(freeClassStudents).forEach(customerId => {
        const customerInfo = customersData[customerId];
        if (customerInfo) {
          freeClassStudents[customerId].name = 
            `${customerInfo.first_name || ''} ${customerInfo.last_name || ''}`.trim() || 'Unknown';
          freeClassStudents[customerId].email = customerInfo.email || '';
        }
      });

      // Check which free class students have signed up for paid classes
      Object.keys(freeClassStudents).forEach(customerId => {
        // Convert customerId to number for comparison
        const customerIdNum = parseInt(customerId);
        
        // Check if they're in our enrolled lists
        const inEnrolled = enrolled2b.some(e => e.customer_id === customerIdNum);
        const inNotEnrolled = notEnrolled2b.some(e => e.customer_id === customerIdNum);
        const inAll2b = allCurrent2bEnrollments.some(e => e.customer_id === customerIdNum);
        
        if (inEnrolled || inNotEnrolled || inAll2b) {
          freeClassStudents[customerId].hasSignedUp = true;
          
          // Get their classes from all lists
          const enrolledClasses = [
            ...enrolled2b.filter(e => e.customer_id === customerIdNum),
            ...notEnrolled2b.filter(e => e.customer_id === customerIdNum),
            ...allCurrent2bEnrollments.filter(e => e.customer_id === customerIdNum)
          ].map(e => e.class);
          
          // Remove duplicates and format
          const uniqueClasses = [...new Set(enrolledClasses)];
          freeClassStudents[customerId].classSignedUpTo = uniqueClasses.join(', ');
        }
      });

      // Convert to arrays and sort by name
      const allFreeClassStudents = Object.values(freeClassStudents).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      const freeClassStudentsWhoSignedUp = allFreeClassStudents.filter(s => s.hasSignedUp);
      
      // Filter for free class students who signed up for Term 2a specifically
      const freeClassStudentsIn2a = freeClassStudentsWhoSignedUp.filter(student => {
        const customerIdNum = parseInt(student.customer_id);
        // Check if they're in either the enrolled2b or notEnrolled2b lists (both are from 2a)
        return enrolled2b.some(e => e.customer_id === customerIdNum) || 
               notEnrolled2b.some(e => e.customer_id === customerIdNum);
      });

      // Set the analysis report data
      setEnrollmentAnalysis({
        categories: [
          {
            name: 'Students from 2a who are also enrolled in 2b',
            data: enrolled2b
          },
          {
            name: 'Students from 2a who have NOT enrolled in 2b',
            data: notEnrolled2b
          },
          {
            name: 'All current Term 2b enrollments',
            data: allCurrent2bEnrollments
          },
          {
            name: 'All free class students (past 5 weeks)',
            data: allFreeClassStudents
          },
          {
            name: 'Free class students who signed up for paid classes',
            data: freeClassStudentsWhoSignedUp
          },
          {
            name: 'Free class students who signed up for Term 2a',
            data: freeClassStudentsIn2a
          }
        ],
        summary: {
          totalCustomersAnalyzed: Object.keys(customerEnrollments).length,
          uniqueCustomersEnrolledIn2b: new Set(enrolled2b.map(r => r.customer_id)).size,
          uniqueCustomersNotEnrolledIn2b: new Set(notEnrolled2b.map(r => r.customer_id)).size,
          total2bEnrollmentsFrom2a: enrolled2b.length,
          totalMissing2bEnrollments: notEnrolled2b.length,
          totalAllCurrent2bEnrollments: allCurrent2bEnrollments.length,
          totalFreeClassStudents: allFreeClassStudents.length,
          freeClassConversions: freeClassStudentsWhoSignedUp.length,
          freeClassTo2aConversions: freeClassStudentsIn2a.length
        }
      });

      setShowAnalysisButtons(true);
      showStatus('Generated Term 2b enrollment analysis', true);
    } catch (error) {
      console.error('Analysis error:', error);
      showStatus('Failed to generate enrollment analysis', false);
    } finally {
      setAnalysisLoading(false);
    }
  }

  function resetEnrollmentAnalysis() {
    setEnrollmentAnalysis(null);
    setShowAnalysisButtons(false);
  }

  // Export to CSV
  function exportToCSV(reportType) {
    const csv = [];
    let filename = '';
    
    if (reportType === 'income' && incomeReport) {
      // Headers
      csv.push(['Order #', 'Date', 'Customer ID', 'Items', 'Amount', 'Status']);
      
      // Data rows
      incomeReport.data.forEach(row => {
        csv.push([
          row.orderNumber,
          row.date,
          row.customerId,
          `"${row.items}"`, // Wrap in quotes for comma handling
          `$${row.amount.toFixed(2)}`,
          row.status
        ]);
      });
      
      // Summary
      csv.push([]);
      csv.push(['SUMMARY']);
      csv.push(['Total Orders', incomeReport.summary.totalOrders]);
      csv.push(['Total Income', `$${incomeReport.summary.totalIncome.toFixed(2)}`]);
      
      filename = `income_report_${new Date().toISOString().split('T')[0]}.csv`;
      
    } else if (reportType === 'term2b' && term2bReport) {
      // Headers
      csv.push(['Customer Name', 'Email', 'Classes', 'Role', 'Order Date', 'Amount', 'Order #']);
      
      // Data rows
      term2bReport.data.enrollments.forEach(row => {
        csv.push([
          row.customerName,
          row.email,
          `"${row.classes}"`,
          row.role,
          row.orderDate,
          `$${row.amount.toFixed(2)}`,
          row.orderNumber
        ]);
      });
      
      // Summary
      csv.push([]);
      csv.push(['SUMMARY']);
      csv.push(['Total Enrollments', term2bReport.data.enrollments.length]);
      csv.push(['Unique Students', term2bReport.data.uniqueStudents]);
      
      filename = `term2b_enrollments_${new Date().toISOString().split('T')[0]}.csv`;
      
    } else if (reportType === 'timing' && timingReport) {
      // Headers
      csv.push(['Class Level', 'Early Enrollments', 'Day-of Enrollments', 'Total', '% Day-of']);
      
      // Data rows
      Object.entries(timingReport.data.byClass).forEach(([classLevel, data]) => {
        const percentDayOf = data.total > 0 ? ((data.dayOf / data.total) * 100).toFixed(1) : '0.0';
        csv.push([
          classLevel,
          data.early,
          data.dayOf,
          data.total,
          `${percentDayOf}%`
        ]);
      });
      
      // Summary
      csv.push([]);
      csv.push(['SUMMARY']);
      csv.push(['Total Enrollments', timingReport.data.totalEnrollments]);
      csv.push(['Average Days Early', `${timingReport.data.avgDaysEarly} days`]);
      csv.push(['Most Popular Enrollment Day', timingReport.data.popularDay]);
      csv.push(['Enrollments on Popular Day', timingReport.data.popularDayCount]);
      
      filename = `enrollment_timing_${new Date().toISOString().split('T')[0]}.csv`;
      
    } else if (reportType === 'analysis' && enrollmentAnalysis) {
      // Combined CSV with all categories
      csv.push(['Term 2b Enrollment Analysis']);
      csv.push([`Exported: ${new Date().toLocaleString()}`]);
      csv.push([]);
      
      // Summary at the top
      csv.push(['SUMMARY']);
      csv.push(['Total Customers Analyzed', enrollmentAnalysis.summary.totalCustomersAnalyzed]);
      csv.push(['Unique Customers Enrolled in 2b', enrollmentAnalysis.summary.uniqueCustomersEnrolledIn2b]);
      csv.push(['Unique Customers NOT Enrolled in 2b', enrollmentAnalysis.summary.uniqueCustomersNotEnrolledIn2b]);
      csv.push(['Total 2b Enrollments (from 2a who enrolled)', enrollmentAnalysis.summary.total2bEnrollmentsFrom2a]);
      csv.push(['Total Missing 2b Enrollments', enrollmentAnalysis.summary.totalMissing2bEnrollments]);
      csv.push(['Total All Current 2b Enrollments', enrollmentAnalysis.summary.totalAllCurrent2bEnrollments]);
      csv.push(['Total Free Class Students', enrollmentAnalysis.summary.totalFreeClassStudents]);
      csv.push(['Free Class Conversions', enrollmentAnalysis.summary.freeClassConversions]);
      csv.push(['Free Class to Term 2a Conversions', enrollmentAnalysis.summary.freeClassTo2aConversions]);
      csv.push([]);
      
      // Headers for detailed data
      csv.push(['Customer ID', 'Name', 'Email', 'Order ID', 'Class', 'Role', 'Order Details', 'Notes', 'Category']);
      
      // Add data from each category
      enrollmentAnalysis.categories.forEach(category => {
        category.data.forEach(row => {
          // Handle different data structures
          if (row.freeClassDates) {
            // Free class student format
            csv.push([
              row.customer_id,
              row.name,
              row.email,
              '', // No order ID for free class view
              row.classSignedUpTo || '-',
              row.freeClassRole || '-',
              `Free classes: ${row.freeClassDates.slice(0, 3).join(', ')}${row.freeClassDates.length > 3 ? '...' : ''}`,
              row.hasSignedUp ? 'Converted to paid' : 'Not converted',
              category.name
            ]);
          } else {
            // Regular enrollment format
            csv.push([
              row.customer_id,
              row.name,
              row.email,
              row.order_id,
              row.class,
              row.role,
              row.order_details,
              row.notes,
              category.name
            ]);
          }
        });
      });
      
      filename = `term2b_enrollment_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    }
    
    // Download CSV
    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showStatus(`Exported ${filename}`, true);
  }

  // Set default date on mount
  useEffect(() => {
    const dateInput = document.getElementById('income-from-date');
    if (dateInput) {
      dateInput.value = '2025-01-01';
    }
  }, []);

  return (
    <div style={{ padding: '4rem 0' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '3rem'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-gold) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Reports Dashboard
        </h1>
        <a
          href="/console"
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.transform = 'translateX(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          ← Back to Console
        </a>
      </div>

      {/* Income Report */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '2rem',
        marginBottom: '2rem',
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
          background: 'linear-gradient(90deg, var(--accent-coral), var(--accent-gold))',
          opacity: '0.7'
        }}></div>
        
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          marginBottom: '1.5rem',
          color: 'var(--accent-coral)'
        }}>
          Income Report
        </h2>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <label style={{ color: 'var(--text-secondary)' }}>From Date:</label>
          <input
            type="date"
            id="income-from-date"
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <button
            onClick={generateIncomeReport}
            disabled={incomeLoading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'var(--accent-coral)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: incomeLoading ? 'not-allowed' : 'pointer',
              opacity: incomeLoading ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Generate Report
          </button>
          {showIncomeButtons && (
            <>
              <button
                onClick={() => exportToCSV('income')}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Export to CSV
              </button>
              <button
                onClick={resetIncomeReport}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Reset
              </button>
            </>
          )}
        </div>
        
        {incomeLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading data from Shopify...
          </div>
        )}
        
        {incomeReport && (
          <div>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '1rem'
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Order #</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Date</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Customer ID</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Items</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Amount</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-coral)'
                  }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {incomeReport.data.map((row, index) => (
                  <tr key={index} style={{
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.orderNumber}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.customerId}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.items}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      ${row.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Total Orders:</strong> {incomeReport.summary.totalOrders}
              </div>
              <div>
                <h3 style={{
                  color: 'var(--success)',
                  fontSize: '1.5rem'
                }}>
                  Total Income: ${incomeReport.summary.totalIncome.toFixed(2)}
                </h3>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Term 2b Enrollments Report */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '2rem',
        marginBottom: '2rem',
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
          background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-coral))',
          opacity: '0.7'
        }}></div>
        
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-gold)'
        }}>
          Term 2b Enrollments
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          All Term 2b enrollments including Platinum/Unlimited bundles
        </p>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={generateTerm2bReport}
            disabled={term2bLoading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'var(--accent-gold)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: term2bLoading ? 'not-allowed' : 'pointer',
              opacity: term2bLoading ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Generate Report
          </button>
          {showTerm2bButtons && (
            <>
              <button
                onClick={() => exportToCSV('term2b')}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Export to CSV
              </button>
              <button
                onClick={resetTerm2bReport}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Reset
              </button>
            </>
          )}
        </div>
        
        {term2bLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading data from Shopify and Supabase...
          </div>
        )}
        
        {term2bReport && (
          <div>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '1rem'
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Customer Name</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Email</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Classes</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Role</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Order Date</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Amount</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-gold)'
                  }}>Order #</th>
                </tr>
              </thead>
              <tbody>
                {term2bReport.data.enrollments.map((row, index) => (
                  <tr key={index} style={{
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.customerName}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.email}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.classes}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.role}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.orderDate}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      ${row.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                      {row.orderNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Total Enrollments:</strong> {term2bReport.data.enrollments.length}
              </div>
              <div>
                <strong>Unique Students:</strong> {term2bReport.data.uniqueStudents}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enrollment Timing Analysis */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '2rem',
        marginBottom: '2rem',
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
          background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-coral))',
          opacity: '0.7'
        }}></div>
        
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-teal)'
        }}>
          Enrollment Timing Analysis
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Analyze when students sign up for Term 2b classes relative to class start date (June 10th)
        </p>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={generateEnrollmentTimingReport}
            disabled={timingLoading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'var(--accent-teal)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: timingLoading ? 'not-allowed' : 'pointer',
              opacity: timingLoading ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Generate Report
          </button>
          {showTimingButtons && (
            <>
              <button
                onClick={() => exportToCSV('timing')}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Export to CSV
              </button>
              <button
                onClick={resetTimingReport}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Reset
              </button>
            </>
          )}
        </div>
        
        {timingLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading enrollment data...
          </div>
        )}
        
        {timingReport && (
          <div>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '1rem'
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-teal)'
                  }}>Class Level</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-teal)'
                  }}>Early Enrollments</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-teal)'
                  }}>Day-of Enrollments</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-teal)'
                  }}>Total</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    fontWeight: '600',
                    color: 'var(--accent-teal)'
                  }}>% Day-of</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(timingReport.data.byClass).map(([classLevel, data]) => {
                  const percentDayOf = data.total > 0 ? ((data.dayOf / data.total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={classLevel} style={{
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {classLevel}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {data.early}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {data.dayOf}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {data.total}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {percentDayOf}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <strong>Total Enrollments:</strong> {timingReport.data.totalEnrollments}
              </div>
              <div>
                <strong>Average Days Early:</strong> {timingReport.data.avgDaysEarly} days
              </div>
              <div>
                <strong>Most Popular Day:</strong> {timingReport.data.popularDay}
              </div>
              <div>
                <strong>Enrollments on {timingReport.data.popularDay}:</strong> {timingReport.data.popularDayCount}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Term 2b Enrollment Analysis */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '2rem',
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
          background: 'linear-gradient(90deg, var(--accent-warm), var(--accent-gold))',
          opacity: '0.7'
        }}></div>
        
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-warm)'
        }}>
          Term 2b Enrollment Analysis
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Comprehensive analysis of Term 2a to 2b transitions and free class conversions
        </p>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={generateEnrollmentAnalysis}
            disabled={analysisLoading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'var(--accent-warm)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: analysisLoading ? 'not-allowed' : 'pointer',
              opacity: analysisLoading ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Generate Analysis
          </button>
          {showAnalysisButtons && (
            <>
              <button
                onClick={() => exportToCSV('analysis')}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Export to CSV
              </button>
              <button
                onClick={resetEnrollmentAnalysis}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Reset
              </button>
            </>
          )}
        </div>
        
        {analysisLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Analyzing enrollment data from Shopify and Supabase...
          </div>
        )}
        
        {enrollmentAnalysis && (
          <div>
            {/* Summary Section */}
            <div style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)'
            }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--accent-warm)' }}>Analysis Summary</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <strong>Total Customers Analyzed:</strong> {enrollmentAnalysis.summary.totalCustomersAnalyzed}
                </div>
                <div>
                  <strong>Enrolled in 2b:</strong> {enrollmentAnalysis.summary.uniqueCustomersEnrolledIn2b}
                </div>
                <div>
                  <strong>NOT Enrolled in 2b:</strong> {enrollmentAnalysis.summary.uniqueCustomersNotEnrolledIn2b}
                </div>
                <div>
                  <strong>Free Class Students:</strong> {enrollmentAnalysis.summary.totalFreeClassStudents}
                </div>
                <div>
                  <strong>Free to Paid Conversions:</strong> {enrollmentAnalysis.summary.freeClassConversions}
                </div>
                <div>
                  <strong>Free to Term 2a:</strong> {enrollmentAnalysis.summary.freeClassTo2aConversions}
                </div>
              </div>
            </div>
            
            {/* Category Sections */}
            {enrollmentAnalysis.categories.map((category, categoryIndex) => (
              <details key={categoryIndex} style={{ marginBottom: '1rem' }}>
                <summary style={{
                  padding: '1rem',
                  background: 'var(--glass-bg)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{category.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>({category.data.length} records)</span>
                </summary>
                
                <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '800px'
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Customer ID</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Name</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Email</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Class/Status</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Role</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Details</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          fontWeight: '600',
                          color: 'var(--accent-warm)'
                        }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.data.map((row, index) => (
                        <tr key={index} style={{
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.customer_id}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.name}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.email}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.class || row.classSignedUpTo || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.role || row.freeClassRole || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.order_details || (row.freeClassDates ? `Free: ${row.freeClassDates.slice(0, 2).join(', ')}${row.freeClassDates.length > 2 ? '...' : ''}` : '-')}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                            {row.notes || (row.hasSignedUp !== undefined ? (row.hasSignedUp ? 'Converted' : 'Not converted') : '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.includes('Failed') 
            ? 'var(--accent-warm)' 
            : 'var(--success)',
          color: 'white',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          zIndex: 1000,
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default Reports;