// Run this script in the browser console to set up special guests
// Make sure you're on the application page first

async function setupSpecialGuests() {
  console.log('Setting up special guests...');
  
  // Import supabase if not already available
  const { supabase } = await import('./src/lib/supabase.js');
  
  try {
    // First check if column exists by trying to query it
    const { data: testData, error: testError } = await supabase
      .from('social_attendance')
      .select('special_guest')
      .limit(1);
    
    if (testError && testError.message.includes('column')) {
      console.log('Column does not exist, please add it manually in Supabase dashboard');
      console.log('Add column: special_guest (boolean, default: false)');
      return;
    }
    
    // Update existing records to be non-special guests
    console.log('Updating existing records...');
    const { error: updateError } = await supabase
      .from('social_attendance')
      .update({ special_guest: false })
      .is('special_guest', null);
    
    if (updateError) {
      console.error('Error updating existing records:', updateError);
    }
    
    // Delete any existing special guest records
    console.log('Cleaning up old special guest records...');
    const { error: deleteError } = await supabase
      .from('social_attendance')
      .delete()
      .gte('order_id', 999001)
      .lte('order_id', 999013);
    
    if (deleteError) {
      console.error('Error deleting old records:', deleteError);
    }
    
    // Insert special guests
    console.log('Inserting special guests...');
    const specialGuests = [
      { order_id: 999001, order_number: 'SPECIAL-001', customer_name: 'Grace', customer_email: 'grace@example.com' },
      { order_id: 999002, order_number: 'SPECIAL-002', customer_name: 'Justin', customer_email: 'justin@example.com' },
      { order_id: 999003, order_number: 'SPECIAL-003', customer_name: 'Thea', customer_email: 'thea@example.com' },
      { order_id: 999004, order_number: 'SPECIAL-004', customer_name: 'Andy', customer_email: 'andy@example.com' },
      { order_id: 999005, order_number: 'SPECIAL-005', customer_name: 'Diego', customer_email: 'diego@example.com' },
      { order_id: 999006, order_number: 'SPECIAL-006', customer_name: 'Nathalia', customer_email: 'nathalia@example.com' },
      { order_id: 999007, order_number: 'SPECIAL-007', customer_name: 'Rin', customer_email: 'rin@example.com' },
      { order_id: 999008, order_number: 'SPECIAL-008', customer_name: 'Jenna', customer_email: 'jenna@example.com' },
      { order_id: 999009, order_number: 'SPECIAL-009', customer_name: 'Naomi', customer_email: 'naomi@example.com' },
      { order_id: 999010, order_number: 'SPECIAL-010', customer_name: 'Mariam', customer_email: 'mariam@example.com' },
      { order_id: 999011, order_number: 'SPECIAL-011', customer_name: 'Prashant', customer_email: 'prashant@example.com' },
      { order_id: 999012, order_number: 'SPECIAL-012', customer_name: 'Brian', customer_email: 'brian@example.com' },
      { order_id: 999013, order_number: 'SPECIAL-013', customer_name: 'Nisha', customer_email: 'nisha@example.com' }
    ];
    
    const guestsToInsert = specialGuests.map(guest => ({
      ...guest,
      customer_id: null,
      social_date: '2025-06-14',
      social_name: 'LocoMojo First Social - June 14th',
      total_tickets: 1,
      tickets_used: 0,
      special_guest: true
    }));
    
    const { error: insertError } = await supabase
      .from('social_attendance')
      .insert(guestsToInsert);
    
    if (insertError) {
      console.error('Error inserting special guests:', insertError);
    } else {
      console.log('Special guests added successfully!');
      console.log('Refresh the page to see them in the "Special guests" filter');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// To run this function, copy and paste this entire script into the browser console
// Then run: setupSpecialGuests()
console.log('Script loaded. Run setupSpecialGuests() to set up special guests.');