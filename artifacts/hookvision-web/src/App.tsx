import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Home from "@/pages/home";
import Tides from "@/pages/tides";
import Barra from "@/pages/barra";
import FishId from "@/pages/fishid";
import Forecast from "@/pages/forecast";
import Community from "@/pages/community";
import Preview from "@/pages/preview";
import GetApps from "@/pages/get-apps";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tides" component={Tides} />
        <Route path="/barra" component={Barra} />
        <Route path="/fishid" component={FishId} />
        <Route path="/forecast" component={Forecast} />
        <Route path="/community" component={Community} />
        <Route path="/preview" component={Preview} />
        <Route path="/get-apps" component={GetApps} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
