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
import { BankDetailsForm } from "./BankDetailsForm";
import { WithdrawalForm } from "./WithdrawalForm";

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
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unknown error occurred.",
          variant: "destructive",
        });
      }
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
      // Create Razorpay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-payment-order', {
        body: { amount }
      });

      if (orderError) throw orderError;

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.orderId,
          name: 'Betting Wallet',
          description: 'Add money to wallet',
          handler: async (response: any) => {
            try {
              // Verify payment
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                }
              });

              if (verifyError) throw verifyError;

              // Update the balance in the parent component
              onBalanceUpdate(balance + verifyData.amount);
              setAddAmount('');
              
              toast({
                title: "Payment Successful",
                description: `Successfully added ₹${verifyData.amount.toFixed(2)} to your wallet`,
              });
              
              // Refresh transactions
              fetchTransactions();
            } catch (error: any) {
              console.error('Payment verification error:', error);
              toast({
                title: "Payment Verification Failed",
                description: error.message || "Please contact support",
                variant: "destructive",
              });
            }
          },
          prefill: {
            email: 'user@example.com'
          },
          theme: {
            color: '#3399cc'
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      };
      document.head.appendChild(script);
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unknown error occurred.",
          variant: "destructive",
        });
      }
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
    <div className="w-full max-w-2xl mx-auto">
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <Tabs defaultValue="balance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="balance" className="text-xs sm:text-sm py-2">Wallet</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm py-2">History</TabsTrigger>
            <TabsTrigger value="bank-details" className="text-xs sm:text-sm py-2">Bank Details</TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs sm:text-sm py-2">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="balance" className="space-y-4 sm:space-y-6 mt-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <WalletIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-semibold">My Wallet</h2>
              </div>
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                ₹{balance.toFixed(2)}
              </div>
              <Badge variant="secondary" className="text-xs">Current Balance</Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Add Money (₹10 - ₹10,000)</Label>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="bg-gradient-to-r from-primary to-success hover:from-primary/90 hover:to-success/90 sm:px-6"
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Money
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
                    className="text-xs py-2"
                  >
                    ₹{amount}
                  </Button>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                <CreditCard className="h-3 w-3 inline mr-1" />
                Payments powered by Razorpay
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="text-base sm:text-lg font-semibold">Recent Transactions</h3>
            </div>

            {transactionsLoading ? (
              <LoadingSpinner text="Loading transactions..." className="py-8" />
            ) : transactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No transactions yet</p>
                <p className="text-xs sm:text-sm">
                  Add money or place bets to see transaction history
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div
                      className={`font-mono font-bold text-sm shrink-0 ${getTransactionColor(
                        transaction.type
                      )}`}
                    >
                      {getTransactionSign(transaction.type)}₹
                      {transaction.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bank-details" className="space-y-4 mt-4">
            <BankDetailsForm 
              userId={userId} 
              onBankDetailsAdded={fetchTransactions}
            />
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <WithdrawalForm 
              userId={userId} 
              balance={balance}
              onWithdrawalSuccess={() => {
                fetchTransactions();
                // Refresh wallet balance from parent
                onBalanceUpdate(balance);
              }}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
