# Special Guests Setup Instructions

## Overview
The special guests feature allows you to manage complimentary tickets separately from paid attendees for social events.

## Database Setup

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase dashboard
2. Navigate to the `social_attendance` table
3. Add a new column:
   - Name: `special_guest`
   - Type: `boolean`
   - Default value: `false`
4. Save the changes

### Option 2: Using SQL Editor
1. Go to SQL Editor in Supabase
2. Run the following SQL:
```sql
ALTER TABLE social_attendance 
ADD COLUMN IF NOT EXISTS special_guest BOOLEAN DEFAULT FALSE;
```

## Adding Special Guests

### Method 1: Using the SQL file
1. Open SQL Editor in Supabase
2. Copy and paste the contents of `add_special_guest_column.sql`
3. Execute the SQL

### Method 2: Using Browser Console
1. Open your application in the browser
2. Open Developer Console (F12)
3. Copy and paste the entire contents of `setup_special_guests.js`
4. Run: `setupSpecialGuests()`

## How It Works

1. **Guest Filter Dropdown**: Located next to the social event selector
   - "Paid" - Shows only regular paid attendees
   - "Special guests" - Shows only complimentary guests

2. **Special Guest Records**:
   - Have `special_guest = true` in the database
   - Use order IDs starting from 999001
   - Order numbers prefixed with "SPECIAL-"

## Managing Special Guests

To add more special guests:
1. Use order IDs above 999013
2. Set `special_guest = true`
3. Use order numbers like "SPECIAL-014", etc.

To convert a paid attendee to special guest:
```sql
UPDATE social_attendance 
SET special_guest = true 
WHERE customer_name = 'Name Here' AND social_date = '2025-06-14';
```

## Features
- Special guests appear only in the "Special guests" filter
- Paid attendees appear only in the "Paid" filter
- Both types can be checked in using the same interface
- Ticket tracking works identically for both types