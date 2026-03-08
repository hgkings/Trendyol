-- Change default for pro_renewal to false (tek seferlik ödeme modeli)
ALTER TABLE public.profiles 
    ALTER COLUMN pro_renewal SET DEFAULT false;

-- Update existing NULL or true records to false if they are one-time payments (we'll just set NULLs to false as requested)
UPDATE public.profiles 
SET pro_renewal = false 
WHERE pro_renewal IS NULL;
