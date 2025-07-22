import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BetSettlement {
  betId: string;
  actualValue: number;
  decimalPart: number;
  isWin: boolean;
}

// Store active websocket connections
const connections = new Map<string, WebSocket>();

serve(async (req) => {
  const { method } = req
  
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const upgrade = req.headers.get("upgrade") || ""
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected websocket", { status: 426 })
  }

  const webSocketPair = new WebSocketPair()
  const [client, server] = Object.values(webSocketPair)
  
  const socket = server
  
  server.accept()
  const connectionId = crypto.randomUUID()
  
  socket.addEventListener("open", () => {
    console.log(`WebSocket connection opened: ${connectionId}`)
    connections.set(connectionId, socket)
  })

  socket.addEventListener("message", async (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log(`Received message from ${connectionId}:`, data)
      
      // Handle different message types
      if (data.type === 'subscribe_bets') {
        // Client wants to subscribe to bet settlements
        socket.send(JSON.stringify({
          type: 'subscription_confirmed',
          message: 'Subscribed to bet settlements'
        }))
      }
      
    } catch (error) {
      console.error('Error processing message:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }))
    }
  })

  socket.addEventListener("close", () => {
    console.log(`WebSocket connection closed: ${connectionId}`)
    connections.delete(connectionId)
  })

  socket.addEventListener("error", (e) => {
    console.log(`WebSocket error for ${connectionId}:`, e)
    connections.delete(connectionId)
  })

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
})

// Function to broadcast bet settlement to all connected clients
export async function broadcastBetSettlement(settlement: BetSettlement) {
  const message = JSON.stringify({
    type: 'bet_settlement',
    betId: settlement.betId,
    result: {
      actualValue: settlement.actualValue,
      decimalPart: settlement.decimalPart,
      isWin: settlement.isWin
    }
  })

  // Send to all connected clients
  for (const [connectionId, socket] of connections) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message)
      } else {
        // Clean up closed connections
        connections.delete(connectionId)
      }
    } catch (error) {
      console.error(`Error sending to ${connectionId}:`, error)
      connections.delete(connectionId)
    }
  }
}