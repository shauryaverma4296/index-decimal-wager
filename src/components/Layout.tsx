import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogOut, Wallet, Target, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  walletBalance: number;
  currentSection: "betting" | "wallet" | "history";
  onSectionChange: (section: "betting" | "wallet" | "history") => void;
  onSignOut: () => void;
}

export const Layout = ({ 
  children, 
  user, 
  walletBalance, 
  currentSection, 
  onSectionChange, 
  onSignOut 
}: LayoutProps) => {
  const [marketOpen, setMarketOpen] = useState(true);

  // Check if any major market is open (simplified)
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hour = now.getUTCHours();
      // Simplified: assume markets are open between 1:00 UTC and 15:00 UTC
      setMarketOpen(hour >= 1 && hour <= 15);
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with persistent wallet balance */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          {/* Mobile Layout */}
          <div className="flex flex-col gap-2 lg:hidden">
            {/* Top row: Logo and Sign Out */}
            <div className="flex items-center justify-between">
              <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent truncate pr-2">
                Stock Index Betting
              </h1>
              <Button variant="outline" size="sm" onClick={onSignOut}>
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign Out</span>
              </Button>
            </div>
            
            {/* Bottom row: Market Status and Wallet */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">Market:</span>
                <Badge variant={marketOpen ? "default" : "destructive"} className="text-xs px-1.5 py-0.5 flex-shrink-0">
                  {marketOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-lg flex-shrink-0">
                <Wallet className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium whitespace-nowrap">₹{walletBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between">
            {/* Logo/Title */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl xl:text-2xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                Stock Index Betting
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Market Status:</span>
                <Badge variant={marketOpen ? "default" : "destructive"} className="text-xs">
                  {marketOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Wallet Balance:</span>
                <span className="text-lg xl:text-xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                  ₹{walletBalance.toFixed(2)}
                </span>
              </div>
              
              <Button variant="outline" size="sm" onClick={onSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card/30">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
            <Button
              variant={currentSection === "betting" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("betting")}
              className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              <Target className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Place Bets</span>
              <span className="sm:hidden">Bet</span>
            </Button>
            
            <Button
              variant={currentSection === "wallet" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("wallet")}
              className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Manage Wallet</span>
              <span className="sm:hidden">Wallet</span>
            </Button>
            
            <Button
              variant={currentSection === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("history")}
              className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Bet History</span>
              <span className="sm:hidden">History</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
};