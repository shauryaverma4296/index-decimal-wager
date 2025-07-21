import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Auth } from "./Auth";
import { Layout } from "./Layout";
import { BettingInterface } from "./BettingInterface";
import { Wallet } from "./Wallet";
import { BetHistory } from "./BetHistory";
import { AppLoadingScreen } from "./AppLoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Section = "betting" | "wallet" | "history";

export const BettingApp = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentSection, setCurrentSection] = useState<Section>("betting");
  const [loading, setLoading] = useState(true);
  const [betRefreshTrigger, setBetRefreshTrigger] = useState(0);

  // Check authentication state
  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        if (session?.user) {
          await fetchWalletBalance(session.user.id);
        }
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        await fetchWalletBalance(session.user.id);
      } else {
        setWalletBalance(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchWalletBalance = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setWalletBalance(Number(data.balance) || 0);
    } catch (error: any) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const handleBetPlaced = () => {
    setBetRefreshTrigger(prev => prev + 1);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const renderContent = () => {
    switch (currentSection) {
      case "betting":
        return (
          <BettingInterface
            user={user!}
            walletBalance={walletBalance}
            onWalletUpdate={setWalletBalance}
            onBetPlaced={handleBetPlaced}
          />
        );
      case "wallet":
        return (
          <Wallet
            userId={user!.id}
            balance={walletBalance}
            onBalanceUpdate={setWalletBalance}
          />
        );
      case "history":
        return (
          <BetHistory
            user={user!}
            refreshTrigger={betRefreshTrigger}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <Layout
      user={user}
      walletBalance={walletBalance}
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
      onSignOut={handleSignOut}
    >
      {renderContent()}
    </Layout>
  );
};