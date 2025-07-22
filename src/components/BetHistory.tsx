import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, History, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

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
  const [animatingBets, setAnimatingBets] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserBets = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("bets")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formattedBets = data.map((bet) => ({
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
          status: bet.status || "pending",
          settlementTime: bet.settlement_time
            ? new Date(bet.settlement_time)
            : undefined,
        }));

        setBets(formattedBets);
      } catch (error: any) {
        console.error("Error fetching bets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserBets();
  }, [user.id, refreshTrigger]);

  // Setup realtime subscription for bet updates
  useEffect(() => {
    const channel = supabase
      .channel('bet-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('Bet update received in history:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Handle new bet insertion
            const newBet = {
              id: payload.new.id,
              index: payload.new.index_name,
              amount: Number(payload.new.amount),
              betType: payload.new.bet_type as "andar" | "bahar" | "pair",
              betNumber: payload.new.bet_number,
              actualValue: Number(payload.new.actual_value) || 0,
              actualDecimal: payload.new.actual_decimal || 0,
              isWin: payload.new.is_win,
              winAmount: Number(payload.new.win_amount) || 0,
              timestamp: new Date(payload.new.created_at),
              status: payload.new.status || "pending",
              settlementTime: payload.new.settlement_time
                ? new Date(payload.new.settlement_time)
                : undefined,
            };

            setBets(prev => [newBet, ...prev]);
            
            toast({
              title: "New Bet Placed! 🎯",
              description: `₹${newBet.amount} bet on ${newBet.index}`,
              variant: "default",
            });

          } else if (payload.eventType === 'UPDATE') {
            // Handle bet settlement with animation
            const updatedBet = payload.new;
            const wasSettled = payload.old.status === 'pending' && updatedBet.status === 'settled';
            
            setBets(prev => prev.map(bet => {
              if (bet.id === updatedBet.id) {
                const updated = {
                  ...bet,
                  actualValue: Number(updatedBet.actual_value) || 0,
                  actualDecimal: updatedBet.actual_decimal || 0,
                  isWin: updatedBet.is_win,
                  winAmount: Number(updatedBet.win_amount) || 0,
                  status: updatedBet.status || "pending",
                };

                // Trigger animation for newly settled bets
                if (wasSettled) {
                  setAnimatingBets(prev => new Set([...prev, bet.id]));
                  
                  // Show settlement notification
                  toast({
                    title: updatedBet.is_win ? "🎉 Congratulations!" : "😔 Better luck next time!",
                    description: updatedBet.is_win 
                      ? `You won ₹${Number(updatedBet.win_amount).toFixed(2)}!`
                      : `Your bet of ₹${bet.amount} was settled.`,
                    variant: updatedBet.is_win ? "default" : "destructive",
                  });

                  // Remove animation after 3 seconds
                  setTimeout(() => {
                    setAnimatingBets(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(bet.id);
                      return newSet;
                    });
                  }, 3000);
                }

                return updated;
              }
              return bet;
            }));
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast]);

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
                <Card
                  key={bet.id}
                  className={`p-4 transition-all duration-500 ease-in-out ${
                    animatingBets.has(bet.id)
                      ? bet.isWin
                        ? "bg-success/20 border-success/50 shadow-lg shadow-success/25 animate-pulse"
                        : "bg-destructive/20 border-destructive/50 shadow-lg shadow-destructive/25 animate-pulse"
                      : "bg-muted/50 hover:bg-muted/70"
                  } ${
                    bet.status === "pending" 
                      ? "border-l-4 border-l-yellow-500" 
                      : bet.isWin 
                        ? "border-l-4 border-l-green-500" 
                        : "border-l-4 border-l-red-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{bet.index}</Badge>
                        <Badge
                          variant={
                            bet.betType === "andar"
                              ? "default"
                              : bet.betType === "bahar"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {bet.betType.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          #{bet.betNumber}
                        </span>
                        {animatingBets.has(bet.id) && (
                          <Badge variant="outline" className="animate-bounce">
                            ✨ JUST SETTLED!
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Bet: ₹{bet.amount}{" "}
                        {bet.status === "pending"
                          ? "• Pending Settlement"
                          : `• Actual: ${bet.actualValue.toFixed(
                              2
                            )} (Decimal: ${bet.actualDecimal})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bet.timestamp.toLocaleDateString()}{" "}
                        {bet.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      {bet.status === "pending" ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                            <Badge variant="secondary" className="animate-pulse">
                              PENDING
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Settlement:{" "}
                            {bet.settlementTime?.toLocaleTimeString() ||
                              "Processing..."}
                          </p>
                          {bet.settlementTime && (
                            <p className="text-xs text-muted-foreground">
                              {bet.settlementTime < new Date() ? (
                                <span className="flex items-center gap-1 text-yellow-600">
                                  <DollarSign className="h-3 w-3 animate-bounce" />
                                  Processing settlement...
                                </span>
                              ) : (
                                'Waiting for settlement time'
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            {bet.isWin ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            )}
                            <Badge
                              variant={bet.isWin ? "default" : "destructive"}
                              className={animatingBets.has(bet.id) ? "animate-bounce" : ""}
                            >
                              {bet.isWin ? "WON" : "LOST"}
                            </Badge>
                          </div>
                          <p
                            className={`text-lg font-bold transition-all duration-300 ${
                              bet.isWin ? "text-success" : "text-error"
                            } ${
                              animatingBets.has(bet.id) ? "scale-110" : ""
                            }`}
                          >
                            {bet.isWin
                              ? `+₹${bet.winAmount.toFixed(2)}`
                              : `-₹${bet.amount}`}
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
