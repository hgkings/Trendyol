-- Migration: Add competitor tracking fields to analyses table
ALTER TABLE analyses 
ADD COLUMN IF NOT EXISTS competitor_price NUMERIC,
ADD COLUMN IF NOT EXISTS competitor_name TEXT,
ADD COLUMN IF NOT EXISTS target_position TEXT;
