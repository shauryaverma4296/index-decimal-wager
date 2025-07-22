import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StockIndex {
  name: string;
  timezone: string;
  marketOpen: number;
  marketClose: number;
}

const STOCK_INDICES: StockIndex[] = [
  { name: "Taiwan", timezone: "Asia/Taipei", marketOpen: 9, marketClose: 13.5 },
  { name: "Kospi", timezone: "Asia/Seoul", marketOpen: 9, marketClose: 15.5 },
  { name: "Hangseng", timezone: "Asia/Hong_Kong", marketOpen: 9.5, marketClose: 16 },
  { name: "Sensex", timezone: "Asia/Kolkata", marketOpen: 9.25, marketClose: 15.5 },
  { name: "Dax", timezone: "Europe/Berlin", marketOpen: 9, marketClose: 17.5 },
  { name: "Dow Jones", timezone: "America/New_York", marketOpen: 9.5, marketClose: 16 }
];

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

    const { betId, settlementTime, indexName } = await req.json()

    // Get the stock index configuration
    const indexConfig = STOCK_INDICES.find(idx => idx.name === indexName)
    if (!indexConfig) {
      throw new Error('Invalid index name')
    }

    // Check if it's time to settle the bet
    const now = new Date()
    const settlement = new Date(settlementTime)
    const shouldSettle = now >= settlement

    if (!shouldSettle) {
      // Schedule the settlement for later - just return success
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Bet scheduled for settlement',
          settlementTime: settlement.toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Generate random stock value (in real app, fetch from external API)
    const stockValue = parseFloat((Math.random() * 10000 + 10000).toFixed(2))
    const decimalPart = Math.floor((stockValue % 1) * 10)

    // Get the bet details
    const { data: bet, error: betError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('id', betId)
      .single()

    if (betError || !bet) {
      throw new Error('Bet not found')
    }

    // Determine if bet wins
    let isWin = false
    const betNumber = parseInt(bet.bet_number)

    switch (bet.bet_type) {
      case 'andar':
        isWin = decimalPart === betNumber
        break
      case 'bahar':
        isWin = decimalPart === betNumber
        break
      case 'pair':
        const lastTwoDigits = Math.floor(stockValue) % 100
        isWin = lastTwoDigits === betNumber
        break
    }

    const winAmount = isWin ? bet.amount * 0.95 : 0

    // Update bet with results
    const { error: updateError } = await supabaseClient
      .from('bets')
      .update({
        actual_value: stockValue,
        actual_decimal: decimalPart,
        is_win: isWin,
        win_amount: winAmount,
        status: 'settled'
      })
      .eq('id', betId)

    if (updateError) {
      throw new Error('Failed to update bet')
    }

    // Update wallet if win
    if (isWin) {
      const { error: walletError } = await supabaseClient.rpc('update_wallet_balance', {
        p_user_id: bet.user_id,
        p_amount: winAmount,
        p_type: 'bet_win',
        p_description: `Winnings from ${bet.index_name} bet`,
        p_reference_id: betId
      })

      if (walletError) {
        console.error('Wallet update error:', walletError)
      }
    }

    // Broadcast settlement via websocket
    const settlementData = {
      betId,
      actualValue: stockValue,
      decimalPart,
      isWin
    }

    // Call websocket function to broadcast
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/websocket-betting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        type: 'broadcast_settlement',
        data: settlementData
      })
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: settlementData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Settlement error:', error)
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