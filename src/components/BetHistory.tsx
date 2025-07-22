import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, History } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  status: string;
  settlementTime?: Date;
}

interface BetHistoryProps {
  user: User;
  refreshTrigger: number;
}

export const BetHistory = ({ user, refreshTrigger }: BetHistoryProps) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserBets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const formattedBets = data.map(bet => ({
        id: bet.id,
        index: bet.index_name,
        amount: Number(bet.amount),
        betType: bet.bet_type as "andar" | "bahar" | "pair",
        betNumber: bet.bet_number,
        actualValue: Number(bet.actual_value) || 0,
        actualDecimal: bet.actual_decimal || 0,
        isWin: bet.is_win,
        winAmount: Number(bet.win_amount) || 0,
        timestamp: new Date(bet.created_at),
        status: bet.status || 'pending',
        settlementTime: bet.settlement_time ? new Date(bet.settlement_time) : undefined
      }));
      
      setBets(formattedBets);
    } catch (error: any) {
      console.error("Error fetching bets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserBets();
  }, [user.id, refreshTrigger]);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Bet History</h2>
            <Badge variant="secondary">{bets.length} bets</Badge>
          </div>

          {loading ? (
            <LoadingSpinner text="Loading bet history..." className="py-8" />
          ) : bets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bets placed yet</p>
              <p className="text-sm">Start betting to see your history here!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bets.map((bet) => (
                <Card key={bet.id} className="p-4 bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{bet.index}</Badge>
                        <Badge variant={bet.betType === "andar" ? "default" : bet.betType === "bahar" ? "secondary" : "destructive"}>
                          {bet.betType.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          #{bet.betNumber}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Bet: ₹{bet.amount} {bet.status === 'pending' ? '• Pending Settlement' : `• Actual: ${bet.actualValue.toFixed(2)} (Decimal: ${bet.actualDecimal})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bet.timestamp.toLocaleDateString()} {bet.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      {bet.status === 'pending' ? (
                        <>
                          <Badge variant="secondary" className="mb-1">
                            PENDING
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            Settlement: {bet.settlementTime?.toLocaleTimeString() || 'Unknown'}
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge variant={bet.isWin ? "default" : "destructive"} className="mb-1">
                            {bet.isWin ? "WON" : "LOST"}
                          </Badge>
                          <p className={`text-lg font-bold ${bet.isWin ? "text-success" : "text-error"}`}>
                            {bet.isWin ? `+₹${bet.winAmount.toFixed(2)}` : `-₹${bet.amount}`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};