import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Clock, Target } from "lucide-react";
import { BetHistory } from "./BetHistory";

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

interface Bet {
  id: string;
  index: string;
  amount: number;
  betType: "andar" | "bahar" | "pair";
  betNumber: number;
  actualValue: number;
  actualDecimal: number;
  isWin: boolean;
  winAmount: number;
  timestamp: Date;
}

const STOCK_INDICES = [
  { name: "Taiwan", timezone: "Asia/Taipei", marketOpen: 9, marketClose: 13.5 },
  { name: "Kospi", timezone: "Asia/Seoul", marketOpen: 9, marketClose: 15.5 },
  { name: "Hangseng", timezone: "Asia/Hong_Kong", marketOpen: 9.5, marketClose: 16 },
  { name: "Sensex", timezone: "Asia/Kolkata", marketOpen: 9.25, marketClose: 15.5 },
  { name: "Dax", timezone: "Europe/Berlin", marketOpen: 9, marketClose: 17.5 },
  { name: "Dow Jones", timezone: "America/New_York", marketOpen: 9.5, marketClose: 16 }
];

export const BettingApp = () => {
  const { toast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState<string>("");
  const [betAmount, setBetAmount] = useState<string>("");
  const [betType, setBetType] = useState<string>("");
  const [betNumber, setBetNumber] = useState<string>("");
  const [stockData, setStockData] = useState<Record<string, StockIndex>>({});
  const [bets, setBets] = useState<Bet[]>([]);
  const [marketOpen, setMarketOpen] = useState(true);

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

  // Simulate stock data
  useEffect(() => {
    const generateStockData = () => {
      const data: Record<string, StockIndex> = {};
      STOCK_INDICES.forEach(index => {
        data[index.name] = {
          name: index.name,
          value: Math.random() * 10000 + 10000,
          change: (Math.random() - 0.5) * 200,
          changePercent: (Math.random() - 0.5) * 4
        };
      });
      setStockData(data);
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

  const placeBet = () => {
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

    const newBet: Bet = {
      id: Date.now().toString(),
      index: selectedIndex,
      amount,
      betType: betType as "andar" | "bahar" | "pair",
      betNumber: number,
      actualValue: currentValue,
      actualDecimal: decimalPart,
      isWin,
      winAmount,
      timestamp: new Date()
    };

    setBets(prev => [newBet, ...prev]);
    
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
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            Stock Index Betting
          </h1>
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-muted-foreground">
              Market Status: {marketOpen ? "Open" : "Closed"}
            </span>
            <Badge variant={marketOpen ? "default" : "destructive"}>
              {marketOpen ? "LIVE" : "CLOSED"}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Betting Panel */}
          <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Place Your Bet</h2>
              </div>

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
                disabled={!marketOpen}
              >
                {marketOpen ? "Place Bet" : "Market Closed"}
              </Button>
            </div>
          </Card>

          {/* Bet History */}
          <BetHistory bets={bets} />
        </div>
      </div>
    </div>
  );
};