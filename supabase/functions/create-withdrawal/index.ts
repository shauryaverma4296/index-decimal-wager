import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { amount, bank_detail_id } = await req.json();

    // Validate amount
    if (!amount || amount < 100) {
      throw new Error("Minimum withdrawal amount is ₹100");
    }

    // Use service role to check balance and create withdrawal
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabaseService
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error("Failed to fetch wallet balance");
    }

    if (wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Get bank details
    const { data: bankDetails, error: bankError } = await supabaseService
      .from("bank_details")
      .select("*")
      .eq("id", bank_detail_id)
      .eq("user_id", user.id)
      .single();

    if (bankError || !bankDetails) {
      throw new Error("Bank details not found");
    }

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    const authString = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Create fund account in Razorpay
    const fundAccountData = {
      account_type: "bank_account",
      bank_account: {
        name: bankDetails.account_holder_name,
        account_number: bankDetails.account_number,
        ifsc: bankDetails.ifsc_code
      },
      contact: {
        name: bankDetails.account_holder_name,
        email: user.email || "user@example.com",
        type: "customer"
      }
    };

    const fundAccountResponse = await fetch("https://api.razorpay.com/v1/fund_accounts", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fundAccountData),
    });

    if (!fundAccountResponse.ok) {
      const errorData = await fundAccountResponse.text();
      console.error("Fund account creation error:", errorData);
      throw new Error("Failed to create fund account");
    }

    const fundAccount = await fundAccountResponse.json();

    // Create payout
    const payoutData = {
      account_number: "2323230077516568", // Your Razorpay account number
      fund_account_id: fundAccount.id,
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `withdrawal_${user.id}_${Date.now()}`,
      narration: "Wallet withdrawal"
    };

    const payoutResponse = await fetch("https://api.razorpay.com/v1/payouts", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payoutData),
    });

    if (!payoutResponse.ok) {
      const errorData = await payoutResponse.text();
      console.error("Payout creation error:", errorData);
      throw new Error("Failed to create payout");
    }

    const payout = await payoutResponse.json();

    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabaseService
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount: amount,
        bank_detail_id: bank_detail_id,
        razorpay_fund_account_id: fundAccount.id,
        razorpay_payout_id: payout.id,
        status: payout.status
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("Withdrawal record error:", withdrawalError);
      throw new Error("Failed to create withdrawal record");
    }

    // Deduct amount from wallet if payout is processing
    if (payout.status === "processing" || payout.status === "queued") {
      const { error: deductError } = await supabaseService.rpc(
        "update_wallet_balance",
        {
          p_user_id: user.id,
          p_amount: amount,
          p_type: "debit",
          p_description: "Withdrawal to bank account",
          p_reference_id: payout.id
        }
      );

      if (deductError) {
        console.error("Wallet deduction error:", deductError);
        throw new Error("Failed to deduct amount from wallet");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        payout_status: payout.status,
        amount: amount
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