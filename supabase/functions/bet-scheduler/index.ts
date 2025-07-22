import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { method } = req
  
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all pending bets that need to be settled
    const now = new Date()
    const { data: pendingBets, error: fetchError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('status', 'pending')
      .lte('settlement_time', now.toISOString())

    if (fetchError) {
      throw fetchError
    }

    const settlementResults = []

    // Process each pending bet
    for (const bet of pendingBets) {
      try {
        // Call settlement function for each bet
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/bet-settlement-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            betId: bet.id,
            settlementTime: bet.settlement_time,
            indexName: bet.index_name
          })
        })

        const result = await response.json()
        settlementResults.push({
          betId: bet.id,
          success: response.ok,
          result
        })
      } catch (error) {
        console.error(`Error settling bet ${bet.id}:`, error)
        settlementResults.push({
          betId: bet.id,
          success: false,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        settledBets: settlementResults.length,
        results: settlementResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})