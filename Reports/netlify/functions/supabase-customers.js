// netlify/functions/supabase-customers.js

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    body = {};
  }

  // Get Supabase credentials from environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Missing Supabase configuration',
        details: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables'
      })
    };
  }

  try {
    console.log('Fetching customers from Supabase...');
    console.log('SUPABASE_URL:', SUPABASE_URL);
    
    // Build the URL for the customers table
    const baseUrl = SUPABASE_URL.replace(/\/$/, ''); // Remove trailing slash if present
    const url = `${baseUrl}/rest/v1/customers`;
    
    // Build query parameters
    const queryParams = [];
    
    // Select specific fields
    queryParams.push('select=customer_id,first_name,last_name,email');
    
    // If specific customer IDs are provided, filter by them
    if (body.customerIds && body.customerIds.length > 0) {
      const customerIdList = body.customerIds.join(',');
      queryParams.push(`customer_id=in.(${customerIdList})`);
    }
    
    // Order by customer_id
    queryParams.push('order=customer_id.asc');
    
    const fullUrl = `${url}?${queryParams.join('&')}`;
    console.log('Full URL:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error response:', errorText);
      throw new Error(`Supabase API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const customers = await response.json();
    console.log(`Fetched ${customers.length} customers`);
    
    // Create a map for easy lookup
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.customer_id] = customer;
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        customers: customers,
        customerMap: customerMap,
        count: customers.length 
      })
    };
  } catch (error) {
    console.error('Error in supabase-customers function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch customers', 
        details: error.message,
        stack: error.stack
      })
    };
  }
};