import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletIcon, Plus, History, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "./LoadingSpinner";

interface WalletProps {
  userId: string;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export const Wallet = ({ userId, balance, onBalanceUpdate }: WalletProps) => {
  const { toast } = useToast();
  const [addAmount, setAddAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  const addMoney = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount < 10 || amount > 10000) {
      toast({
        title: "Error",
        description: "Please enter amount between ₹10-₹10,000",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // In a real app, this would integrate with a payment gateway
      // For demo purposes, we'll directly add money to wallet
      const { error } = await supabase.rpc("update_wallet_balance", {
        p_user_id: userId,
        p_amount: amount,
        p_type: "credit",
        p_description: "Money added to wallet",
        p_reference_id: `add_${Date.now()}`
      });

      if (error) throw error;

      // Update local balance
      onBalanceUpdate(balance + amount);
      
      toast({
        title: "Success",
        description: `₹${amount} added to your wallet!`,
      });
      
      setAddAmount("");
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "credit":
      case "bet_win":
        return "text-success";
      case "debit":
      case "bet_place":
        return "text-error";
      default:
        return "text-muted-foreground";
    }
  };

  const getTransactionSign = (type: string) => {
    return type === "credit" || type === "bet_win" ? "+" : "-";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <Tabs defaultValue="balance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balance">Wallet</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <WalletIcon className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">My Wallet</h2>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
              ₹{balance.toFixed(2)}
            </div>
            <Badge variant="secondary">Current Balance</Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add Money (₹10 - ₹10,000)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="10"
                  max="10000"
                  className="flex-1"
                />
                <Button
                  onClick={addMoney}
                  disabled={loading}
                  className="bg-gradient-to-r from-primary to-success hover:from-primary/90 hover:to-success/90"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[100, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setAddAmount(amount.toString())}
                  className="text-xs"
                >
                  ₹{amount}
                </Button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-center">
              <CreditCard className="h-3 w-3 inline mr-1" />
              In production, this would integrate with Razorpay or similar payment gateway
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Recent Transactions</h3>
          </div>

          {transactionsLoading ? (
            <LoadingSpinner text="Loading transactions..." className="py-8" />
          ) : transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Add money or place bets to see transaction history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={`font-mono font-bold ${getTransactionColor(transaction.type)}`}>
                    {getTransactionSign(transaction.type)}₹{transaction.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};