-- Insert special guest data for June 14th event
-- First, ensure any existing special guest records are removed to avoid conflicts
DELETE FROM social_attendance 
WHERE order_id >= 999001 AND order_id <= 999013;

-- Insert all special guests
INSERT INTO social_attendance (
    order_id, 
    order_number, 
    customer_id, 
    customer_name, 
    customer_email, 
    social_date, 
    social_name, 
    total_tickets, 
    tickets_used, 
    special_guest
) VALUES 
    (999001, 'SPECIAL-001', NULL, 'Grace', 'grace@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999002, 'SPECIAL-002', NULL, 'Justin', 'justin@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999003, 'SPECIAL-003', NULL, 'Thea', 'thea@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999004, 'SPECIAL-004', NULL, 'Andy', 'andy@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999005, 'SPECIAL-005', NULL, 'Diego', 'diego@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999006, 'SPECIAL-006', NULL, 'Nathalia', 'nathalia@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999007, 'SPECIAL-007', NULL, 'Rin', 'rin@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999008, 'SPECIAL-008', NULL, 'Jenna', 'jenna@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999009, 'SPECIAL-009', NULL, 'Naomi', 'naomi@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999010, 'SPECIAL-010', NULL, 'Mariam', 'mariam@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999011, 'SPECIAL-011', NULL, 'Prashant', 'prashant@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999012, 'SPECIAL-012', NULL, 'Brian', 'brian@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE),
    (999013, 'SPECIAL-013', NULL, 'Nisha', 'nisha@example.com', '2025-06-14', 'LocoMojo First Social - June 14th', 1, 0, TRUE);

-- Update any existing paid records to ensure they have special_guest = FALSE
UPDATE social_attendance 
SET special_guest = FALSE 
WHERE special_guest IS NULL;