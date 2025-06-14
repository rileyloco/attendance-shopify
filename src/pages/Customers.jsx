// Customers.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import Papa from 'papaparse';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, first_name, last_name, email')
      .order('customer_id', { ascending: true });
    if (error) {
      console.error('Error fetching customers:', error.message);
      return;
    }
    setCustomers(data || []);
  }

async function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async ({ data }) => {
      const header = Object.keys(data[0] || {});
      const needed = ['Customer ID', 'First Name', 'Last Name', 'Email'];
      if (!needed.every((h) => header.includes(h))) {
        alert(`CSV must contain: ${needed.join(', ')}`);
        return;
      }

      // Map all valid rows (including existing customers for updates)
      const rows = data
        .map((r, index) => {
          const customer_id = parseInt(r['Customer ID']?.trim().replace(/^'/, ''), 10);
          const email = r['Email']?.trim().toLowerCase() || '';
          const row = {
            customer_id,
            first_name: r['First Name']?.trim() || '',
            last_name: r['Last Name']?.trim() || '',
            email,
          };
          
          // Log for debugging
          if (isNaN(customer_id)) {
            console.log(`Row ${index + 1} rejected:`, { row, reason: 'Invalid customer_id' });
            return null;
          } else if (!email) {
            console.log(`Row ${index + 1} rejected:`, { row, reason: 'Missing email' });
            return null;
          }
          
          return row;
        })
        .filter(r => r !== null); // Remove invalid rows

      console.log('Valid rows to upload/update:', rows);

      if (!rows.length) {
        alert('No valid customers to process.');
        return;
      }

      // Use upsert with onConflict to update existing records
      const { data: upsertedData, error } = await supabase
        .from('customers')
        .upsert(rows, { 
          onConflict: 'customer_id',
          returning: 'minimal' // Don't return all the data
        });
        
      if (error) {
        alert(`Error uploading customers: ${error.message}`);
      } else {
        // Count how many were new vs updated
        const { data: existingData } = await supabase
          .from('customers')
          .select('customer_id');
        
        const existingIds = new Set(existingData?.map(row => row.customer_id) || []);
        const newCount = rows.filter(r => !existingIds.has(r.customer_id)).length;
        const updateCount = rows.length - newCount;
        
        alert(`Successfully processed ${rows.length} customers!\n${newCount} new, ${updateCount} updated.`);
        fetchCustomers();
      }
    },
    error: (err) => alert(`CSV parse error: ${err.message}`),
  });
}

  const filteredCustomers = customers.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      padding: '4rem 0'
    }}>
      {/* Search and Upload Bar */}
      <div className="search-sync-container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '2rem',
        marginBottom: '3rem'
      }}>
        <input
          type="text"
          placeholder="Search customers..."
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
        <label style={{
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
          color: 'white',
          borderRadius: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          fontSize: '1rem',
          lineHeight: '1',
          height: 'auto'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 15px 35px rgba(255, 107, 53, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}>
          Upload CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      
      {/* Table Section */}
      <div className="table-container" style={{
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
        <DataTable
          headers={['Customer ID', 'First Name', 'Last Name', 'Email']}
          rows={filteredCustomers.map((c) => [
            c.customer_id,
            c.first_name || '-',
            c.last_name || '-',
            c.email || '-',
          ])}
        />
      </div>
    </div>
  );
}

export default Customers;