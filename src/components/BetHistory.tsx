import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, History, TrendingUp, TrendingDown } from "lucide-react";

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

interface BetHistoryProps {
  bets: Bet[];
}

export const BetHistory = ({ bets }: BetHistoryProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const totalWinnings = bets.reduce((sum, bet) => sum + bet.winAmount, 0);
  const totalBets = bets.length;
  const winRate = totalBets > 0 ? (bets.filter(bet => bet.isWin).length / totalBets) * 100 : 0;

  const getBetTypeDisplay = (betType: string) => {
    switch (betType) {
      case "andar": return "Andar (.X0)";
      case "bahar": return "Bahar (.0X)";
      case "pair": return "Pair (.XX)";
      default: return betType;
    }
  };

  const getDecimalDisplay = (decimal: number, betType: string) => {
    const firstDigit = Math.floor(decimal / 10);
    const secondDigit = decimal % 10;
    
    switch (betType) {
      case "andar": return `.${firstDigit}0`;
      case "bahar": return `.0${secondDigit}`;
      case "pair": return `.${decimal.toString().padStart(2, '0')}`;
      default: return `.${decimal.toString().padStart(2, '0')}`;
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Bet History</h2>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">₹{totalWinnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Winnings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalBets}</p>
            <p className="text-xs text-muted-foreground">Total Bets</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{winRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
        </div>

        <CollapsibleContent className="space-y-3 mt-4">
          {bets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No bets placed yet</p>
              <p className="text-sm">Place your first bet to see history here</p>
            </div>
          ) : (
            bets.map((bet) => (
              <Card key={bet.id} className={`p-4 border-l-4 ${bet.isWin ? 'border-l-success bg-success/5' : 'border-l-error bg-error/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={bet.isWin ? "default" : "destructive"}>
                      {bet.isWin ? "WON" : "LOST"}
                    </Badge>
                    <span className="font-semibold">{bet.index}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {bet.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Bet Details</p>
                    <p>{getBetTypeDisplay(bet.betType)}</p>
                    <p>Number: {bet.betNumber}</p>
                    <p>Amount: ₹{bet.amount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Market Result</p>
                    <p>Value: {bet.actualValue.toFixed(2)}</p>
                    <p>Decimal: {getDecimalDisplay(bet.actualDecimal, bet.betType)}</p>
                    <p className={bet.isWin ? "text-success font-semibold" : "text-error"}>
                      {bet.isWin ? `+₹${bet.winAmount.toFixed(2)}` : `-₹${bet.amount}`}
                    </p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {bet.isWin ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-error" />
                  )}
                  <span>
                    {bet.isWin ? "Match found!" : "No match"}
                  </span>
                </div>
              </Card>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};