-- ============================================================
-- Naya System — Warehouse Items Seed
-- ============================================================

-- This script inserts the standard ingredient set and initializes inventory for all branches.
-- Run this in the Supabase SQL Editor.

DO $$
DECLARE
    ing_record RECORD;
    branch_record RECORD;
    new_ing_id UUID;
BEGIN
    -- 1. Create temporary table for ingredients to facilitate bulk insert/loop
    CREATE TEMP TABLE temp_ing (
        name TEXT,
        unit TEXT,
        price NUMERIC(10,4)
    );

    INSERT INTO temp_ing (name, unit, price) VALUES
    ('Falafel', 'BUCKET', 24.87),
    ('Hummus', 'BUCKET', 26.62),
    ('Habibi', 'BUCKET', 52.54),
    ('Red', 'BUCKET', 55.37),
    ('Garlic', 'BUCKET', 46.13),
    ('White', 'BUCKET', 33.27),
    ('Dressing', 'BUCKET', 49.15),
    ('Invisible', 'BUCKET', 45.28),
    ('Mazboot', 'BUCKET', 69.41),
    ('Tatbill', 'BAG', 2.67),
    ('Pickles', 'BUCKET', 39.53),
    ('Leetuce', 'CS', 35.64),
    ('Cucumber Salad', 'BAG', 6.92),
    ('Spinach', 'CS', 19.45),
    ('Pita', 'CS', 16.72),
    ('Fries', 'CS', 43.09),
    ('Zaater', 'CS', 70.00),
    ('Water', 'CS', 7.00),
    ('Stickers Big', 'ROLL', 5.00),
    ('Stickers Small', 'ROLL', 5.00),
    ('Pali Salad Spices', 'BAG', 1.58),
    ('Tahini Pali Paste', 'BUCKET', 26.18),
    ('Cabbage Spices', 'BAG', 1.96),
    ('Juice Shot', 'BAG', 19.63),
    ('Salt', 'EACH', 1.63),
    ('Olive Oil', 'BOTTLE', 36.65),
    ('Shawarma', 'BUCKET', 82.96),
    ('Vemto', 'CS', 22.52),
    ('Barbican', 'CS', 28.86),
    ('Kinder Bueno', 'CS', 0.45),
    ('Habibi Bottle', 'EACH', 1.87),
    ('Hummus Side', 'EACH', 1.09),
    ('Rice', 'BAG', 34.46),
    ('Baklava', 'BOX', 39.00),
    ('Cilantro', 'BAG', 4.24),
    ('Rice Spices', 'BAG', 1.13),
    ('Margarita', 'EACH', 1.04),
    ('Bulger', 'BAG', 1.05),
    ('Taboli Spices', 'BAG', 1.13),
    ('Chicken', 'BUCKET', 69.18),
    ('Uber Stickers', 'ROLL', 20.00),
    ('Branded Bags', 'CS', 10.00),
    ('Canves Bags', 'EACH', 2.00),
    ('Flat Bread', 'CS', 37.31),
    ('Sumac', 'BAG', 3.50),
    ('Shawarma spice', 'BAG', 1.10),
    ('Shawarma Juice', 'BAG', 0.50),
    ('Shawarma wrap paper', 'CS', 52.50),
    ('Shawarma sleeve', 'CS', 30.10),
    ('Shawarma Garlic', 'BUCKET', 46.13),
    ('Shawarma Sticker', 'ROLL', 12.00),
    ('Mint', 'BAG', 1.20),
    ('Habibi Glass Stickers', 'EACH', 0.50),
    ('Shawarma Box', 'CS', 63.00),
    ('Garlic Mayo', 'BUCKET', 51.00),
    ('Gift cards', 'EACH', 1.29),
    ('Pali Drink', 'CS', 25.00),
    ('Schwepps', 'CS', 17.00),
    ('Shawrma Snack Sticker', 'ROLL', 12.00),
    ('Display Sticker', 'ROLL', 10.00),
    ('Fattoush Dressing', 'EACH', 5.00),
    ('Fattoush Container', 'CS', 45.00),
    ('Honey', 'EACH', 6.16),
    ('Labna', 'BUCKET', 86.40),
    ('Chicken spice', 'BAG', 5.00),
    ('Chicken liquid', 'BAG', 5.00),
    ('Chicken bags', 'EACH', 6.32);

    -- 2. Loop and Insert Ingredients
    FOR ing_record IN SELECT * FROM temp_ing LOOP
        INSERT INTO ingredients (name, unit, cost_per_unit, low_stock_threshold)
        VALUES (ing_record.name, ing_record.unit, ing_record.price, 0)
        ON CONFLICT DO NOTHING
        RETURNING id INTO new_ing_id;

        -- If ingredient already exists, get its actual ID
        IF new_ing_id IS NULL THEN
            SELECT id INTO new_ing_id FROM ingredients WHERE name = ing_record.name;
        END IF;

        -- 3. Initialize Inventory for all branches
        FOR branch_record IN SELECT id FROM branches LOOP
            INSERT INTO inventory (branch_id, ingredient_id, quantity_on_hand, counted_at)
            VALUES (branch_record.id, new_ing_id, 0, CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    DROP TABLE temp_ing;
END $$;
