import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function Reports() {
  const [message, setMessage] = useState('');
  
  // Global data storage
  const [globalData] = useState({
    orders: [],
    customers: {},
    lastFetch: null
  });

  // Report states
  const [incomeReport, setIncomeReport] = useState(null);
  const [timingReport, setTimingReport] = useState(null);
  const [enrollmentAnalysis, setEnrollmentAnalysis] = useState(null);

  // Show/hide states for buttons
  const [showIncomeButtons, setShowIncomeButtons] = useState(false);
  const [showTimingButtons, setShowTimingButtons] = useState(false);
  const [showAnalysisButtons, setShowAnalysisButtons] = useState(false);

  // Loading states for each report
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [timingLoading, setTimingLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Income report filters
  const [manualFromDate, setManualFromDate] = useState('');
  const [manualToDate, setManualToDate] = useState('');
  
  // State for Term Enrollments Report
  const [enrollmentClassFilter, setEnrollmentClassFilter] = useState('all');
  const [enrollmentTermFilter, setEnrollmentTermFilter] = useState('2');
  const [enrollmentBlockFilter, setEnrollmentBlockFilter] = useState('both');
  const [termEnrollmentsReport, setTermEnrollmentsReport] = useState(null);
  const [termEnrollmentsLoading, setTermEnrollmentsLoading] = useState(false);
  const [showTermEnrollmentsButtons, setShowTermEnrollmentsButtons] = useState(false);
  
  // State for Social Attendees Report
  const [socialAttendeesReport, setSocialAttendeesReport] = useState(null);
  const [socialAttendeesLoading, setSocialAttendeesLoading] = useState(false);
  const [showSocialAttendeesButtons, setShowSocialAttendeesButtons] = useState(false);

  // Term schedule for 2025 - these dates are for reference only
  // In term mode, we filter by the term/block in the product variant, not order date
  const TERM_SCHEDULE_2025 = {
    '1': {
      'A': { start: '2025-02-03', end: '2025-03-07' },
      'B': { start: '2025-03-10', end: '2025-04-11' }
    },
    '2': {
      'A': { start: '2025-05-05', end: '2025-06-06' },
      'B': { start: '2025-06-10', end: '2025-07-11' }
    },
    '3': {
      'A': { start: '2025-07-28', end: '2025-08-29' },
      'B': { start: '2025-09-01', end: '2025-10-03' }
    },
    '4': {
      'A': { start: '2025-10-20', end: '2025-11-21' },
      'B': { start: '2025-11-24', end: '2025-12-19' }
    }
  };

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
  function showStatus(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  // Parse date from variant title (e.g., "27th May" -> "2025-05-27")
  function parseClassDate(variantTitle) {
    if (!variantTitle) return null;
    
    // Extract date pattern like "27th May", "3rd June", etc.
    const dateMatch = variantTitle.match(/(\d{1,2})(st|nd|rd|th)\s+(\w+)/);
    if (!dateMatch) {
      return null;
    }
    
    const day = parseInt(dateMatch[1]);
    const monthName = dateMatch[3];
    
    // Month mapping
    const months = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12',
      // Short versions
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const month = months[monthName];
    if (!month) {
      return null;
    }
    
    // Simply format as YYYY-MM-DD string without using Date object
    const year = new Date().getFullYear();
    const result = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    
    return result;
  }

  // Get date range based on mode
  function getDateRange() {
    if (dateMode === 'manual') {
      return {
        from: manualFromDate ? new Date(manualFromDate) : null,
        to: manualToDate ? new Date(manualToDate) : new Date()
      };
    } else {
      // Term mode
      const schedule = TERM_SCHEDULE_2025[selectedTerm];
      if (!schedule) return { from: null, to: null };
      
      if (selectedBlock === 'both') {
        return {
          from: new Date(schedule['A'].start),
          to: new Date(schedule['B'].end)
        };
      } else {
        return {
          from: new Date(schedule[selectedBlock].start),
          to: new Date(schedule[selectedBlock].end)
        };
      }
    }
  }

  // Filter and process orders by class type and term/block
  function filterAndProcessOrdersByClassTypeAndTerm(orders, classType, termFilter = null) {
    const processedOrders = [];
    
    orders.forEach(order => {
      // First filter by term/block if in term mode
      let itemsAfterTermFilter = order.line_items;
      
      if (termFilter) {
        itemsAfterTermFilter = order.line_items.filter(item => {
          const variant = (item.variant_title || '').toLowerCase();
          const title = item.title.toLowerCase();
          
          // Special handling for free classes - they have dates, not terms
          if (title.includes('free class')) {
            const classDate = parseClassDate(item.variant_title);
            if (!classDate) return false;
            
            // Get term dates from TERM_SCHEDULE_2025
            const termKey = `term${termFilter.term}`;
            const termData = TERM_SCHEDULE_2025[termKey];
            if (!termData) return false;
            
            // Check which block period the class date falls in
            const classDateObj = new Date(classDate + 'T00:00:00');
            
            if (termFilter.block === 'both') {
              // Check if date is in either block A or B
              const blockAStart = new Date(termData.blockA.start + 'T00:00:00');
              const blockAEnd = new Date(termData.blockA.end + 'T00:00:00');
              const blockBStart = new Date(termData.blockB.start + 'T00:00:00');
              const blockBEnd = new Date(termData.blockB.end + 'T00:00:00');
              
              return (classDateObj >= blockAStart && classDateObj <= blockAEnd) ||
                     (classDateObj >= blockBStart && classDateObj <= blockBEnd);
            } else {
              // Check specific block
              const blockKey = `block${termFilter.block}`;
              const blockData = termData[blockKey];
              if (!blockData) return false;
              
              const blockStart = new Date(blockData.start + 'T00:00:00');
              const blockEnd = new Date(blockData.end + 'T00:00:00');
              
              return classDateObj >= blockStart && classDateObj <= blockEnd;
            }
          }
          
          // Regular term-based filtering for other products
          // Extract term and block from variant
          let itemTerm = null;
          let itemBlock = null;
          
          // Check for term patterns
          const termMatch = variant.match(/term (\d+)([ab]?)/);
          if (termMatch) {
            itemTerm = termMatch[1];
            itemBlock = termMatch[2] ? termMatch[2].toUpperCase() : null;
            
            // If variant says "term 2" without block, it's both blocks
            if (!itemBlock && variant.includes(`term ${itemTerm}`) && !variant.includes(`term ${itemTerm}a`) && !variant.includes(`term ${itemTerm}b`)) {
              itemBlock = 'both';
            }
          }
          
          // Skip items without term info (unless they're free classes which we already handled)
          if (!itemTerm) return false;
          
          // Filter based on term/block
          if (termFilter.term !== itemTerm) return false;
          
          if (termFilter.block === 'both') {
            // Include items for block A, B, or both
            return true;
          } else {
            // Must match specific block or be for both blocks
            return itemBlock === termFilter.block || itemBlock === 'both';
          }
        });
      }
      
      // Then filter by class type
      const filteredItems = itemsAfterTermFilter.filter(item => {
        const title = item.title.toLowerCase();
        
        // For 'all', include only recognized dance classes and products
        if (classType === 'all') {
          return title.includes('level 1') || 
                 title.includes('level 2') || 
                 title.includes('level 3') || 
                 (title.includes('body movement') && title.includes('open')) || 
                 title.includes('shines') || 
                 title.includes('bundle') || 
                 title.includes('free class') || 
                 title.includes('one class pass');
        }
        
        switch(classType) {
          case 'level1':
            return title.includes('level 1');
          case 'level2':
            return title.includes('level 2');
          case 'level3':
            return title.includes('level 3');
          case 'bodymovement':
            return title.includes('body movement') && title.includes('open');
          case 'shines':
            return title.includes('shines');
          case 'bundles':
            return title.includes('bundle');
          case 'free':
            return title.includes('free class');
          case 'oneclass':
            return title.includes('one class pass');
          default:
            return false;
        }
      });
      
      // Only include order if it has matching items
      if (filteredItems.length > 0) {
        // Calculate the proportion of filtered items to total items
        const filteredItemsValue = filteredItems.reduce((sum, item) => 
          sum + parseFloat(item.price || 0) * (item.quantity || 1), 0
        );
        
        const totalItemsValue = order.line_items.reduce((sum, item) => 
          sum + parseFloat(item.price || 0) * (item.quantity || 1), 0
        );
        
        // Calculate proportional discount
        let filteredTotal = filteredItemsValue;
        if (order.total_discounts && totalItemsValue > 0) {
          const discountProportion = filteredItemsValue / totalItemsValue;
          const proportionalDiscount = parseFloat(order.total_discounts || 0) * discountProportion;
          filteredTotal = filteredItemsValue - proportionalDiscount;
        }
        
        processedOrders.push({
          ...order,
          filtered_line_items: filteredItems,
          filtered_total: filteredTotal,
          items_display: filteredItems.map(item => {
            const variant = item.variant_title || '';
            return `${item.title} (${variant})`;
          }).join(', '),
          original_total: parseFloat(order.total_price || 0)
        });
      }
    });
    
    return processedOrders;
  }

  // Income Report Functions
  async function generateIncomeReport() {
    setIncomeLoading(true);
    
    try {
      if (!manualFromDate) {
        showStatus('Please select a from date', false);
        setIncomeLoading(false);
        return;
      }
      
      const dateRange = getDateRange();
      const orders = await fetchShopifyOrders(dateRange.from?.toISOString());
      
      // Apply date filter on order creation date
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return (!dateRange.from || orderDate >= dateRange.from) && 
               (!dateRange.to || orderDate <= dateRange.to);
      });
      
      const displayDateRange = {
        from: dateRange.from?.toLocaleDateString() || 'Start',
        to: dateRange.to?.toLocaleDateString() || 'Today'
      };

      // Process orders for display
      const reportData = filteredOrders.map(order => ({
        orderNumber: order.order_number || order.name,
        date: new Date(order.created_at).toLocaleDateString(),
        customerId: order.customer?.id || 'N/A',
        items: order.line_items.map(item => {
          const variant = item.variant_title || '';
          return `${item.title} (${variant})`;
        }).join(', '),
        amount: parseFloat(order.total_price || 0),
        status: order.financial_status || 'paid'
      }));

      // Calculate totals
      const totalIncome = reportData.reduce((sum, order) => sum + order.amount, 0);

      setIncomeReport({
        data: reportData,
        summary: {
          totalOrders: reportData.length,
          totalIncome,
          dateRange: displayDateRange
        }
      });

      setShowIncomeButtons(true);
      showStatus(`Generated income report: ${reportData.length} orders`, true);
    } catch (error) {
      console.error('Error generating income report:', error);
      showStatus('Failed to generate income report', false);
    } finally {
      setIncomeLoading(false);
    }
  }

  function resetIncomeReport() {
    setIncomeReport(null);
    setShowIncomeButtons(false);
    setManualFromDate('');
    setManualToDate('');
  }

  // Term Enrollments Report Functions
  async function generateTermEnrollmentsReport() {
    setTermEnrollmentsLoading(true);
    
    try {
      // Fetch orders
      const orders = await fetchShopifyOrders();
      
      // Structure to hold enrollment data
      const enrollmentData = {};
      const uniqueCustomers = new Set();
      
      // IMPORTANT: Bundle Logic
      // - Platinum and Unlimited bundles span BOTH blocks
      // - When filtering by Block A: Include bundles (students can attend Block A)
      // - When filtering by Block B: Include bundles (students can attend Block B)
      // - When filtering by Both Blocks: Include bundles once (not double-counted)
      
      orders.forEach(order => {
        const customerId = order.customer?.id;
        if (!customerId) return;
        
        // Skip orders with pending payment
        if (order.financial_status === 'pending') {
          console.log(`Skipping order ${order.order_number} - payment pending for customer ${customerId}`);
          return;
        }
        
        order.line_items.forEach(item => {
          const title = item.title.toLowerCase();
          const variant = (item.variant_title || '').toLowerCase();
          
          // Skip free classes and one class passes for this report
          if (title.includes('free class') || title.includes('one class pass')) return;
          
          // Extract term and block from variant
          let itemTerm = null;
          let itemBlock = null;
          
          const termMatch = variant.match(/term (\d+)([ab]?)/);
          if (termMatch) {
            itemTerm = termMatch[1];
            itemBlock = termMatch[2] ? termMatch[2].toUpperCase() : null;
            
            // If no block specified, it's both blocks
            if (!itemBlock && variant.includes(`term ${itemTerm}`) && 
                !variant.includes(`term ${itemTerm}a`) && 
                !variant.includes(`term ${itemTerm}b`)) {
              itemBlock = 'both';
            }
          }
          
          // Skip if no term info
          if (!itemTerm) return;
          
          // Apply term filter
          if (enrollmentTermFilter !== 'all' && itemTerm !== enrollmentTermFilter) return;
          
          // Check if this is a bundle BEFORE applying block filter
          const isBundle = title.includes('bundle');
          
          // Apply block filter - but bundles always pass because they span both blocks
          if (!isBundle && enrollmentBlockFilter !== 'both') {
            if (itemBlock !== enrollmentBlockFilter && itemBlock !== 'both') return;
          }
          
          // When filter is "both", we want to include all blocks (A, B, and both)
          // So no filtering needed when enrollmentBlockFilter === 'both'
          
          // Determine class type
          let classType = null;
          let role = '';
          
          if (title.includes('level 1')) {
            classType = 'Level 1';
          } else if (title.includes('level 2')) {
            classType = 'Level 2';
          } else if (title.includes('level 3')) {
            classType = 'Level 3';
          } else if (title.includes('body movement') && title.includes('open')) {
            classType = 'Body Movement';
            role = 'N/A';
          } else if (title.includes('shines')) {
            classType = 'Shines';
            role = 'N/A';
          } else if (title.includes('bundle')) {
            classType = title.includes('platinum') ? 'Platinum Bundle' : 'Unlimited Bundle';
            // Bundles include all classes
            console.log(`Bundle detected: ${title}, variant: ${variant}`);
          }
          
          if (!classType) return;
          
          // Apply class filter
          if (enrollmentClassFilter !== 'all') {
            if (enrollmentClassFilter === 'level1' && classType !== 'Level 1') return;
            if (enrollmentClassFilter === 'level2' && classType !== 'Level 2') return;
            if (enrollmentClassFilter === 'level3' && classType !== 'Level 3') return;
            if (enrollmentClassFilter === 'bodymovement' && classType !== 'Body Movement') return;
            if (enrollmentClassFilter === 'shines' && classType !== 'Shines') return;
          }
          
          // Extract role for all classes (including bundles)
          if (!role) {
            if (variant.includes('leader')) role = 'Leader';
            else if (variant.includes('follower')) role = 'Follower';
          }
          
          // Create key for grouping
          const termKey = enrollmentTermFilter === 'all' ? itemTerm : enrollmentTermFilter;
          
          // When filter is "both", we want to show data for both blocks separately
          // When filter is specific (A or B), we only show that block
          
          // Determine which blocks to add this enrollment to
          const blocksToAdd = [];
          
          if (enrollmentBlockFilter === 'both') {
            // Show in appropriate blocks
            if (isBundle) {
              // Bundles ALWAYS appear in both blocks
              blocksToAdd.push('A', 'B');
            } else if (itemBlock === 'both') {
              // Classes marked as "both" appear in both blocks
              blocksToAdd.push('A', 'B');
            } else if (itemBlock) {
              // Regular classes appear in their specific block
              blocksToAdd.push(itemBlock);
            }
          } else {
            // Specific block filter - only show if it matches
            if (isBundle || itemBlock === 'both' || itemBlock === enrollmentBlockFilter) {
              blocksToAdd.push(enrollmentBlockFilter);
            }
          }
          
          // Add enrollment to each relevant block
          blocksToAdd.forEach(block => {
            const groupKey = `Term ${termKey} - Block ${block}`;
            
            if (!enrollmentData[groupKey]) {
              enrollmentData[groupKey] = {};
            }
            
            // Handle bundles specially - they get access to ALL classes
            if (classType.includes('Bundle')) {
              // Bundle students attend ALL classes
              const bundleClasses = ['Level 1', 'Level 2', 'Level 3', 'Body Movement', 'Shines'];
              
              // Add this bundle student to each class they have access to
              bundleClasses.forEach(bundleClass => {
                if (!enrollmentData[groupKey][bundleClass]) {
                  enrollmentData[groupKey][bundleClass] = {};
                }
                
                // For Level classes, we need to track by role
                if (bundleClass.includes('Level')) {
                  if (!enrollmentData[groupKey][bundleClass][role]) {
                    enrollmentData[groupKey][bundleClass][role] = new Set();
                  }
                  enrollmentData[groupKey][bundleClass][role].add(customerId);
                } else {
                  // Body Movement and Shines don't have roles
                  if (!enrollmentData[groupKey][bundleClass].customers) {
                    enrollmentData[groupKey][bundleClass] = { total: 0, customers: new Set() };
                  }
                  enrollmentData[groupKey][bundleClass].customers.add(customerId);
                  enrollmentData[groupKey][bundleClass].total = enrollmentData[groupKey][bundleClass].customers.size;
                }
              });
              
              // Also track the bundle type itself for reporting
              if (!enrollmentData[groupKey][classType]) {
                enrollmentData[groupKey][classType] = { total: 0, customers: new Set() };
              }
              enrollmentData[groupKey][classType].customers.add(customerId);
              enrollmentData[groupKey][classType].total = enrollmentData[groupKey][classType].customers.size;
              
              // Debug logging for bundles
              console.log(`Bundle enrolled: ${classType} in ${groupKey}, Customer: ${customerId}, Role: ${role || 'No role'}`);
              
              // Add to unique customers
              uniqueCustomers.add(customerId);
            } else {
              // Regular classes
              if (!enrollmentData[groupKey][classType]) {
                enrollmentData[groupKey][classType] = {};
              }
              
              if (role === 'N/A') {
                if (!enrollmentData[groupKey][classType].total) {
                  enrollmentData[groupKey][classType] = { total: 0, customers: new Set() };
                }
                enrollmentData[groupKey][classType].customers.add(customerId);
                enrollmentData[groupKey][classType].total = enrollmentData[groupKey][classType].customers.size;
              } else if (role) {
                if (!enrollmentData[groupKey][classType][role]) {
                  enrollmentData[groupKey][classType][role] = new Set();
                }
                enrollmentData[groupKey][classType][role].add(customerId);
              }
              
              // Add to unique customers
              uniqueCustomers.add(customerId);
            }
          });
        });
      });
      
      // Convert Sets to counts and format for display
      const formattedData = {};
      
      // Sort term/block keys
      const sortedTermBlocks = Object.keys(enrollmentData).sort((a, b) => {
        // Extract term and block from keys like "Term 2 - Block A"
        const parseKey = (key) => {
          const termMatch = key.match(/Term (\d+)/);
          const blockMatch = key.match(/Block ([AB])|Both Blocks/);
          
          const term = termMatch ? parseInt(termMatch[1]) : 0;
          const block = blockMatch ? (blockMatch[1] || 'C') : 'C'; // C for "Both Blocks" to sort last
          
          return { term, block };
        };
        
        const aData = parseKey(a);
        const bData = parseKey(b);
        
        // Sort by term first
        if (aData.term !== bData.term) {
          return aData.term - bData.term;
        }
        
        // Then by block (A < B < Both)
        return aData.block.localeCompare(bData.block);
      });
      
      // Define class order: Level classes first, then Body Movement/Shines, then Bundles
      const classOrder = [
        'Level 1', 'Level 2', 'Level 3', 
        'Body Movement', 'Shines', 
        'Platinum Bundle', 'Unlimited Bundle'
      ];
      
      // Process each term/block in sorted order
      sortedTermBlocks.forEach(termBlock => {
        formattedData[termBlock] = {};
        
        // Sort classes within each term/block
        const sortedClasses = Object.keys(enrollmentData[termBlock]).sort((a, b) => {
          const aIndex = classOrder.indexOf(a);
          const bIndex = classOrder.indexOf(b);
          
          // If both are in the order list, use that order
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          
          // If one is not in the list, put it at the end
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          
          // Fallback to alphabetical
          return a.localeCompare(b);
        });
        
        // Process each class in sorted order
        sortedClasses.forEach(className => {
          // Skip bundle entries - they're already counted in the individual classes
          if (className.includes('Bundle')) {
            return;
          }
          
          const data = enrollmentData[termBlock][className];
          
          if (data.total !== undefined) {
            // Classes without roles
            formattedData[termBlock][className] = {
              total: data.total,
              customers: data.customers,
              display: `${data.total} students`
            };
          } else {
            // Classes with roles
            const leaders = data.Leader ? data.Leader.size : 0;
            const followers = data.Follower ? data.Follower.size : 0;
            // Check for students with no role (from bundles)
            const noRole = data[''] ? data[''].size : 0;
            const total = leaders + followers + noRole;
            
            formattedData[termBlock][className] = {
              leaders,
              followers,
              total,
              Leader: data.Leader,
              Follower: data.Follower,
              display: `${leaders} Leaders, ${followers} Followers (${total} total)`
            };
            
            if (noRole > 0) {
              console.warn(`${className} in ${termBlock} has ${noRole} students with no role (likely from bundles)`);
            }
            
            // Debug: Log actual customer IDs for Level 1 Block B
            if (className === 'Level 1' && termBlock.includes('Block B')) {
              console.log(`\nDEBUG: ${className} in ${termBlock} customer IDs:`);
              if (data.Leader) {
                console.log(`Leaders (${data.Leader.size}):`, Array.from(data.Leader));
              }
              if (data.Follower) {
                console.log(`Followers (${data.Follower.size}):`, Array.from(data.Follower));
              }
              if (data['']) {
                console.log(`No role (${data[''].size}):`, Array.from(data['']));
              }
            }
          }
        });
      });
      
      setTermEnrollmentsReport({
        data: formattedData,
        totalUniqueStudents: uniqueCustomers.size,
        filters: {
          class: enrollmentClassFilter,
          term: enrollmentTermFilter,
          block: enrollmentBlockFilter
        }
      });
      
      // Log summary for debugging
      console.log('Term Enrollments Report Summary:');
      console.log(`Filter - Term: ${enrollmentTermFilter}, Block: ${enrollmentBlockFilter}, Class: ${enrollmentClassFilter}`);
      console.log(`Total unique students: ${uniqueCustomers.size}`);
      
      // Debug: Log raw enrollment data to check bundle distribution
      console.log('\nRaw enrollment data:');
      Object.entries(enrollmentData).forEach(([termBlock, classes]) => {
        console.log(`\n${termBlock} (raw):`);
        let blockUniqueStudents = new Set();
        Object.entries(classes).forEach(([className, data]) => {
          if (className === '_uniqueStudents') return;
          
          let classCount = 0;
          if (data.total !== undefined) {
            classCount = data.total;
            if (data.customers) {
              for (const id of data.customers) {
                blockUniqueStudents.add(id);
              }
            }
          } else {
            const leaders = data.Leader ? data.Leader.size : 0;
            const followers = data.Follower ? data.Follower.size : 0;
            classCount = leaders + followers;
            if (data.Leader) {
              for (const id of data.Leader) {
                blockUniqueStudents.add(id);
              }
            }
            if (data.Follower) {
              for (const id of data.Follower) {
                blockUniqueStudents.add(id);
              }
            }
          }
          console.log(`  ${className}: ${classCount} students`);
        });
        console.log(`  Block unique total: ${blockUniqueStudents.size}`);
      });
      
      console.log('\nFormatted data:');
      Object.entries(formattedData).forEach(([termBlock, classes]) => {
        console.log(`\n${termBlock}:`);
        Object.entries(classes).forEach(([className, data]) => {
          console.log(`  ${className}: ${data.display || data.total + ' students'}`);
        });
      });
      
      setShowTermEnrollmentsButtons(true);
      setTermEnrollmentsLoading(false);
      showStatus(`Generated enrollment report: ${uniqueCustomers.size} unique students`, true);
    } catch (error) {
      console.error('Error generating term enrollments report:', error);
      showStatus('Failed to generate enrollment report', false);
      setTermEnrollmentsLoading(false);
    }
  }
  
  function resetTermEnrollmentsReport() {
    setTermEnrollmentsReport(null);
    setShowTermEnrollmentsButtons(false);
    setEnrollmentClassFilter('all');
    setEnrollmentTermFilter('2');
    setEnrollmentBlockFilter('both');
  }

  // Social Attendees Report Functions
  async function generateSocialAttendeesReport() {
    setSocialAttendeesLoading(true);
    showStatus('Fetching social attendees...', true);
    
    try {
      const orders = await fetchShopifyOrders();
      
      // Fetch customer data from database
      const customerMap = await fetchCustomers();
      
      // Debug: Log some orders to see the structure
      console.log('DEBUG: Sample orders for social search:');
      orders.slice(0, 5).forEach(order => {
        order.line_items.forEach(item => {
          if (item.title.toLowerCase().includes('social') || item.title.toLowerCase().includes('locomojo')) {
            console.log('Found social item:', {
              orderNumber: order.order_number,
              title: item.title,
              variant: item.variant_title,
              quantity: item.quantity,
              customer: order.customer
            });
          }
        });
      });
      
      // Filter orders that contain the social event
      const socialOrders = [];
      
      orders.forEach((order, index) => {
        let totalTickets = 0;
        let hasSocialItem = false;
        
        order.line_items.forEach(item => {
          // Check if this is the social event
          if (item.title.toLowerCase().includes('locomojo first social') || 
              (item.title.toLowerCase().includes('social') && item.title.toLowerCase().includes('june 14'))) {
            hasSocialItem = true;
            totalTickets += item.quantity || 1;
          }
        });
        
        if (hasSocialItem) {
          // Debug log to see the full order structure
          if (index < 5) { // Log first 5 orders for debugging
            console.log(`DEBUG Social Order ${index + 1}:`, {
              order_number: order.order_number,
              name: order.name,
              customer: order.customer,
              customer_id: order.customer?.id,
              has_customer: !!order.customer,
              email: order.email,
              contact_email: order.contact_email,
              customer_email: order.customer?.email,
              line_items: order.line_items.map(item => ({
                title: item.title,
                quantity: item.quantity
              }))
            });
          }
          
          const customerId = order.customer?.id;
          const dbCustomer = customerId ? customerMap[customerId] : null;
          
          socialOrders.push({
            orderNumber: order.order_number || order.name,
            customerId: customerId || 'No ID',
            name: dbCustomer ? 
              `${dbCustomer.first_name || ''} ${dbCustomer.last_name || ''}`.trim() : 
              'Unknown',
            email: dbCustomer?.email || order.customer?.email || order.email || order.contact_email || 'No email',
            ticketCount: totalTickets,
            status: order.financial_status
          });
        }
      });
      
      setSocialAttendeesReport({
        attendees: socialOrders,
        summary: {
          totalAttendees: socialOrders.length,
          totalTickets: socialOrders.reduce((sum, order) => sum + order.ticketCount, 0)
        }
      });
      
      setShowSocialAttendeesButtons(true);
      showStatus(`Found ${socialOrders.length} orders for the social event`, true);
    } catch (error) {
      console.error('Error generating social attendees report:', error);
      showStatus('Failed to generate social attendees report', false);
    } finally {
      setSocialAttendeesLoading(false);
    }
  }
  
  function resetSocialAttendeesReport() {
    setSocialAttendeesReport(null);
    setShowSocialAttendeesButtons(false);
  }

  function exportSocialAttendeesToCSV() {
    if (!socialAttendeesReport) return;
    
    const csv = [];
    
    // Headers
    csv.push(['Social Attendees Report']);
    csv.push([`LocoMojo First Social - June 14th`]);
    csv.push([`Generated: ${new Date().toLocaleString()}`]);
    csv.push([]);
    csv.push(['Total Attendees:', socialAttendeesReport.summary.totalAttendees]);
    csv.push(['Total Tickets:', socialAttendeesReport.summary.totalTickets]);
    csv.push([]);
    csv.push(['Order #', 'Customer ID', 'Name', 'Email', 'Tickets']);
    
    // Data rows
    socialAttendeesReport.attendees.forEach(attendee => {
      csv.push([
        attendee.orderNumber,
        attendee.customerId,
        attendee.name,
        attendee.email,
        attendee.ticketCount
      ]);
    });
    
    // Convert to CSV string
    const csvContent = csv.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social_attendees_june14_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showStatus('Social attendees report exported to CSV', true);
  }

  // Enrollment Timing Report Functions
  async function generateEnrollmentTimingReport() {
    setTimingLoading(true);
    
    // Use existing data or fetch new
    let orders = globalData.orders;
    if (!orders.length) {
      orders = await fetchShopifyOrders();
    }

    // Different start dates for different classes
    const level123StartDate = new Date('2025-06-10'); // Tuesday - Level 1, 2, 3
    const bodyMovementShinesStartDate = new Date('2025-06-12'); // Thursday - Body Movement, Shines
    
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
        
        // Determine class level
        let classLevel = '';
        let classStartDate = level123StartDate; // Default to Tuesday start
        
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
          classStartDate = bodyMovementShinesStartDate; // Thursday start
        } else if (title.includes('shines')) {
          classLevel = 'Shines';
          classStartDate = bodyMovementShinesStartDate; // Thursday start
        }

        if (classLevel) {
          // Calculate days before the appropriate class start date
          const daysBeforeStart = Math.floor((classStartDate - orderDate) / (1000 * 60 * 60 * 24));
          const dayOfWeek = orderDate.toLocaleDateString('en-US', { weekday: 'long' });
          
          // Initialize class data if needed
          if (!timingData.byClass[classLevel]) {
            timingData.byClass[classLevel] = {
              early: 0,
              dayOf: 0,
              total: 0
            };
          }

          // Categorize enrollment - day-of means same date as class start
          const isOrderDateSameAsClassStart = orderDate.toDateString() === classStartDate.toDateString();
          
          if (isOrderDateSameAsClassStart) {
            timingData.byClass[classLevel].dayOf++;
          } else if (daysBeforeStart > 0) {
            timingData.byClass[classLevel].early++;
          } else {
            // After class start - count as early (negative days before)
            timingData.byClass[classLevel].early++;
          }
          timingData.byClass[classLevel].total++;

          // Track by day of week
          timingData.byDayOfWeek[dayOfWeek] = (timingData.byDayOfWeek[dayOfWeek] || 0) + 1;

          // Store enrollment details
          timingData.allEnrollments.push({
            classLevel,
            daysBeforeStart,
            dayOfWeek,
            orderDate: orderDate.toISOString(),
            classStartDate: classStartDate.toISOString()
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
          
          // Determine which block (we only care about Term 2)
          let block = '';
          
          if (variant.includes('term 2b')) {
            block = 'b';
          } else if (variant.includes('term 2a')) {
            block = 'a';
          } else if (variant.includes('term 2') && !variant.includes('term 1') && !variant.includes('term 3')) {
            // "Term 2" without specific block = both blocks
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
      csv.push(['Class Filter', incomeReport.summary.classFilter === 'all' ? 'All Classes' : incomeReport.summary.classFilter]);
      csv.push(['Date Range', `${incomeReport.summary.dateRange.from} to ${incomeReport.summary.dateRange.to}`]);
      if (incomeReport.summary.classFilter !== 'all' && incomeReport.summary.totalOriginalIncome) {
        csv.push(['Original Total (before filtering)', `$${incomeReport.summary.totalOriginalIncome.toFixed(2)}`]);
      }
      
      const filterSuffix = incomeReport.summary.classFilter !== 'all' ? `_${incomeReport.summary.classFilter}` : '';
      filename = `income_report${filterSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
      
    } else if (reportType === 'termEnrollments' && termEnrollmentsReport) {
      // Headers
      csv.push(['Term Enrollments Report']);
      csv.push([`Generated: ${new Date().toLocaleString()}`]);
      csv.push([]);
      csv.push(['Filters:', 
        `Class: ${termEnrollmentsReport.filters.class === 'all' ? 'All Classes' : termEnrollmentsReport.filters.class}`,
        `Term: ${termEnrollmentsReport.filters.term === 'all' ? 'All Terms' : 'Term ' + termEnrollmentsReport.filters.term}`,
        `Block: ${termEnrollmentsReport.filters.block === 'both' ? 'Both Blocks' : 'Block ' + termEnrollmentsReport.filters.block}`
      ]);
      csv.push([]);
      
      // Data by term/block
      Object.entries(termEnrollmentsReport.data).forEach(([termBlock, classes]) => {
        csv.push([termBlock]);
        csv.push(['Class', 'Details']);
        
        Object.entries(classes).forEach(([className, data]) => {
          csv.push([className, data.display]);
        });
        
        // Subtotal for this term/block
        const subtotal = Object.values(classes).reduce((sum, data) => sum + data.total, 0);
        csv.push(['Subtotal', `${subtotal} students`]);
        csv.push([]);
      });
      
      // Summary
      csv.push(['OVERALL SUMMARY']);
      csv.push(['Total Unique Students', termEnrollmentsReport.totalUniqueStudents]);
      
      filename = `term_enrollments_${termEnrollmentsReport.filters.class}_term${termEnrollmentsReport.filters.term}_${new Date().toISOString().split('T')[0]}.csv`;
      
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
      
      filename = `enrollment_analysis_${new Date().toISOString().split('T')[0]}.csv`;
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

  // Set default values on mount
  useEffect(() => {
    // Load term settings from localStorage
    const savedSettings = localStorage.getItem('termSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEnrollmentTermFilter(settings.term || '2');
    }
  }, []);

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
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
            gap: '0.5rem',
            fontSize: '0.9rem'
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
        padding: '1.5rem',
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
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-coral)'
        }}>
          Income Report
        </h2>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '0.9rem',
          marginBottom: '1rem'
        }}>
          Track total income for all orders within a date range.
        </p>
        
        {/* Date Selection */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>From:</label>
            <input
              type="date"
              value={manualFromDate}
              onChange={(e) => setManualFromDate(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                width: '180px'
              }}
            />
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>To:</label>
            <input
              type="date"
              value={manualToDate}
              onChange={(e) => setManualToDate(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                width: '180px'
              }}
              placeholder="Optional"
            />
          </div>
        </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={generateIncomeReport}
              disabled={incomeLoading}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent-coral)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: incomeLoading ? 'not-allowed' : 'pointer',
                opacity: incomeLoading ? 0.5 : 1,
                transition: 'all 0.3s ease',
                fontSize: '0.9rem'
              }}
            >
              Generate Report
            </button>
            {showIncomeButtons && (
              <>
                <button
                  onClick={() => exportToCSV('income')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontSize: '0.9rem'
                  }}
                >
                  Export to CSV
                </button>
                <button
                  onClick={resetIncomeReport}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontSize: '0.9rem'
                  }}
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
        
        {incomeLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading data from Shopify...
          </div>
        )}
        
        {incomeReport && (
          <div>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px'
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
            </div>
            
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem'
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
              
              <div style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}>
                <strong>Date Range:</strong> {incomeReport.summary.dateRange.from} to {incomeReport.summary.dateRange.to}
              </div>
            </div>
          </div>
        )}

      {/* Term Enrollments Report */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '1.5rem',
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
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-gold)'
        }}>
          Term Enrollments
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          View enrollment summary by term, block, and class type
        </p>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '0.85rem', 
          marginBottom: '1rem',
          fontStyle: 'italic' 
        }}>
          Note: Bundle students (Platinum/Unlimited) are counted in ALL classes they have access to (Level 1-3, Body Movement, Shines)
        </p>
        
        {/* Filters */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Class Type Selection */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>Class Type:</label>
            <select
              value={enrollmentClassFilter}
              onChange={(e) => setEnrollmentClassFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '250px',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>All Classes</option>
              <option value="level1" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Level 1</option>
              <option value="level2" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Level 2</option>
              <option value="level3" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Level 3</option>
              <option value="bodymovement" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Body Movement</option>
              <option value="shines" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Shines</option>
            </select>
          </div>

          {/* Term Selection */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>Term:</label>
            <select
              value={enrollmentTermFilter}
              onChange={(e) => setEnrollmentTermFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '250px',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>All Terms</option>
              <option value="1" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Term 1</option>
              <option value="2" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Term 2</option>
              <option value="3" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Term 3</option>
              <option value="4" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Term 4</option>
            </select>
          </div>

          {/* Block Selection */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>Block:</label>
            <select
              value={enrollmentBlockFilter}
              onChange={(e) => setEnrollmentBlockFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '250px',
                cursor: 'pointer'
              }}
            >
              <option value="both" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Both Blocks</option>
              <option value="A" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Block A</option>
              <option value="B" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Block B</option>
            </select>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={generateTermEnrollmentsReport}
            disabled={termEnrollmentsLoading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'var(--accent-gold)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: termEnrollmentsLoading ? 'not-allowed' : 'pointer',
              opacity: termEnrollmentsLoading ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Generate Report
          </button>
          {showTermEnrollmentsButtons && (
            <>
              <button
                onClick={() => exportToCSV('termEnrollments')}
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
                onClick={resetTermEnrollmentsReport}
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
        
        {termEnrollmentsLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading enrollment data...
          </div>
        )}
        
        {termEnrollmentsReport && (
          <div style={{ marginTop: '1.5rem' }}>
            {/* Object.entries maintains insertion order in modern JS */}
            {Object.entries(termEnrollmentsReport.data).map(([termBlock, classes]) => (
              <div key={termBlock} style={{
                background: 'var(--glass-bg)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                border: '1px solid var(--glass-border)'
              }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  color: 'var(--accent-gold)',
                  marginBottom: '1rem'
                }}>
                  {termBlock}
                </h3>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  {Object.entries(classes).map(([className, data]) => (
                    <div key={className} style={{
                      display: 'grid',
                      gridTemplateColumns: '200px 1fr',
                      gap: '1rem',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <span style={{
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        {className}:
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {data.display}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Term/Block Summary */}
                <div style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--glass-border)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Total Unique Students in {termBlock}:
                    </span>
                    <span style={{
                      fontWeight: '600',
                      color: 'var(--accent-coral)',
                      fontSize: '1.1rem'
                    }}>
                      {(() => {
                        // Count unique students (avoiding double-counting bundles)
                        const uniqueStudents = new Set();
                        Object.entries(classes).forEach(([className, data]) => {
                          if (data.customers) {
                            // data.customers is a Set, use for...of
                            for (const id of data.customers) {
                              uniqueStudents.add(id);
                            }
                          }
                          if (data.Leader) {
                            // data.Leader is a Set, use for...of
                            for (const id of data.Leader) {
                              uniqueStudents.add(id);
                            }
                          }
                          if (data.Follower) {
                            // data.Follower is a Set, use for...of
                            for (const id of data.Follower) {
                              uniqueStudents.add(id);
                            }
                          }
                        });
                        return uniqueStudents.size;
                      })()}
                    </span>
                  </div>
                  
                </div>
              </div>
            ))}
            
            {/* Overall Summary */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(232, 93, 47, 0.1) 0%, rgba(255, 111, 97, 0.1) 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid var(--accent-coral)',
              marginTop: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: 'var(--accent-coral)'
                }}>
                  Total Unique Students:
                </h3>
                <span style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: 'var(--accent-coral)'
                }}>
                  {termEnrollmentsReport.totalUniqueStudents}
                </span>
              </div>
              
              <div style={{
                marginTop: '1rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}>
                <strong>Filters Applied:</strong>
                <span style={{ marginLeft: '0.5rem' }}>
                  Class: {termEnrollmentsReport.filters.class === 'all' ? 'All Classes' : 
                    termEnrollmentsReport.filters.class === 'level1' ? 'Level 1' :
                    termEnrollmentsReport.filters.class === 'level2' ? 'Level 2' :
                    termEnrollmentsReport.filters.class === 'level3' ? 'Level 3' :
                    termEnrollmentsReport.filters.class === 'bodymovement' ? 'Body Movement' :
                    termEnrollmentsReport.filters.class === 'shines' ? 'Shines' :
                    termEnrollmentsReport.filters.class === 'bundles' ? 'Bundles' : 'Unknown'},
                  Term: {termEnrollmentsReport.filters.term === 'all' ? 'All Terms' : `Term ${termEnrollmentsReport.filters.term}`},
                  Block: {termEnrollmentsReport.filters.block === 'both' ? 'Both Blocks' : `Block ${termEnrollmentsReport.filters.block}`}
                </span>
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
        padding: '1.5rem',
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
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--accent-teal)'
        }}>
          Enrollment Timing Analysis
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Analyze when students sign up for Term 2b classes relative to class start dates:
          <br />• Level 1/2/3: Tuesday, June 10th
          <br />• Body Movement & Shines: Thursday, June 12th
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
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px'
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
            </div>
            
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
        padding: '1.5rem',
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
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
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
                    minWidth: '600px'
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

      {/* Social Attendees Report */}
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-teal) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Social Attendees Report
          </h2>
          {!socialAttendeesReport && (
            <button
              onClick={generateSocialAttendeesReport}
              disabled={socialAttendeesLoading}
              style={{
                padding: '0.75rem 1.5rem',
                background: socialAttendeesLoading ? 'var(--glass-bg)' : 'linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-teal) 100%)',
                color: socialAttendeesLoading ? 'var(--text-secondary)' : 'white',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: socialAttendeesLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                border: socialAttendeesLoading ? '1px solid var(--glass-border)' : 'none',
                opacity: socialAttendeesLoading ? 0.7 : 1
              }}
            >
              {socialAttendeesLoading ? 'Generating...' : 'Generate Report'}
            </button>
          )}
          {socialAttendeesReport && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={exportSocialAttendeesToCSV}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--success)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
              >
                Export to CSV
              </button>
              <button
                onClick={resetSocialAttendeesReport}
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
            </div>
          )}
        </div>
        
        {socialAttendeesLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Fetching social attendees from Shopify...
          </div>
        )}
        
        {socialAttendeesReport && (
          <div>
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)'
            }}>
              <strong>Total Attendees: </strong>{socialAttendeesReport.summary.totalAttendees} |{' '}
              <strong>Total Tickets: </strong>{socialAttendeesReport.summary.totalTickets}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '600px'
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
                    }}>Customer ID</th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)',
                      fontWeight: '600',
                      color: 'var(--accent-coral)'
                    }}>Name</th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)',
                      fontWeight: '600',
                      color: 'var(--accent-coral)'
                    }}>Email</th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)',
                      fontWeight: '600',
                      color: 'var(--accent-coral)'
                    }}>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {socialAttendeesReport.attendees.map((attendee, index) => (
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
                        {attendee.orderNumber}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {attendee.customerId}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {attendee.name}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {attendee.email}
                      </td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {attendee.ticketCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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