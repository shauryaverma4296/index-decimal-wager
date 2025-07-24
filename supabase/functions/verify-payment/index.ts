import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing payment verification data");
    }

    // Verify signature
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      throw new Error("Razorpay key secret not configured");
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = await createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new Error("Invalid payment signature");
    }

    // Get payment details from Razorpay
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const authString = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        headers: {
          "Authorization": `Basic ${authString}`,
        },
      }
    );

    if (!paymentResponse.ok) {
      throw new Error("Failed to fetch payment details");
    }

    const payment = await paymentResponse.json();

    if (payment.status !== "captured") {
      throw new Error("Payment not captured");
    }

    // Use service role to update wallet
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Update wallet balance
    const amount = payment.amount / 100; // Convert from paise to rupees
    const { error: walletError } = await supabaseService.rpc(
      "update_wallet_balance",
      {
        p_user_id: user.id,
        p_amount: amount,
        p_type: "credit",
        p_description: "Wallet top-up via Razorpay",
        p_reference_id: razorpay_payment_id
      }
    );

    if (walletError) {
      console.error("Wallet update error:", walletError);
      throw new Error("Failed to update wallet balance");
    }

    return new Response(
      JSON.stringify({
        success: true,
        amount: amount,
        paymentId: razorpay_payment_id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});