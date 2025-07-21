import { LoadingSpinner } from "./LoadingSpinner";

export const AppLoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
          Stock Index Betting
        </h1>
        <LoadingSpinner size="lg" text="Loading application..." />
        <p className="text-muted-foreground">
          Setting up your betting experience...
        </p>
      </div>
    </div>
  );
};