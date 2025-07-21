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
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo/Title */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
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
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
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
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant={currentSection === "betting" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("betting")}
              className="flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              Place Bets
            </Button>
            
            <Button
              variant={currentSection === "wallet" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("wallet")}
              className="flex items-center gap-2"
            >
              <Wallet className="h-4 w-4" />
              Manage Wallet
            </Button>
            
            <Button
              variant={currentSection === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSectionChange("history")}
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Bet History
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};