-- Add status column to bets table
ALTER TABLE public.bets 
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Add index for better performance on status queries
CREATE INDEX idx_bets_status ON public.bets(status);

-- Add settlement_time column to store when the bet should be settled
ALTER TABLE public.bets 
ADD COLUMN settlement_time TIMESTAMP WITH TIME ZONE;