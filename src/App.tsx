import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TransactionProvider } from "./context/TransactionContext";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import AppHeader from "./components/AppHeader";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Analysis from "./pages/Analysis";
import { TagsPage } from "./pages/TagsPage"; // Import the new page
import NotFound from "./pages/NotFound";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TransactionProvider>
          <div className="min-h-screen bg-gray-50">
            <AppHeader />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/tags" element={<TagsPage />} /> {/* Add the new route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Toaster />
        </TransactionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
