import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BankDetail {
  id: string;
  account_number: string;
  bank_name: string;
  account_holder_name: string;
  ifsc_code: string;
}

interface WithdrawalFormProps {
  userId: string;
  balance: number;
  onWithdrawalSuccess: () => void;
}

export function WithdrawalForm({ userId, balance, onWithdrawalSuccess }: WithdrawalFormProps) {
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchBankDetails();
    fetchWithdrawals();
  }, [userId]);

  const fetchBankDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_details')
        .select('id, account_number, bank_name, account_holder_name, ifsc_code')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBankDetails(data || []);
    } catch (error) {
      console.error('Error fetching bank details:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          bank_details:bank_detail_id (
            bank_name,
            account_number
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const withdrawalAmount = parseFloat(amount);
    
    if (!withdrawalAmount || withdrawalAmount < 100) {
      toast({
        title: "Error",
        description: "Minimum withdrawal amount is ₹100",
        variant: "destructive",
      });
      return;
    }

    if (withdrawalAmount > balance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBankId) {
      toast({
        title: "Error",
        description: "Please select a bank account",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-withdrawal', {
        body: {
          amount: withdrawalAmount,
          bank_detail_id: selectedBankId
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Withdrawal of ₹${withdrawalAmount} initiated successfully`,
      });

      setAmount('');
      setSelectedBankId('');
      fetchWithdrawals();
      onWithdrawalSuccess();
    } catch (error: any) {
      console.error('Error creating withdrawal:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'queued': return 'text-yellow-600';
      case 'cancelled': return 'text-red-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (bankDetails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Money</CardTitle>
          <CardDescription>
            You need to add bank details before you can withdraw money.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Money</CardTitle>
          <CardDescription>
            Withdraw money from your wallet to your bank account. Available balance: ₹{balance.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-sm">Withdrawal Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (min ₹100)"
                min="100"
                max={balance}
                step="0.01"
                className="text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="bank_account" className="text-sm">Select Bank Account</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Choose bank account" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {bankDetails.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id} className="text-sm">
                      <div className="truncate max-w-full">
                        {bank.bank_name} - ****{bank.account_number.slice(-4)} ({bank.account_holder_name})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Withdraw Money
            </Button>
          </form>
        </CardContent>
      </Card>

      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="p-3 sm:p-4 border rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm"><strong>Amount:</strong> ₹{withdrawal.amount}</p>
                      <p className="text-sm"><strong>Bank:</strong> <span className="break-words">{withdrawal.bank_details?.bank_name}</span></p>
                      <p className="text-sm"><strong>Account:</strong> ****{withdrawal.bank_details?.account_number?.slice(-4)}</p>
                      <p className="text-sm"><strong>Date:</strong> {new Date(withdrawal.created_at).toLocaleDateString()}</p>
                      {withdrawal.failure_reason && (
                        <p className="text-sm text-error"><strong>Reason:</strong> <span className="break-words">{withdrawal.failure_reason}</span></p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-medium text-sm ${getStatusColor(withdrawal.status)}`}>
                        {withdrawal.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}