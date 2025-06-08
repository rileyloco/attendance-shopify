// Console.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


function Console() {
  const [term, setTerm] = useState('2');
  const [block, setBlock] = useState('A');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState(''); // 'attendance', 'free_attendance', or 'log'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [sheetLink, setSheetLink] = useState('https://docs.google.com/spreadsheets/d/1glc_D_gx3jG-J-VCddlL0IlPqhTYlpE3pTdYdmipFbs/edit?usp=sharing');

  // Load saved settings on mount
  useEffect(() => {
    loadConsoleSettings();
    
    // Save settings when leaving the page
    return () => {
      if (hasChanges) {
        saveConsoleSettings();
      }
    };
  }, []);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasChanges) {
        saveConsoleSettings();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, term, block, startDate, endDate]);

  // Load settings from database
  async function loadConsoleSettings() {
    try {
      const { data, error } = await supabase
        .from('console_settings')
        .select('*')
        .single();

      if (error) {
        console.log('No console settings found in database, using defaults');
        // Try localStorage as fallback
        const savedSettings = localStorage.getItem('termSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setTerm(settings.term || '2');
          setBlock(settings.block || 'A');
          setStartDate(settings.startDate || '');
          setEndDate(settings.endDate || '');
        }
      } else if (data) {
        setTerm(data.term || '2');
        setBlock(data.block || 'A');
        setStartDate(data.start_date || '');
        setEndDate(data.end_date || '');
        console.log('Loaded console settings from database:', data);
      }
    } catch (err) {
      console.error('Error loading console settings:', err);
    }
  }

  // Update navbar and localStorage whenever settings change
  useEffect(() => {
    if (term || block || startDate || endDate) {
      const settings = { term, block, startDate, endDate };
      localStorage.setItem('termSettings', JSON.stringify(settings));
      updateNavBarDisplay();
      setHasChanges(true);
    }
  }, [term, block, startDate, endDate]);

  // Save settings to database
  async function saveConsoleSettings() {
    const settings = { 
      term, 
      block, 
      start_date: startDate || null, 
      end_date: endDate || null 
    };
    
    console.log('Saving console settings:', settings);

    try {
      // First check if a record exists
      const { data: existing, error: checkError } = await supabase
        .from('console_settings')
        .select('id')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is OK
        console.error('Error checking existing settings:', checkError);
        return;
      }

      if (existing) {
        // Update existing record
       const { error: updateError } = await supabase
         .from('console_settings')
         .update(settings)
         .eq('id', existing.id);

       if (updateError) {
         console.error('Error updating console settings:', updateError);
       } else {
         console.log('Console settings updated successfully');
         setHasChanges(false);
       }
     } else {
       // Insert new record
       const { error: insertError } = await supabase
         .from('console_settings')
         .insert([{ id: 1, ...settings }]);

       if (insertError) {
         console.error('Error inserting console settings:', insertError);
       } else {
         console.log('Console settings saved successfully');
         setHasChanges(false);
       }
     }
   } catch (err) {
     console.error('Error saving console settings:', err);
   }
 }

 // Manual save button
 function handleSaveSettings() {
   saveConsoleSettings();
   setMessage('Settings saved successfully');
   setTimeout(() => setMessage(''), 3000);
 }

 // Update navbar to show term info
 function updateNavBarDisplay() {
   // This will be read by the NavBar component
   const displayText = `Term ${term} Block ${block}`;
   let dateRange = '';
   
   if (startDate && endDate) {
     const start = new Date(startDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
     const end = new Date(endDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
     dateRange = ` (${start} - ${end})`;
   }
   
   localStorage.setItem('termDisplay', displayText + dateRange);
   // Trigger a custom event to update NavBar
   window.dispatchEvent(new Event('termSettingsUpdated'));
 }

 // Export attendance data
 async function exportAttendance() {
   setLoading(true);
   setMessage('Exporting attendance data...');
   
   try {
     // Fetch all paid attendance for this term and block
     const { data, error } = await supabase
       .from('paid_attendance')
       .select('*, customers(first_name, last_name, email)')
       .eq('term', `Term ${term}`)
       .eq('block', block)
       .order('customer_id');

     if (error) {
       console.error('Error fetching attendance:', error);
       setMessage('Failed to export attendance data');
       setLoading(false);
       return;
     }

     // Format the data
     const exportData = {
       term: `Term ${term}`,
       block: block,
       startDate,
       endDate,
       exportedAt: new Date().toISOString(),
       attendance: data.map(record => ({
         customer_id: record.customer_id,
         customer_name: record.customers ? 
           `${record.customers.first_name} ${record.customers.last_name}` : 
           'Unknown',
         email: record.customers?.email || '',
         class: record.class_name,
         role: record.role,
         week_1: record.week_1,
         week_2: record.week_2,
         week_3: record.week_3,
         week_4: record.week_4,
         week_5: record.week_5,
         notes: record.notes
       }))
     };

     // Create and download the file
     const filename = `attendance_term${term}_block${block}_${new Date().toISOString().split('T')[0]}.json`;
     const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);

     setMessage(`Exported ${data.length} attendance records`);
   } catch (err) {
     console.error('Export error:', err);
     setMessage('Failed to export attendance data');
   } finally {
     setLoading(false);
   }
 }

 // Export enrollment analysis for Term 2b
 async function exportEnrollmentAnalysis() {
   setLoading(true);
   setMessage('Analyzing Term 2b enrollment from Shopify orders...');
   
   try {
     // Calculate date range (5 weeks before term start)
     const startDate = new Date('2025-05-01'); // Term 2 start
     startDate.setDate(startDate.getDate() - (5 * 7));
     const sinceDate = startDate.toISOString();

     // Fetch orders directly from Shopify
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
     setMessage(`Analyzing ${shopifyOrders.length} orders from Shopify...`);

     // Get customer details from database
     const { data: customersData, error: customersError } = await supabase
       .from('customers')
       .select('customer_id, first_name, last_name, email');

     if (customersError) {
       console.error('Error fetching customers:', customersError);
       setMessage('Failed to fetch customer data');
       setLoading(false);
       return;
     }

     // Create customer lookup map
     const customerMap = {};
     customersData.forEach(customer => {
       customerMap[customer.customer_id] = customer;
     });

     // Process orders to identify enrollments
     const customerEnrollments = {};

     shopifyOrders.forEach(order => {
       if (!order.customer?.id) return;
       
       const customerId = order.customer.id;
       const customerInfo = customerMap[customerId] || {
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

     // Now create the export data - grouped by customer
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

     // Create headers for the sheet
     const headers = ['Customer ID', 'Name', 'Email', 'Order ID', 'Class', 'Role', 'Order Details', 'Notes', 'Category'];
     
     // Create summary rows
     const summaryRows = [
       'Term 2b Enrollment Analysis',
       `Exported: ${new Date().toLocaleString()}`,
       '',
       `Total Customers Analyzed: ${Object.keys(customerEnrollments).length}`,
       `Unique Customers Enrolled in 2b: ${new Set(enrolled2b.map(r => r.customer_id)).size}`,
       `Unique Customers NOT Enrolled in 2b: ${new Set(notEnrolled2b.map(r => r.customer_id)).size}`,
       `Total 2b Enrollments (from 2a who enrolled): ${enrolled2b.length}`,
       `Total Missing 2b Enrollments: ${notEnrolled2b.length}`,
       `Total All Current 2b Enrollments: ${allCurrent2bEnrollments.length}`
     ];

     // Fetch free class orders directly from Shopify
     setMessage('Fetching free class orders from Shopify...');
     
     // Calculate date range (5 weeks before current date)
     const fiveWeeksAgo = new Date();
     fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - (5 * 7));
     const freeClassSinceDate = fiveWeeksAgo.toISOString();

     // Fetch from Shopify via Netlify function
     const freeClassResponse = await fetch('/.netlify/functions/shopify-orders', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ since: freeClassSinceDate })
     });

     if (!freeClassResponse.ok) {
       throw new Error(`Failed to fetch free class orders: ${freeClassResponse.statusText}`);
     }

     const freeClassData = await freeClassResponse.json();
     const freeClassOrders = freeClassData.orders || [];
     
     console.log(`Fetched ${freeClassOrders.length} orders from Shopify for free class analysis`);

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
               name: 'Unknown', // Will be filled from database
               email: '', // Will be filled from database
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

     // Fetch customer details from database
     const freeClassCustomerIds = Object.keys(freeClassStudents).map(id => parseInt(id));
     
     if (freeClassCustomerIds.length > 0) {
       const { data: freeClassCustomerData, error: customerError } = await supabase
         .from('customers')
         .select('customer_id, first_name, last_name, email')
         .in('customer_id', freeClassCustomerIds);

       if (customerError) {
         console.error('Error fetching free class customer details:', customerError);
       } else {
         // Update customer names and emails
         (freeClassCustomerData || []).forEach(customer => {
           if (freeClassStudents[customer.customer_id]) {
             freeClassStudents[customer.customer_id].name = 
               `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
             freeClassStudents[customer.customer_id].email = customer.email || '';
           }
         });
       }
     }

     // Now check which free class students have signed up for paid classes
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

     // Send data to Google Sheets
     const sheetData = {
       summary: summaryRows.filter(row => row !== ''), // Remove empty strings
       headers: headers,
       categories: [
         {
           name: 'Students from 2a who are also enrolled in 2b',
           data: enrolled2b.map(row => [
             row.customer_id,
             row.name,
             row.email,
             row.order_id,
             row.class,
             row.role,
             row.order_details,
             row.notes,
             row.category
           ])
         },
         {
           name: 'Students from 2a who have NOT enrolled in 2b',
           data: notEnrolled2b.map(row => [
             row.customer_id,
             row.name,
             row.email,
             row.order_id,
             row.class,
             row.role,
             row.order_details,
             row.notes,
             row.category
           ])
         },
         {
           name: 'All current Term 2b enrollments',
           data: allCurrent2bEnrollments.map(row => [
             row.customer_id,
             row.name,
             row.email,
             row.order_id,
             row.class,
             row.role,
             row.order_details,
             row.notes,
             row.category
           ])
         },
         {
           name: 'All free class students (past 5 weeks)',
           data: allFreeClassStudents.map(student => [
             student.customer_id,
             student.name,
             student.email,
             '', // No order ID for this view
             student.classSignedUpTo || '-',
             student.freeClassRole || '-', // Show their free class role
             `Free classes: ${student.freeClassDates.slice(0, 3).join(', ')}${student.freeClassDates.length > 3 ? '...' : ''}`, // Show dates attended
             student.hasSignedUp ? 'Yes' : 'No', // Has Signed Up in notes column
             'Free Class Students'
           ])
         },
         {
           name: 'Free class students who signed up for paid classes',
           data: freeClassStudentsWhoSignedUp.map(student => [
             student.customer_id,
             student.name,
             student.email,
             '', // No order ID for this view
             student.classSignedUpTo,
             student.freeClassRole || '-',
             `Free classes: ${student.freeClassDates.slice(0, 3).join(', ')}${student.freeClassDates.length > 3 ? '...' : ''}`,
             'Converted to paid', // Notes
             'Free to Paid Conversions'
           ])
         },
         {
           name: 'Free class students who signed up for Term 2a',
           data: freeClassStudentsIn2a.map(student => [
             student.customer_id,
             student.name,
             student.email,
             '', // No order ID for this view
             student.classSignedUpTo,
             student.freeClassRole || '-',
             `Free classes: ${student.freeClassDates.slice(0, 3).join(', ')}${student.freeClassDates.length > 3 ? '...' : ''}`,
             'Free to Term 2a', // Notes
             'Free to Term 2a Conversions'
           ])
         }
       ]
     };

     // Send to Google Sheets
     try {
       const response = await fetch('https://script.google.com/macros/s/AKfycbyzO9GwBXaLTQL5q9W9xfiUcj7awoeIGqvVFsIyp2M2Pnps4fR3aJEh4VOGzf_js5CP/exec', {
         method: 'POST',
         redirect: 'follow',
         headers: {
           'Content-Type': 'text/plain',
         },
         body: JSON.stringify(sheetData)
       });

       // With no-cors, we can't read the response, so we'll just assume success
       // The sheet should update if the request goes through
       setMessage(`Sheet update requested - ${enrolled2b.length} enrolled, ${notEnrolled2b.length} not enrolled. Check the sheet for updates.`);
       
       // Also try with mode: 'no-cors' as a fallback
       if (!response.ok) {
         await fetch('https://script.google.com/macros/s/AKfycbyzO9GwBXaLTQL5q9W9xfiUcj7awoeIGqvVFsIyp2M2Pnps4fR3aJEh4VOGzf_js5CP/exec', {
           method: 'POST',
           mode: 'no-cors',
           body: JSON.stringify(sheetData)
         });
       }
       
     } catch (err) {
       console.error('Error updating Google Sheets:', err);
       
       // Try alternative approach - create a form and submit it
       const form = document.createElement('form');
       form.method = 'POST';
       form.action = 'https://script.google.com/macros/s/AKfycbyzO9GwBXaLTQL5q9W9xfiUcj7awoeIGqvVFsIyp2M2Pnps4fR3aJEh4VOGzf_js5CP/exec';
       form.target = '_blank';
       
       const input = document.createElement('input');
       input.type = 'hidden';
       input.name = 'data';
       input.value = JSON.stringify(sheetData);
       
       form.appendChild(input);
       document.body.appendChild(form);
       form.submit();
       document.body.removeChild(form);
       
       setMessage('Opening new tab to update sheet - please check if it updated.');
     }
   } catch (err) {
     console.error('Export error:', err);
     setMessage('Failed to export enrollment analysis');
   } finally {
     setLoading(false);
   }
 }

 // Delete paid attendance
 async function deletePaidAttendance() {
   setLoading(true);
   setMessage('Deleting paid attendance...');
   
   try {
     // First try to get records to see if query works
     const { data: records, error: selectError } = await supabase
       .from('paid_attendance')
       .select('*')
       .eq('term', `Term ${term}`)
       .eq('block', block);

     if (selectError) {
       console.error('Error selecting attendance:', selectError);
       setMessage('Failed to access attendance data');
       setLoading(false);
       hideConfirmationModal();
       return;
     }

     console.log(`Found ${records?.length || 0} records to delete`);

     if (records && records.length > 0) {
       // Delete all paid attendance for this term and block
       const { error } = await supabase
         .from('paid_attendance')
         .delete()
         .eq('term', `Term ${term}`)
         .eq('block', block);

       if (error) {
         console.error('Error deleting attendance:', error);
         setMessage(`Failed to delete attendance data: ${error.message}`);
       } else {
         setMessage(`Successfully deleted ${records.length} paid attendance records for Term ${term} Block ${block}`);
       }
     } else {
       setMessage(`No attendance records found for Term ${term} Block ${block}`);
     }
   } catch (err) {
     console.error('Delete error:', err);
     setMessage('Failed to delete attendance data');
   } finally {
     setLoading(false);
     hideConfirmationModal();
   }
 }

 // Delete free attendance
 async function deleteFreeAttendance() {
   setLoading(true);
   setMessage('Deleting free attendance...');
   
   try {
     // Get count first for feedback
     const { count } = await supabase
       .from('free_attendance')
       .select('*', { count: 'exact', head: true });

     // Delete all free attendance entries
     const { error } = await supabase
       .from('free_attendance')
       .delete()
       .gte('id', 0); // Delete all rows

     if (error) {
       console.error('Error deleting free attendance:', error);
       setMessage('Failed to delete free attendance entries');
     } else {
       setMessage(`Successfully deleted ${count || 0} free attendance entries`);
     }
   } catch (err) {
     console.error('Delete error:', err);
     setMessage('Failed to delete free attendance data');
   } finally {
     setLoading(false);
     hideConfirmationModal();
   }
 }

 // Delete log entries
 async function deleteLogEntries() {
   setLoading(true);
   setMessage('Deleting log entries...');
   
   try {
     // Get count first for feedback
     const { count } = await supabase
       .from('log')
       .select('*', { count: 'exact', head: true });

     // Delete all log entries
     const { error } = await supabase
       .from('log')
       .delete()
       .gte('id', 0); // Delete all rows

     if (error) {
       console.error('Error deleting log:', error);
       setMessage('Failed to delete log entries');
     } else {
       setMessage(`Successfully deleted ${count || 0} log entries`);
     }
   } catch (err) {
     console.error('Delete error:', err);
     setMessage('Failed to delete log entries');
   } finally {
     setLoading(false);
     hideConfirmationModal();
   }
 }

 // Show confirmation modal using DOM manipulation (like Kiosk)
 function showConfirmationModal(type) {
   setDeleteType(type);
   const modal = document.getElementById('delete-confirmation-modal');
   if (modal) {
     modal.style.display = 'flex';
   }
 }

 // Hide confirmation modal
 function hideConfirmationModal() {
   const modal = document.getElementById('delete-confirmation-modal');
   if (modal) {
     modal.style.display = 'none';
   }
   setDeleteType('');
 }

 // Handle delete confirmation
 function handleDeleteConfirm() {
   if (deleteType === 'attendance') {
     deletePaidAttendance();
   } else if (deleteType === 'free_attendance') {
     deleteFreeAttendance();
   } else if (deleteType === 'log') {
     deleteLogEntries();
   }
 }

 return (
   <div style={{ padding: '4rem 0' }}>
     {/* Term Settings Card */}
     <div style={{
       background: 'var(--glass-bg)',
       backdropFilter: 'blur(25px)',
       WebkitBackdropFilter: 'blur(25px)',
       border: '1px solid var(--glass-border)',
       borderRadius: '28px',
       padding: '3rem',
       marginBottom: '2.5rem',
       transition: 'all 0.4s ease',
       position: 'relative',
       overflow: 'hidden'
     }}>
       <div style={{
         content: '""',
         position: 'absolute',
         top: 0,
         left: 0,
         right: 0,
         height: '2px',
         background: 'linear-gradient(90deg, var(--accent-warm), var(--accent-gold), var(--accent-coral))',
         opacity: '0.7'
       }}></div>
       
       <h2 style={{
         fontSize: '2rem',
         fontWeight: '700',
         marginBottom: '2rem',
         background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
         WebkitBackgroundClip: 'text',
         WebkitTextFillColor: 'transparent',
         backgroundClip: 'text'
       }}>
         Term Settings
       </h2>
       
       <div style={{
         display: 'grid',
         gridTemplateColumns: 'repeat(2, 1fr)',
         gap: '1.5rem',
         marginBottom: '2rem'
       }}>
         <div>
           <label style={{
             display: 'block',
             fontSize: '0.9rem',
             fontWeight: '600',
             color: 'var(--text-secondary)',
             marginBottom: '0.5rem',
             textTransform: 'uppercase',
             letterSpacing: '1px'
           }}>
             Term
           </label>
           <input
             type="text"
             value={term}
             onChange={(e) => setTerm(e.target.value)}
             style={{
               width: '100%',
               padding: '0.75rem 1rem',
               background: 'var(--glass-bg)',
               border: '1px solid var(--glass-border)',
               borderRadius: '12px',
               color: 'var(--text-primary)',
               fontSize: '1rem',
               outline: 'none',
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
             placeholder="2"
           />
         </div>
         
         <div>
           <label style={{
             display: 'block',
             fontSize: '0.9rem',
             fontWeight: '600',
             color: 'var(--text-secondary)',
             marginBottom: '0.5rem',
             textTransform: 'uppercase',
             letterSpacing: '1px'
           }}>
             Block
           </label>
           <input
             type="text"
             value={block}
             onChange={(e) => setBlock(e.target.value.toUpperCase())}
             style={{
               width: '100%',
               padding: '0.75rem 1rem',
               background: 'var(--glass-bg)',
               border: '1px solid var(--glass-border)',
               borderRadius: '12px',
               color: 'var(--text-primary)',
               fontSize: '1rem',
               outline: 'none',
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
             placeholder="A"
           />
         </div>
       </div>
       
       <div style={{
         display: 'grid',
         gridTemplateColumns: 'repeat(2, 1fr)',
         gap: '1.5rem',
         marginBottom: '2rem'
       }}>
         <div>
           <label style={{
             display: 'block',
             fontSize: '0.9rem',
             fontWeight: '600',
             color: 'var(--text-secondary)',
             marginBottom: '0.5rem',
             textTransform: 'uppercase',
             letterSpacing: '1px'
           }}>
             Start Date (Week 1)
           </label>
           <input
             type="date"
             value={startDate}
             onChange={(e) => setStartDate(e.target.value)}
             style={{
               width: '100%',
               padding: '0.75rem 1rem',
               background: 'var(--glass-bg)',
               border: '1px solid var(--glass-border)',
               borderRadius: '12px',
               color: 'var(--text-primary)',
               fontSize: '1rem',
               outline: 'none',
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
         
         <div>
           <label style={{
             display: 'block',
             fontSize: '0.9rem',
             fontWeight: '600',
             color: 'var(--text-secondary)',
             marginBottom: '0.5rem',
             textTransform: 'uppercase',
             letterSpacing: '1px'
           }}>
             End Date (Week 5)
           </label>
           <input
             type="date"
             value={endDate}
             onChange={(e) => setEndDate(e.target.value)}
             style={{
               width: '100%',
               padding: '0.75rem 1rem',
               background: 'var(--glass-bg)',
               border: '1px solid var(--glass-border)',
               borderRadius: '12px',
               color: 'var(--text-primary)',
               fontSize: '1rem',
               outline: 'none',
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
       </div>
       
       <button
         onClick={handleSaveSettings}
         style={{
           padding: '1rem 2rem',
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
         Save Settings
       </button>
     </div>

     {/* Management Cards Grid */}
     <div style={{
       display: 'grid',
       gridTemplateColumns: 'repeat(2, 1fr)',
       gap: '2.5rem'
     }}>
       {/* Attendance Management Card */}
       <div style={{
         background: 'var(--glass-bg)',
         backdropFilter: 'blur(25px)',
         WebkitBackdropFilter: 'blur(25px)',
         border: '1px solid var(--glass-border)',
         borderRadius: '28px',
         padding: '3rem',
         transition: 'all 0.4s ease',
         position: 'relative',
         overflow: 'hidden'
       }}>
         <div style={{
           content: '""',
           position: 'absolute',
           top: 0,
           left: 0,
           right: 0,
           height: '2px',
           background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-coral), var(--accent-warm))',
           opacity: '0.7'
         }}></div>
         
         <div style={{
           fontSize: '3rem',
           fontWeight: '800',
           marginBottom: '0.8rem',
           background: 'linear-gradient(135deg, var(--accent-teal) 0%, var(--accent-coral) 100%)',
           WebkitBackgroundClip: 'text',
           WebkitTextFillColor: 'transparent',
           backgroundClip: 'text',
           textAlign: 'center'
         }}>
           Attendance
         </div>
         <div style={{
           color: 'var(--text-secondary)',
           fontWeight: '600',
           textTransform: 'uppercase',
           letterSpacing: '2px',
           fontSize: '0.9rem',
           textAlign: 'center',
           marginBottom: '2rem'
         }}>
           Management
         </div>
         
         <div style={{
           display: 'flex',
           flexDirection: 'column',
           gap: '1rem'
         }}>
           <button
             onClick={exportAttendance}
             disabled={loading}
             style={{
               padding: '1rem',
               background: 'rgba(78, 205, 196, 0.2)',
               color: 'var(--success)',
               borderRadius: '12px',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               transition: 'all 0.3s ease',
               border: '1px solid rgba(78, 205, 196, 0.4)',
               opacity: loading ? 0.7 : 1,
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.background = 'rgba(78, 205, 196, 0.3)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.background = 'rgba(78, 205, 196, 0.2)';
             }}
           >
             Export Attendance
           </button>
           
           <button
             onClick={() => showConfirmationModal('attendance')}
             disabled={loading}
             style={{
               padding: '1rem',
               background: 'rgba(232, 93, 47, 0.2)',
               color: 'var(--accent-warm)',
               borderRadius: '12px',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               transition: 'all 0.3s ease',
               border: '1px solid rgba(232, 93, 47, 0.4)',
               opacity: loading ? 0.7 : 1,
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.background = 'rgba(232, 93, 47, 0.3)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.background = 'rgba(232, 93, 47, 0.2)';
             }}
           >
             Delete Paid Attendance
           </button>
           
           <button
             onClick={() => showConfirmationModal('free_attendance')}
             disabled={loading}
             style={{
               padding: '1rem',
               background: 'rgba(232, 93, 47, 0.2)',
               color: 'var(--accent-warm)',
               borderRadius: '12px',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               transition: 'all 0.3s ease',
               border: '1px solid rgba(232, 93, 47, 0.4)',
               opacity: loading ? 0.7 : 1,
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.background = 'rgba(232, 93, 47, 0.3)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.background = 'rgba(232, 93, 47, 0.2)';
             }}
           >
             Delete Free Attendance
           </button>
         </div>
       </div>

       {/* Log Management Card */}
       <div style={{
         background: 'var(--glass-bg)',
         backdropFilter: 'blur(25px)',
         WebkitBackdropFilter: 'blur(25px)',
         border: '1px solid var(--glass-border)',
         borderRadius: '28px',
         padding: '3rem',
         transition: 'all 0.4s ease',
         position: 'relative',
         overflow: 'hidden'
       }}>
         <div style={{
           content: '""',
           position: 'absolute',
           top: 0,
           left: 0,
           right: 0,
           height: '2px',
           background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-teal), var(--accent-coral))',
           opacity: '0.7'
         }}></div>
         
         <div style={{
           fontSize: '3rem',
           fontWeight: '800',
           marginBottom: '0.8rem',
           background: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-teal) 100%)',
           WebkitBackgroundClip: 'text',
           WebkitTextFillColor: 'transparent',
           backgroundClip: 'text',
           textAlign: 'center'
         }}>
           Logs
         </div>
         <div style={{
           color: 'var(--text-secondary)',
           fontWeight: '600',
           textTransform: 'uppercase',
           letterSpacing: '2px',
           fontSize: '0.9rem',
           textAlign: 'center',
           marginBottom: '2rem'
         }}>
           Management
         </div>
         
         <button
           onClick={() => showConfirmationModal('log')}
           disabled={loading}
           style={{
             width: '100%',
             padding: '1rem',
             background: 'rgba(232, 93, 47, 0.2)',
             color: 'var(--accent-warm)',
             borderRadius: '12px',
             fontWeight: '600',
             cursor: loading ? 'not-allowed' : 'pointer',
             transition: 'all 0.3s ease',
             border: '1px solid rgba(232, 93, 47, 0.4)',
             opacity: loading ? 0.7 : 1,
             backdropFilter: 'blur(20px)',
             WebkitBackdropFilter: 'blur(20px)'
           }}
           onMouseEnter={(e) => {
             if (!loading) {
               e.currentTarget.style.transform = 'translateY(-2px)';
               e.currentTarget.style.background = 'rgba(232, 93, 47, 0.3)';
             }
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.transform = 'translateY(0)';
             e.currentTarget.style.background = 'rgba(232, 93, 47, 0.2)';
           }}
         >
           Delete All Logs
         </button>
       </div>

       {/* Analysis Card */}
       <div style={{
         background: 'var(--glass-bg)',
         backdropFilter: 'blur(25px)',
         WebkitBackdropFilter: 'blur(25px)',
         border: '1px solid var(--glass-border)',
         borderRadius: '28px',
         padding: '3rem',
         transition: 'all 0.4s ease',
         position: 'relative',
         overflow: 'hidden'
       }}>
         <div style={{
           content: '""',
           position: 'absolute',
           top: 0,
           left: 0,
           right: 0,
           height: '2px',
           background: 'linear-gradient(90deg, var(--accent-warm), var(--accent-teal), var(--accent-gold))',
           opacity: '0.7'
         }}></div>
         
         <div style={{
           fontSize: '3rem',
           fontWeight: '800',
           marginBottom: '0.8rem',
           background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
           WebkitBackgroundClip: 'text',
           WebkitTextFillColor: 'transparent',
           backgroundClip: 'text',
           textAlign: 'center'
         }}>
           Analysis
         </div>
         <div style={{
           color: 'var(--text-secondary)',
           fontWeight: '600',
           textTransform: 'uppercase',
           letterSpacing: '2px',
           fontSize: '0.9rem',
           textAlign: 'center',
           marginBottom: '2rem'
         }}>
           Term 2b Enrollment
         </div>
         
         <div style={{
           display: 'flex',
           flexDirection: 'column',
           gap: '1rem'
         }}>
           <button
             onClick={exportEnrollmentAnalysis}
             disabled={loading}
             style={{
               padding: '1rem',
               background: 'rgba(78, 205, 196, 0.2)',
               color: 'var(--success)',
               borderRadius: '12px',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               transition: 'all 0.3s ease',
               border: '1px solid rgba(78, 205, 196, 0.4)',
               opacity: loading ? 0.7 : 1,
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.background = 'rgba(78, 205, 196, 0.3)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.background = 'rgba(78, 205, 196, 0.2)';
             }}
           >
             {loading ? 'Updating Sheet...' : 'Update Google Sheet'}
           </button>
           
           {sheetLink && (
             <a
               href={sheetLink}
               target="_blank"
               rel="noopener noreferrer"
               style={{
                 padding: '1rem',
                 background: 'var(--glass-bg)',
                 border: '1px solid var(--glass-border)',
                 borderRadius: '12px',
                 color: 'var(--accent-teal)',
                 textDecoration: 'none',
                 fontWeight: '600',
                 textAlign: 'center',
                 transition: 'all 0.3s ease',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: '0.5rem'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.background = 'var(--glass-hover)';
                 e.currentTarget.style.transform = 'translateY(-2px)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.background = 'var(--glass-bg)';
                 e.currentTarget.style.transform = 'translateY(0)';
               }}
             >
               <span>📊</span> View Google Sheet
             </a>
           )}
         </div>
       </div>
     </div>
     
     {/* Message Display */}
     {message && (
       <div style={{
         marginTop: '2rem',
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
           : 'var(--success)',
         textAlign: 'center'
       }}>
         {message}
       </div>
     )}

     {/* Delete Confirmation Modal - Hidden by default, shown via DOM manipulation */}
     <div 
       id="delete-confirmation-modal" 
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
         maxWidth: '450px',
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
             background: 'rgba(232, 93, 47, 0.1)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             margin: '0 auto'
           }}>
             <span style={{ 
               fontSize: '48px',
               background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
               WebkitBackgroundClip: 'text',
               WebkitTextFillColor: 'transparent',
               backgroundClip: 'text'
             }}>⚠️</span>
           </div>
         </div>
         
         <h2 style={{ 
           fontSize: '1.8rem', 
           fontWeight: '700', 
           marginBottom: '1rem',
           background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
           WebkitBackgroundClip: 'text',
           WebkitTextFillColor: 'transparent',
           backgroundClip: 'text'
         }}>
           {deleteType === 'attendance' ? 'Delete Paid Attendance?' : 
            deleteType === 'free_attendance' ? 'Delete Free Attendance?' : 
            'Delete All Logs?'}
         </h2>
         
         <p style={{ 
           fontSize: '1rem',
           color: 'var(--text-secondary)',
           marginBottom: '2rem',
           lineHeight: '1.5'
         }}>
           {deleteType === 'attendance' 
             ? `Are you sure you want to delete paid attendance for Term ${term} Block ${block}? This can't be undone!`
             : deleteType === 'free_attendance'
             ? `Are you sure you want to delete all free attendance records? This can't be undone!`
             : `Are you sure you want to delete all log entries? This can't be undone!`
           }
         </p>
         
         <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
           <button
             onClick={handleDeleteConfirm}
             disabled={loading}
             style={{
               padding: '0.75rem 2rem',
               background: 'rgba(232, 93, 47, 0.2)',
               color: 'var(--accent-warm)',
               borderRadius: '12px',
               border: '1px solid rgba(232, 93, 47, 0.4)',
               fontSize: '1rem',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               opacity: loading ? 0.5 : 1,
               transition: 'all 0.3s ease',
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.background = 'rgba(232, 93, 47, 0.3)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.background = 'rgba(232, 93, 47, 0.2)';
             }}
           >
             Yes, Delete
           </button>
           <button
             onClick={hideConfirmationModal}
             disabled={loading}
             style={{
               padding: '0.75rem 2rem',
               background: 'var(--glass-bg)',
               color: 'var(--text-primary)',
               borderRadius: '12px',
               border: '1px solid var(--glass-border)',
               fontSize: '1rem',
               fontWeight: '600',
               cursor: loading ? 'not-allowed' : 'pointer',
               opacity: loading ? 0.5 : 1,
               transition: 'all 0.3s ease',
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)'
             }}
             onMouseEnter={(e) => {
               if (!loading) {
                 e.currentTarget.style.background = 'var(--glass-hover)';
                 e.currentTarget.style.transform = 'translateY(-2px)';
               }
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.background = 'var(--glass-bg)';
               e.currentTarget.style.transform = 'translateY(0)';
             }}
           >
             Cancel
           </button>
         </div>
       </div>
     </div>
   </div>
 );
}

export default Console;