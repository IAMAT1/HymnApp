import { useState, Component, ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MusicPlayerBar } from "@/components/layout/MusicPlayerBar";
import EnhancedHome from "@/pages/EnhancedHome";
import Search from "@/pages/Search";
import Library from "@/pages/Library";
import Browse from "@/pages/Browse";
import LikedSongs from "@/pages/LikedSongs";
import NowPlaying from "@/pages/NowPlaying";
import AuthCallback from "@/pages/AuthCallback";
import GenreSongs from "@/pages/GenreSongs";
import NotFound from "@/pages/not-found";

// Error Boundary for debugging white screen
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-4">Error: {this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <div className="page-transition">
      <Switch>
        <Route path="/" component={EnhancedHome} />
        <Route path="/search" component={Search} />
        <Route path="/library" component={Library} />
        <Route path="/browse" component={Browse} />
        <Route path="/liked-songs" component={LikedSongs} />
        <Route path="/now-playing" component={NowPlaying} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/genre/:genre" component={GenreSongs} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AuthGuard>
              <MusicPlayerProvider>
                <div className="flex h-screen bg-black text-white overflow-hidden">
                  <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                  <div className="flex-1 flex flex-col">
                    <TopBar onToggleSidebar={toggleSidebar} />
                    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-neutral-900 to-black pb-20 sm:pb-24">
                      <Router />
                    </div>
                  </div>
                </div>
                <MusicPlayerBar />
                <Toaster />
              </MusicPlayerProvider>
            </AuthGuard>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
