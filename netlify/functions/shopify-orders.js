// netlify/functions/shopify-orders.js

exports.handler = async (event, context) => {
  // Only allow POST requests for the main app
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
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

  // Get Shopify credentials from environment variables
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
  const SHOPIFY_API_TOKEN = process.env.SHOPIFY_API_TOKEN;

  if (!SHOPIFY_STORE_URL || !SHOPIFY_API_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Missing Shopify configuration',
        details: 'SHOPIFY_STORE_URL and SHOPIFY_API_TOKEN must be set in environment variables'
      })
    };
  }

  try {
    // Use date from request or default to last 3 months
    const sinceDate = body.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch all orders with pagination
    let allOrders = [];
    let url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/orders.json?status=any&limit=250&created_at_min=${sinceDate}`;
    
    while (url) {
      console.log(`Fetching from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_API_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      allOrders = allOrders.concat(data.orders || []);
      
      // Check for next page in Link header
      const linkHeader = response.headers.get('Link');
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
        url = nextMatch ? nextMatch[1] : null;
      } else {
        url = null;
      }
    }
    
    console.log(`Retrieved ${allOrders.length} total orders`);

    // Return all orders
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        orders: allOrders,
        count: allOrders.length 
      })
    };
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch orders', 
        details: error.message 
      })
    };
  }
};