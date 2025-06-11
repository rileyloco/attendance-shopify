// data-fetcher.js
// Centralized data fetching service for all reports

class DataFetcher {
    constructor(config = {}) {
        this.config = {
            shopifyEndpoint: '/.netlify/functions/shopify-orders',
            supabaseUrl: config.supabaseUrl || '',
            supabaseKey: config.supabaseKey || '',
            ...config
        };
        
        // Initialize Supabase client if credentials provided
        if (this.config.supabaseUrl && this.config.supabaseKey) {
            // In production, you'd initialize Supabase client here
            // this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
        }
    }

    // Fetch all data sources
    async fetchAllData(options = {}) {
        const startTime = Date.now();
        const results = {
            shopifyOrders: [],
            paidOrders: [],
            freeOrders: [],
            paidAttendance: [],
            freeAttendance: [],
            customers: [],
            consoleSettings: {},
            log: [],
            metadata: {
                fetchTime: null,
                errors: [],
                sources: []
            }
        };

        try {
            // Fetch data in parallel where possible
            const [shopifyData, supabaseData] = await Promise.all([
                this.fetchShopifyOrders(options.shopify || {}),
                this.fetchSupabaseData(options.supabase || {})
            ]);

            // Merge results
            results.shopifyOrders = shopifyData.orders || [];
            Object.assign(results, supabaseData);
            
            results.metadata.fetchTime = Date.now() - startTime;
            results.metadata.sources = ['shopify', 'supabase'];
            
        } catch (error) {
            results.metadata.errors.push({
                source: 'general',
                error: error.message
            });
        }

        return results;
    }

    // Fetch Shopify orders
    async fetchShopifyOrders(options = {}) {
        try {
            // Default to 3 months of data
            const since = options.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            
            const response = await fetch(this.config.shopifyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ since })
            });

            if (!response.ok) {
                throw new Error(`Shopify API error: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract all unique fields for analysis
            if (data.orders && data.orders.length > 0) {
                this.analyzeDataStructure('shopifyOrders', data.orders[0]);
            }
            
            return data;
            
        } catch (error) {
            console.error('Error fetching Shopify orders:', error);
            return { orders: [], error: error.message };
        }
    }

    // Fetch Supabase data
    async fetchSupabaseData(options = {}) {
        const results = {
            paidOrders: [],
            freeOrders: [],
            paidAttendance: [],
            freeAttendance: [],
            customers: [],
            consoleSettings: {},
            log: []
        };

        // If no Supabase client, return sample data for testing
        if (!this.config.supabaseUrl) {
            return this.getSampleSupabaseData();
        }

        try {
            // In production, you'd fetch from Supabase here
            // Example:
            /*
            const { data: paidOrders, error: paidOrdersError } = await this.supabase
                .from('paid_orders')
                .select('*')
                .order('order_date', { ascending: false });
            
            if (!paidOrdersError) {
                results.paidOrders = paidOrders;
            }
            */
            
            return results;
            
        } catch (error) {
            console.error('Error fetching Supabase data:', error);
            return results;
        }
    }

    // Analyze data structure for reporting
    analyzeDataStructure(dataType, sampleObject) {
        if (!sampleObject) return;
        
        const structure = this.extractStructure(sampleObject);
        
        // Store structure for reference
        if (!window.dataStructures) {
            window.dataStructures = {};
        }
        window.dataStructures[dataType] = structure;
        
        console.log(`Data structure for ${dataType}:`, structure);
    }

    // Recursively extract object structure
    extractStructure(obj, maxDepth = 3, currentDepth = 0) {
        if (currentDepth >= maxDepth) return '...';
        
        const structure = {};
        
        for (const key in obj) {
            const value = obj[key];
            const type = Array.isArray(value) ? 'array' : typeof value;
            
            structure[key] = {
                type: type,
                nullable: value === null,
                sample: type === 'object' && value !== null && !Array.isArray(value)
                    ? this.extractStructure(value, maxDepth, currentDepth + 1)
                    : type === 'array' && value.length > 0
                    ? [this.extractStructure(value[0], maxDepth, currentDepth + 1)]
                    : value
            };
        }
        
        return structure;
    }

    // Get sample data for testing
    getSampleSupabaseData() {
        return {
            paidOrders: [
                {
                    id: 1,
                    order_id: 'SHOP-001',
                    customer_id: 'CUST-123',
                    order_date: '2025-01-15T10:00:00Z',
                    classes: ['Level 1', 'Level 2'],
                    role: 'Leader',
                    paid: true,
                    notes: 'New student'
                },
                {
                    id: 2,
                    order_id: 'SHOP-002',
                    customer_id: 'CUST-456',
                    order_date: '2025-01-16T14:30:00Z',
                    classes: ['Body Movement', 'Shines'],
                    role: '',
                    paid: true,
                    notes: ''
                }
            ],
            freeOrders: [
                {
                    id: 1,
                    order_id: 'FREE-001',
                    customer_id: 'CUST-789',
                    class_date: '2025-01-20',
                    class: 'Free Class - New York Salsa',
                    role: 'Follower',
                    paid: false,
                    notes: 'First time visitor'
                }
            ],
            paidAttendance: [
                {
                    id: 1,
                    customer_id: 'CUST-123',
                    class_name: 'Level 1',
                    role: 'Leader',
                    term: 'Term 2',
                    block: 'A',
                    week_1: true,
                    week_2: true,
                    week_3: false,
                    week_4: true,
                    week_5: false,
                    notes: ''
                }
            ],
            freeAttendance: [
                {
                    id: 1,
                    customer_id: 'CUST-789',
                    role: 'Follower',
                    class_date: '2025-01-20',
                    attended: true
                }
            ],
            customers: [
                {
                    customer_id: 'CUST-123',
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john.doe@example.com',
                    phone: '+1234567890',
                    created_at: '2024-12-01T00:00:00Z'
                },
                {
                    customer_id: 'CUST-456',
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane.smith@example.com',
                    phone: '+0987654321',
                    created_at: '2024-12-15T00:00:00Z'
                }
            ],
            consoleSettings: {
                id: 1,
                term: '2',
                block: 'A',
                start_date: '2025-01-15',
                end_date: '2025-02-19'
            },
            log: [
                {
                    id: 1,
                    action: 'attendance_marked',
                    user: 'admin',
                    timestamp: '2025-01-15T10:30:00Z',
                    details: 'Marked attendance for CUST-123'
                }
            ]
        };
    }

    // Export data for analysis
    async exportDataDump() {
        const allData = await this.fetchAllData();
        
        // Create a detailed dump with metadata
        const dataDump = {
            exportDate: new Date().toISOString(),
            dataStructures: window.dataStructures || {},
            data: allData,
            summary: {
                shopifyOrders: allData.shopifyOrders.length,
                paidOrders: allData.paidOrders.length,
                freeOrders: allData.freeOrders.length,
                customers: allData.customers.length,
                paidAttendanceRecords: allData.paidAttendance.length,
                freeAttendanceRecords: allData.freeAttendance.length
            }
        };
        
        // Create downloadable file
        const blob = new Blob([JSON.stringify(dataDump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-dump-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        return dataDump;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataFetcher;
}