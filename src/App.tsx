import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TransactionProvider } from "./context/TransactionContext";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import AppHeader from "./components/AppHeader";
import Landing from "./pages/Landing";
import DashboardPage from "./pages/DashboardPage";
import Auth from "./pages/Auth";
import Analysis from "./pages/Analysis";
import Visualization from "./pages/Visualization";
import Chat from "./pages/Chat";
import Transactions from "./pages/Transactions";
import { TagsPage } from "./pages/TagsPage";
import { AutoTaggingPage } from "./pages/AutoTaggingPage";
import StatementView from "./components/StatementView";
import NotFound from "./pages/NotFound";
import AnonymousStatementView from "./components/AnonymousStatementView";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TransactionProvider>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* Landing page without header */}
              <Route path="/" element={<Landing />} />
              
              {/* Pages with header */}
              <Route path="/*" element={
                <div>
                  <AppHeader />
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/statement/:id" element={<StatementView />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/analysis" element={<Analysis />} />
                    <Route path="/visualization" element={<Visualization />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/auto-tagging" element={<AutoTaggingPage />} />
                    <Route path="/anonymous-analysis" element={<AnonymousStatementView />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              } />
            </Routes>
          </div>
          <Toaster />
        </TransactionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
