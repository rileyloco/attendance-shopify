-- Add total_spots and spots_used columns to free_attendance table
ALTER TABLE free_attendance 
ADD COLUMN IF NOT EXISTS total_spots INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS spots_used INT DEFAULT 0;

-- Update existing records to set total_spots and spots_used based on attended status
UPDATE free_attendance 
SET 
    total_spots = 1,
    spots_used = CASE 
        WHEN attended = true THEN 1 
        ELSE 0 
    END
WHERE total_spots IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN free_attendance.total_spots IS 'Total number of spots purchased in the order';
COMMENT ON COLUMN free_attendance.spots_used IS 'Number of spots that have been used/attended';