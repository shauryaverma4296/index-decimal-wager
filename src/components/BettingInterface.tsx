import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface StockIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface IndexConfig {
  name: string;
  timezone: string;
  marketOpen: number;
  marketClose: number;
}

interface BettingInterfaceProps {
  user: User;
  walletBalance: number;
  onWalletUpdate: (newBalance: number) => void;
  onBetPlaced: () => void;
}

const STOCK_INDICES = [
  { name: "Taiwan", timezone: "Asia/Taipei", marketOpen: 9, marketClose: 13.5 },
  { name: "Kospi", timezone: "Asia/Seoul", marketOpen: 9, marketClose: 15.5 },
  { name: "Hangseng", timezone: "Asia/Hong_Kong", marketOpen: 9.5, marketClose: 16 },
  { name: "Sensex", timezone: "Asia/Kolkata", marketOpen: 9.25, marketClose: 15.5 },
  { name: "Dax", timezone: "Europe/Berlin", marketOpen: 9, marketClose: 17.5 },
  { name: "Dow Jones", timezone: "America/New_York", marketOpen: 9.5, marketClose: 16 }
];

export const BettingInterface = ({ user, walletBalance, onWalletUpdate, onBetPlaced }: BettingInterfaceProps) => {
  const { toast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState<string>("");
  const [betAmount, setBetAmount] = useState<string>("");
  const [betType, setBetType] = useState<string>("");
  const [betNumber, setBetNumber] = useState<string>("");
  const [stockData, setStockData] = useState<Record<string, StockIndex>>({});
  const [marketOpen, setMarketOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Check if market is open based on timezone
  const isMarketOpen = (indexConfig: IndexConfig) => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: indexConfig.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const timeString = formatter.format(now);
    const [hours, minutes] = timeString.split(':').map(Number);
    const currentTime = hours + minutes / 60;
    
    return currentTime >= indexConfig.marketOpen && currentTime <= indexConfig.marketClose;
  };

  // Simulate stock data with loading
  useEffect(() => {
    const generateStockData = () => {
      setDataLoading(true);
      
      setTimeout(() => {
        const data: Record<string, StockIndex> = {};
        STOCK_INDICES.forEach(index => {
          data[index.name] = {
            name: index.name,
            value: parseFloat((Math.random() * 10000 + 10000).toFixed(2)),
            change: (Math.random() - 0.5) * 200,
            changePercent: (Math.random() - 0.5) * 4
          };
        });
        setStockData(data);
        setDataLoading(false);
      }, 1000);
    };

    generateStockData();
    const interval = setInterval(generateStockData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Check market status based on selected index
  useEffect(() => {
    if (selectedIndex) {
      const indexConfig = STOCK_INDICES.find(idx => idx.name === selectedIndex);
      if (indexConfig) {
        setMarketOpen(isMarketOpen(indexConfig));
      }
    }
  }, [selectedIndex]);

  const placeBet = async () => {
    if (!selectedIndex || !betAmount || !betType || !betNumber) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseInt(betAmount);
    if (amount < 10 || amount > 500) {
      toast({
        title: "Error", 
        description: "Bet amount must be between ₹10-₹500",
        variant: "destructive",
      });
      return;
    }

    // Check wallet balance
    if (walletBalance < amount) {
      toast({
        title: "Insufficient Balance",
        description: "Please add money to your wallet",
        variant: "destructive",
      });
      return;
    }

    const number = parseInt(betNumber);
    
    // Validation for Andar/Bahar - only single digit allowed
    if ((betType === "andar" || betType === "bahar") && (isNaN(number) || number < 0 || number > 9)) {
      toast({
        title: "Error",
        description: "For Andar/Bahar bets, please enter a single digit (0-9)",
        variant: "destructive",
      });
      return;
    }
    
    // Validation for Pair - two digits allowed
    if (betType === "pair" && (isNaN(number) || number < 0 || number > 99)) {
      toast({
        title: "Error",
        description: "For Pair bets, please enter a valid number (0-99)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const currentValue = stockData[selectedIndex]?.value || 0;
      const decimalPart = Math.floor((currentValue % 1) * 100);
      
      let isWin = false;
      if (betType === "andar") {
        isWin = Math.floor(decimalPart / 10) === Math.floor(number / 10);
      } else if (betType === "bahar") {
        isWin = decimalPart % 10 === number % 10;
      } else if (betType === "pair") {
        isWin = decimalPart === number;
      }

      const winAmount = isWin ? amount * 0.95 : 0;

      // Deduct bet amount from wallet
      await supabase.rpc("update_wallet_balance", {
        p_user_id: user.id,
        p_amount: amount,
        p_type: "bet_place",
        p_description: `Bet placed on ${selectedIndex}`,
        p_reference_id: `bet_${Date.now()}`
      });

      // Save bet to database
      const { data: betData, error: betError } = await supabase
        .from("bets")
        .insert({
          user_id: user.id,
          index_name: selectedIndex,
          amount,
          bet_type: betType,
          bet_number: number,
          actual_value: currentValue,
          actual_decimal: decimalPart,
          is_win: isWin,
          win_amount: winAmount
        })
        .select()
        .single();

      if (betError) throw betError;

      // If win, add winning amount to wallet
      if (isWin) {
        await supabase.rpc("update_wallet_balance", {
          p_user_id: user.id,
          p_amount: winAmount,
          p_type: "bet_win",
          p_description: `Winnings from ${selectedIndex} bet`,
          p_reference_id: betData.id
        });
      }

      // Update local wallet balance
      onWalletUpdate(isWin ? walletBalance - amount + winAmount : walletBalance - amount);
      
      toast({
        title: isWin ? "Congratulations!" : "Better luck next time!",
        description: isWin 
          ? `You won ₹${winAmount.toFixed(2)}!`
          : `You lost ₹${amount}. Try again!`,
        variant: isWin ? "default" : "destructive",
      });

      // Reset form
      setBetAmount("");
      setBetNumber("");
      onBetPlaced(); // Notify parent to refresh bet history
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

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Place Your Bet</h2>
          </div>

          {dataLoading ? (
            <LoadingSpinner text="Loading market data..." className="py-8" />
          ) : (
            <>
              {/* Index Selection */}
              <div className="space-y-2">
                <Label>Select Stock Index</Label>
                <Select value={selectedIndex} onValueChange={setSelectedIndex}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an index" />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_INDICES.map(index => (
                      <SelectItem key={index.name} value={index.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{index.name}</span>
                          {stockData[index.name] && (
                            <div className="flex items-center gap-2 ml-4">
                              <span className="font-mono">
                                {stockData[index.name].value.toFixed(2)}
                              </span>
                              {stockData[index.name].change >= 0 ? (
                                <TrendingUp className="h-3 w-3 text-success" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-error" />
                              )}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Value Display */}
              {selectedIndex && stockData[selectedIndex] && (
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-2xl font-mono font-bold">
                        {stockData[selectedIndex].value.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${stockData[selectedIndex].change >= 0 ? 'text-success' : 'text-error'}`}>
                        {stockData[selectedIndex].change >= 0 ? '+' : ''}{stockData[selectedIndex].change.toFixed(2)}
                      </p>
                      <p className={`text-xs ${stockData[selectedIndex].changePercent >= 0 ? 'text-success' : 'text-error'}`}>
                        ({stockData[selectedIndex].changePercent >= 0 ? '+' : ''}{stockData[selectedIndex].changePercent.toFixed(2)}%)
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bet Type */}
              <div className="space-y-2">
                <Label>Bet Type</Label>
                <Select value={betType} onValueChange={setBetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose bet type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="andar">Andar (First decimal digit .X0)</SelectItem>
                    <SelectItem value="bahar">Bahar (Second decimal digit .0X)</SelectItem>
                    <SelectItem value="pair">Pair (Both decimal digits .XX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bet Number */}
              <div className="space-y-2">
                <Label>
                  Your Number {betType === "pair" ? "(0-99)" : betType && "(0-9)"}
                </Label>
                <Input
                  type="number"
                  value={betNumber}
                  onChange={(e) => setBetNumber(e.target.value)}
                  placeholder={
                    betType === "pair" 
                      ? "Enter two digits (00-99)" 
                      : betType 
                        ? "Enter single digit (0-9)"
                        : "Select bet type first"
                  }
                  min="0"
                  max={betType === "pair" ? "99" : betType ? "9" : "99"}
                  disabled={!betType}
                />
              </div>

              {/* Bet Amount */}
              <div className="space-y-2">
                <Label>Bet Amount (₹10 - ₹500)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="pl-10"
                    min="10"
                    max="500"
                  />
                </div>
              </div>

              <Button 
                onClick={placeBet} 
                className="w-full bg-gradient-to-r from-primary to-success hover:from-primary/90 hover:to-success/90"
                disabled={!marketOpen || loading || !selectedIndex || !betType || !betNumber || !betAmount}
              >
                {loading ? (
                  <LoadingSpinner size="sm" text="Placing bet..." />
                ) : !marketOpen ? (
                  "Market Closed"
                ) : (
                  "Place Bet"
                )}
              </Button>

              {!marketOpen && (
                <div className="text-center text-sm text-muted-foreground">
                  <Badge variant="destructive" className="mb-2">
                    Market Closed for {selectedIndex}
                  </Badge>
                  <p>Selected market is currently closed. Please try again during market hours.</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};