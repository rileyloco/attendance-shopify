// src/lib/customerCache.js
import { supabase } from './supabase';

class CustomerCache {
  constructor() {
    this.cache = null;
    this.cacheTime = null;
    this.cacheExpiry = 60 * 60 * 1000; // 1 hour in milliseconds
    this.loading = false;
    this.loadPromise = null;
  }

  // Check if cache is valid
  isCacheValid() {
    if (!this.cache || !this.cacheTime) return false;
    return Date.now() - this.cacheTime < this.cacheExpiry;
  }

  // Load customers from database
  async loadCustomers() {
    // If already loading, return the existing promise
    if (this.loading) {
      return this.loadPromise;
    }

    this.loading = true;
    
    this.loadPromise = supabase
      .from('customers')
      .select('customer_id, first_name, last_name, email')
      .order('customer_id', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading customers:', error);
          throw error;
        }

        // Create a map for fast lookup
        const customerMap = new Map();
        data.forEach(customer => {
          customerMap.set(customer.customer_id, customer);
        });

        this.cache = customerMap;
        this.cacheTime = Date.now();
        this.loading = false;

        // Also store in localStorage for persistence
        try {
          localStorage.setItem('customerCache', JSON.stringify({
            data: Array.from(customerMap.entries()),
            time: this.cacheTime
          }));
        } catch (e) {
          console.warn('Failed to save customer cache to localStorage:', e);
        }

        console.log(`Loaded ${customerMap.size} customers into cache`);
        return customerMap;
      })
      .catch(error => {
        this.loading = false;
        throw error;
      });

    return this.loadPromise;
  }

  // Get all customers
  async getAllCustomers() {
    if (this.isCacheValid()) {
      return this.cache;
    }

    // Try to load from localStorage first
    try {
      const stored = localStorage.getItem('customerCache');
      if (stored) {
        const { data, time } = JSON.parse(stored);
        this.cache = new Map(data);
        this.cacheTime = time;
        
        if (this.isCacheValid()) {
          console.log('Loaded customers from localStorage cache');
          return this.cache;
        }
      }
    } catch (e) {
      console.warn('Failed to load customer cache from localStorage:', e);
    }

    // Load from database
    return this.loadCustomers();
  }

  // Get a single customer by ID
  async getCustomer(customerId) {
    const customers = await this.getAllCustomers();
    return customers.get(customerId) || null;
  }

  // Get multiple customers by IDs
  async getCustomers(customerIds) {
    const customers = await this.getAllCustomers();
    return customerIds.map(id => customers.get(id) || null);
  }

  // Search customers by name
  async searchCustomers(query) {
    const customers = await this.getAllCustomers();
    const results = [];
    const lowerQuery = query.toLowerCase();

    customers.forEach(customer => {
      const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
      if (fullName.includes(lowerQuery)) {
        results.push(customer);
      }
    });

    return results;
  }

  // Clear cache (useful after adding new customers)
  clearCache() {
    this.cache = null;
    this.cacheTime = null;
    try {
      localStorage.removeItem('customerCache');
    } catch (e) {
      console.warn('Failed to clear customer cache from localStorage:', e);
    }
    console.log('Customer cache cleared');
  }

  // Refresh cache
  async refresh() {
    this.clearCache();
    return this.loadCustomers();
  }
}

// Export a singleton instance
export const customerCache = new CustomerCache();