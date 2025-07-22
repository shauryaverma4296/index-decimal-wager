import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  {
    name: "Hangseng",
    timezone: "Asia/Hong_Kong",
    marketOpen: 9.5,
    marketClose: 16,
  },
  {
    name: "Sensex",
    timezone: "Asia/Kolkata",
    marketOpen: 9.25,
    marketClose: 15.5,
  },
  { name: "Dax", timezone: "Europe/Berlin", marketOpen: 9, marketClose: 17.5 },
  {
    name: "Dow Jones",
    timezone: "America/New_York",
    marketOpen: 9.5,
    marketClose: 16,
  },
];

export const BettingInterface = ({
  user,
  walletBalance,
  onWalletUpdate,
  onBetPlaced,
}: BettingInterfaceProps) => {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<string>(
    STOCK_INDICES[0].name
  ); // Default to first index
  const [betAmount, setBetAmount] = useState<string>("");
  const [betType, setBetType] = useState<string>("");
  const [betNumber, setBetNumber] = useState<string>("");
  const [settlementTime, setSettlementTime] = useState<string>("market_close");
  const [customTime, setCustomTime] = useState<string>("");
  const [stockData, setStockData] = useState<Record<string, StockIndex>>({});
  const [marketStatuses, setMarketStatuses] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [pendingBets, setPendingBets] = useState<Map<string, unknown>>(
    new Map()
  );

  // Check if market is open based on current time in market's timezone
  const isMarketOpen = (indexConfig: IndexConfig) => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: indexConfig.timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const timeString = formatter.format(now);
    const [hours, minutes] = timeString.split(":").map(Number);
    const currentTime = hours + minutes / 60;

    const isOpen =
      currentTime >= indexConfig.marketOpen &&
      currentTime <= indexConfig.marketClose;

    // Debug logging for all markets
    console.log(`${indexConfig.name} Market Check:`, {
      timezone: indexConfig.timezone,
      currentMarketTime: timeString,
      currentTimeDecimal: currentTime,
      marketOpen: indexConfig.marketOpen,
      marketClose: indexConfig.marketClose,
      isOpen: isOpen,
      currentTimeIST: new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).format(now),
    });

    return isOpen;
  };

  // Update market statuses and stock data
  useEffect(() => {
    const updateData = () => {
      setDataLoading(true);

      setTimeout(() => {
        const data: Record<string, StockIndex> = {};
        const statuses: Record<string, boolean> = {};

        STOCK_INDICES.forEach((index) => {
          const isOpen = isMarketOpen(index);
          statuses[index.name] = isOpen;

          // Only update stock values if market is open
          if (isOpen) {
            data[index.name] = {
              name: index.name,
              value: parseFloat((Math.random() * 10000 + 10000).toFixed(2)),
              change: (Math.random() - 0.5) * 200,
              changePercent: (Math.random() - 0.5) * 4,
            };
          } else {
            // Keep previous values if market is closed
            data[index.name] = stockData[index.name] || {
              name: index.name,
              value: parseFloat((Math.random() * 10000 + 10000).toFixed(2)),
              change: (Math.random() - 0.5) * 200,
              changePercent: (Math.random() - 0.5) * 4,
            };
          }
        });

        setStockData(data);
        setMarketStatuses(statuses);
        setDataLoading(false);
      }, 1000);
    };

    updateData();
    const interval = setInterval(updateData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Convert market time to IST and format
  const getFormattedTime = (indexConfig: IndexConfig, time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);

    // Create a date for today at the specified time in the market's timezone
    const today = new Date();
    const marketTimeToday = new Date(
      today.toLocaleString("en-US", { timeZone: indexConfig.timezone })
    );
    marketTimeToday.setHours(hours, minutes, 0, 0);

    // Convert this market time to IST
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });

    // Get UTC time for the market time
    const marketTimeUTC = new Date(
      marketTimeToday.toLocaleString("en-US", { timeZone: "UTC" })
    );

    // Create proper date by adjusting for timezone differences
    const now = new Date();
    const marketOffset = getTimezoneOffset(indexConfig.timezone);
    const istOffset = getTimezoneOffset("Asia/Kolkata");
    const offsetDiff = istOffset - marketOffset;

    const adjustedTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours + offsetDiff,
      minutes
    );

    return formatter.format(adjustedTime);
  };

  // Get timezone offset in hours from UTC
  const getTimezoneOffset = (timezone: string) => {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const targetDate = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );
    return (targetDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  };

  // Get market close time for selected index in IST
  const getMarketCloseTime = (indexName: string) => {
    const indexConfig = STOCK_INDICES.find((idx) => idx.name === indexName);
    if (!indexConfig) return "";

    return getFormattedTime(indexConfig, indexConfig.marketClose);
  };

  // Validate custom time is not in the past and not after market close
  const validateCustomTime = (time: string, indexName: string) => {
    if (!time || !indexName) return true;

    const indexConfig = STOCK_INDICES.find((idx) => idx.name === indexName);
    if (!indexConfig) return true;

    // Handle time format validation
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) return false;

    const [hours, minutes] = time.split(":").map(Number);
    const customTimeDecimal = hours + minutes / 60;

    // Get current time in IST
    const now = new Date();
    const currentISTTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(now);

    const [currentHours, currentMinutes] = currentISTTime
      .split(":")
      .map(Number);
    const currentTimeDecimal = currentHours + currentMinutes / 60;

    // Check if custom time is in the past (only for today)
    const isInPast = customTimeDecimal <= currentTimeDecimal;

    // Calculate when market closes in IST
    const marketCloseHours = Math.floor(indexConfig.marketClose);
    const marketCloseMinutes = Math.round((indexConfig.marketClose % 1) * 60);

    // Create market close time in market's timezone for today
    const marketCloseToday = new Date();
    marketCloseToday.setHours(marketCloseHours, marketCloseMinutes, 0, 0);

    // Convert market close to IST
    const marketCloseIST = new Date(
      marketCloseToday.toLocaleString("en-US", {
        timeZone: indexConfig.timezone,
      })
    );
    const marketCloseISTDecimal =
      marketCloseIST.getHours() + marketCloseIST.getMinutes() / 60;

    // For markets that close the next day in IST (like US markets)
    // We need to check if the market close time converted to IST is actually tomorrow
    const istOffset = 5.5; // IST is UTC+5:30
    const marketOffset = getTimezoneOffset(indexConfig.timezone);
    const timeDiff = istOffset - marketOffset;

    // If adding timezone difference pushes the close time past midnight, it's next day
    const adjustedCloseTime = indexConfig.marketClose + timeDiff;
    const closesNextDayInIST = adjustedCloseTime >= 24;

    let isAfterMarketClose;

    if (closesNextDayInIST) {
      // Market closes tomorrow in IST - allow any time from now until end of day
      // The actual close time will be early hours of tomorrow (like 1:30 AM)
      const tomorrowCloseTime = adjustedCloseTime - 24; // Convert to next day hours

      // For times today (current day), allow anything after current time
      // For times that look like tomorrow (0:00 to close time), check separately
      if (customTimeDecimal < 6) {
        // Assuming times 0:00-6:00 are meant for tomorrow
        isAfterMarketClose = customTimeDecimal > tomorrowCloseTime;
      } else {
        // Times after 6:00 are for today, always valid if not in past
        isAfterMarketClose = false;
      }
    } else {
      // Market closes today in IST - normal validation
      isAfterMarketClose = customTimeDecimal > marketCloseISTDecimal;
    }

    console.log(`Validating custom time for ${indexName}:`, {
      inputTime: time,
      inputTimeDecimal: customTimeDecimal,
      currentTimeIST: currentISTTime,
      currentTimeDecimal: currentTimeDecimal,
      marketCloseInMarketTZ: `${marketCloseHours}:${marketCloseMinutes}`,
      marketOffset: marketOffset,
      istOffset: istOffset,
      timeDiff: timeDiff,
      adjustedCloseTime: adjustedCloseTime,
      closesNextDayInIST: closesNextDayInIST,
      isInPast: isInPast,
      isAfterMarketClose: isAfterMarketClose,
      isValid: !isInPast && !isAfterMarketClose,
    });

    return !isInPast && !isAfterMarketClose;
  };

  // Setup real-time bet settlement monitoring using Supabase realtime
  useEffect(() => {
    const channel = supabase
      .channel("bet-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bets",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log("Bet updated via realtime:", payload.new);
          const bet = payload.new as any;

          // Show notification if bet is settled
          if (bet.status === "settled") {
            toast({
              title: "Bet Settled!",
              description: `Your bet has been ${bet.is_win ? "won" : "lost"}! ${
                bet.is_win ? `Won ₹${bet.win_amount}` : ""
              }`,
              variant: bet.is_win ? "default" : "destructive",
            });

            // Update wallet balance if bet won
            if (bet.is_win && bet.win_amount > 0) {
              onWalletUpdate(walletBalance + bet.win_amount);
            }

            // Trigger bet history refresh
            onBetPlaced();
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast, onWalletUpdate, onBetPlaced]);

  // Handle bet settlement from websocket
  const handleBetSettlement = async (betId: string, result: unknown) => {
    const bet = pendingBets.get(betId);
    if (!bet) return;
    // Type guard for result
    if (
      typeof result === "object" &&
      result !== null &&
      "isWin" in result &&
      "actualValue" in result &&
      "decimalPart" in result
    ) {
      const resultData = result as {
        isWin: boolean;
        actualValue: number;
        decimalPart: number;
      };
      const betObj = bet as {
        amount: number;
        indexName: string;
        betType: string;
        betNumber: number;
        settlementTime: Date;
      };
      const isWin = resultData.isWin;
      const winAmount = isWin ? betObj.amount * 0.95 : 0;

      // Update bet in database with result
      await supabase
        .from("bets")
        .update({
          actual_value: resultData.actualValue,
          actual_decimal: resultData.decimalPart,
          is_win: isWin,
          win_amount: winAmount,
        })
        .eq("id", betId);

      // If win, add winning amount to wallet
      if (isWin) {
        await supabase.rpc("update_wallet_balance", {
          p_user_id: user.id,
          p_amount: winAmount,
          p_type: "bet_win",
          p_description: `Winnings from ${betObj.indexName} bet`,
          p_reference_id: betId,
        });
      }

      toast({
        title: isWin ? "Congratulations!" : "Better luck next time!",
        description: isWin
          ? `Your bet settled! You won ₹${winAmount.toFixed(2)}!`
          : `Your bet settled. You lost ₹${betObj.amount}. Try again!`,
        variant: isWin ? "default" : "destructive",
      });

      // Remove from pending bets
      setPendingBets((prev) => {
        const newMap = new Map(prev);
        newMap.delete(betId);
        return newMap;
      });

      onWalletUpdate(isWin ? walletBalance + winAmount : walletBalance);
      onBetPlaced();
    } else {
      console.warn("Invalid result object for bet settlement", result);
    }
  };

  const placeBet = async () => {
    if (
      !selectedIndex ||
      !betAmount ||
      !betType ||
      !betNumber ||
      !settlementTime
    ) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    if (settlementTime === "custom" && !customTime) {
      toast({
        title: "Error",
        description: "Please specify custom settlement time",
        variant: "destructive",
      });
      return;
    }

    // Validate custom time is not in past and not after market close
    if (
      settlementTime === "custom" &&
      !validateCustomTime(customTime, selectedIndex)
    ) {
      toast({
        title: "Error",
        description:
          "Settlement time cannot be in the past or after market close",
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
    if (
      (betType === "andar" || betType === "bahar") &&
      (isNaN(number) || number < 0 || number > 9)
    ) {
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
      // Deduct bet amount from wallet first
      await supabase.rpc("update_wallet_balance", {
        p_user_id: user.id,
        p_amount: amount,
        p_type: "bet_place",
        p_description: `Bet placed on ${selectedIndex}`,
        p_reference_id: `bet_${Date.now()}`,
      });

      // Calculate settlement time
      const settlementDateTime = new Date();
      if (settlementTime === "market_close") {
        const indexConfig = STOCK_INDICES.find(
          (idx) => idx.name === selectedIndex
        );
        if (indexConfig) {
          const hours = Math.floor(indexConfig.marketClose);
          const minutes = (indexConfig.marketClose % 1) * 60;
          settlementDateTime.setHours(hours, minutes, 0, 0);
        }
      } else if (settlementTime === "custom" && customTime) {
        const [hours, minutes] = customTime.split(":").map(Number);
        settlementDateTime.setHours(hours, minutes, 0, 0);
      }

      // Save bet to database with settlement time and pending status
      const { data: betData, error: betError } = await supabase
        .from("bets")
        .insert({
          user_id: user.id,
          index_name: selectedIndex,
          amount,
          bet_type: betType,
          bet_number: number,
          settlement_time: settlementDateTime.toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (betError) throw betError;

      // Add to pending bets for settlement tracking
      setPendingBets(
        (prev) =>
          new Map(
            prev.set(betData.id, {
              amount,
              indexName: selectedIndex,
              betType,
              betNumber: number,
              settlementTime: settlementDateTime,
            })
          )
      );

      // Just return success - settlement will happen automatically when time comes
      console.log(
        "Bet placed successfully, will be settled at:",
        settlementDateTime
      );

      // Update local wallet balance (deduct bet amount)
      onWalletUpdate(walletBalance - amount);

      toast({
        title: "Bet Placed Successfully!",
        description: `Your bet will be settled at ${settlementDateTime.toLocaleTimeString()}`,
        variant: "default",
      });

      // Reset form
      setBetAmount("");
      setBetNumber("");
      onBetPlaced(); // Notify parent to refresh bet history
      setLoading(false);
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

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Place Your Bet</h2>
          </div>

          {/* {dataLoading ? (
            <LoadingSpinner text="Loading market data..." className="py-8" />
          ) : ( */}
          {/* <> */}
          {/* Index Selection */}
          <div className="space-y-2">
            <Label>Select Stock Index</Label>
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an index" />
              </SelectTrigger>
              <SelectContent>
                {STOCK_INDICES.map((index) => {
                  const isOpen = marketStatuses[index.name] ?? false;
                  const indexConfig = STOCK_INDICES.find(
                    (idx) => idx.name === index.name
                  );
                  return (
                    <SelectItem key={index.name} value={index.name}>
                      <div className="w-full space-y-1">
                        {/* Top row: Name and Status */}
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{index.name}</span>
                          <Badge
                            variant={isOpen ? "default" : "destructive"}
                            className="text-xs shrink-0"
                          >
                            {isOpen ? "OPEN" : "CLOSED"}
                          </Badge>
                        </div>
                        
                        {/* Bottom row: Value, Trend, and Market Hours */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {stockData[index.name] && (
                              <>
                                <span className="font-mono font-medium">
                                  {stockData[index.name].value.toFixed(2)}
                                </span>
                                {stockData[index.name].change >= 0 ? (
                                  <TrendingUp className="h-3 w-3 text-success" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-error" />
                                )}
                              </>
                            )}
                          </div>
                          {indexConfig && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {getFormattedTime(
                                indexConfig,
                                indexConfig.marketOpen
                              )}{" "}
                              - {" "}
                              {getFormattedTime(
                                indexConfig,
                                indexConfig.marketClose
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Current Value Display */}
          {selectedIndex && stockData[selectedIndex] && (
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Current Value
                    </p>
                    <Badge
                      variant={
                        marketStatuses[selectedIndex]
                          ? "default"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {marketStatuses[selectedIndex]
                        ? "MARKET OPEN"
                        : "MARKET CLOSED"}
                    </Badge>
                  </div>
                  <p className="text-2xl font-mono font-bold">
                    {stockData[selectedIndex].value.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm ${
                      stockData[selectedIndex].change >= 0
                        ? "text-success"
                        : "text-error"
                    }`}
                  >
                    {stockData[selectedIndex].change >= 0 ? "+" : ""}
                    {stockData[selectedIndex].change.toFixed(2)}
                  </p>
                  <p
                    className={`text-xs ${
                      stockData[selectedIndex].changePercent >= 0
                        ? "text-success"
                        : "text-error"
                    }`}
                  >
                    ({stockData[selectedIndex].changePercent >= 0 ? "+" : ""}
                    {stockData[selectedIndex].changePercent.toFixed(2)}%)
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
                <SelectItem value="andar">
                  Andar (First decimal digit .X0)
                </SelectItem>
                <SelectItem value="bahar">
                  Bahar (Second decimal digit .0X)
                </SelectItem>
                <SelectItem value="pair">
                  Pair (Both decimal digits .XX)
                </SelectItem>
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
              onChange={(e) => {
                const value = e.target.value;

                // For Andar/Bahar, restrict to single digit and disable after entry
                if (betType === "andar" || betType === "bahar") {
                  if (
                    value.length <= 1 &&
                    (value === "" ||
                      (parseInt(value) >= 0 && parseInt(value) <= 9))
                  ) {
                    setBetNumber(value);
                  }
                } else if (betType === "pair") {
                  // For Pair, allow up to 2 digits
                  if (
                    value.length <= 2 &&
                    (value === "" ||
                      (parseInt(value) >= 0 && parseInt(value) <= 99))
                  ) {
                    setBetNumber(value);
                  }
                } else {
                  setBetNumber(value);
                }
              }}
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
              maxLength={betType === "pair" ? 2 : 1}
            />
          </div>

          {/* Settlement Time */}
          <div className="space-y-2">
            <Label>When to declare result?</Label>
            <Select value={settlementTime} onValueChange={setSettlementTime}>
              <SelectTrigger>
                <SelectValue placeholder="Choose settlement time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market_close">
                  End of day when market closes
                  {selectedIndex && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({getMarketCloseTime(selectedIndex)})
                    </span>
                  )}
                </SelectItem>
                <SelectItem value="custom">Custom time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Time Input */}
          {settlementTime === "custom" && (
            <div className="space-y-2">
              <Label>Custom Settlement Time</Label>
              <Input
                type="time"
                value={customTime}
                onChange={(e) => {
                  const time = e.target.value;
                  setCustomTime(time);

                  // Show warning if time is after market close
                  if (time && !validateCustomTime(time, selectedIndex)) {
                    toast({
                      title: "Warning",
                      description: "Selected time is after market close",
                      variant: "destructive",
                    });
                  }
                }}
                placeholder="Select time"
                className={
                  !validateCustomTime(customTime, selectedIndex)
                    ? "border-destructive"
                    : ""
                }
              />
              {customTime && !validateCustomTime(customTime, selectedIndex) && (
                <p className="text-xs text-destructive">
                  Time cannot be in the past or after market close (
                  {getMarketCloseTime(selectedIndex)})
                </p>
              )}
            </div>
          )}

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
            disabled={
              !marketStatuses[selectedIndex] ||
              loading ||
              !selectedIndex ||
              !betType ||
              !betNumber ||
              !betAmount ||
              !settlementTime ||
              (settlementTime === "custom" && !customTime)
            }
          >
            {loading ? (
              <LoadingSpinner size="sm" text="Placing bet..." />
            ) : !marketStatuses[selectedIndex] ? (
              "Market Closed"
            ) : (
              "Place Bet"
            )}
          </Button>

          {!marketStatuses[selectedIndex] && (
            <div className="text-center text-sm text-muted-foreground">
              <Badge variant="destructive" className="mb-2">
                Market Closed for {selectedIndex}
              </Badge>
              <p>
                Selected market is currently closed. Please try again during
                market hours.
              </p>
            </div>
          )}
          {/* </> )}*/}
        </div>
      </Card>
    </div>
  );
};
