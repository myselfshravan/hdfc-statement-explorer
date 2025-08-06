import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  PieChart,
  Tag,
  MessageSquare,
  Shield,
  Zap,
  Eye,
  Upload,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { loadSampleData } from "@/utils/sampleData";
import { useToast } from "@/components/ui/use-toast";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    title: string;
    description: string;
  } | null>(null);

  const handleTryDemo = () => {
    try {
      loadSampleData();
      toast({
        title: "Demo data loaded!",
        description: "You're now viewing a sample HDFC statement analysis.",
      });
      navigate("/anonymous-analysis");
    } catch (error) {
      toast({
        title: "Error loading demo",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6 text-blue-600" />,
      title: "Transaction Analysis",
      description:
        "Deep insights into your spending patterns and financial behavior",
      screenshot: "transaction_analysis.png",
    },
    {
      icon: <PieChart className="h-6 w-6 text-green-600" />,
      title: "Visual Analytics",
      description:
        "Beautiful charts and graphs to visualize your financial data",
      screenshot: "visualization.png",
    },
    {
      icon: <Tag className="h-6 w-6 text-purple-600" />,
      title: "Smart Tagging",
      description: "Automatically categorize transactions with custom tags",
      screenshot: "tag_manage.png",
    },
    {
      icon: <MessageSquare className="h-6 w-6 text-orange-600" />,
      title: "AI Chat Assistant",
      description:
        "Ask questions about your financial data using natural language",
      screenshot: "statement_analysis.png",
    },
  ];

  const benefits = [
    {
      icon: <Shield className="h-5 w-5 text-green-600" />,
      title: "Secure & Private",
      description: "Your data stays local and secure",
    },
    {
      icon: <Zap className="h-5 w-5 text-yellow-600" />,
      title: "Lightning Fast",
      description: "Instant analysis of your statements",
    },
    {
      icon: <Eye className="h-5 w-5 text-blue-600" />,
      title: "Clear Insights",
      description: "Easy-to-understand financial insights",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-blue-100 text-blue-800">
            HDFC Statement Analyzer
          </Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Transform Your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {" "}
              Financial Data{" "}
            </span>
            Into Actionable Insights
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Upload your HDFC bank statements (XLSX) and get powerful analytics,
            spending insights, and AI-powered financial assistance. Make better
            financial decisions with data-driven insights.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button
              onClick={handleTryDemo}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Eye className="mr-2 h-5 w-5" />
              Try Demo (Sample Data)
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg font-semibold"
            >
              <Link to="/dashboard">
                <Upload className="mr-2 h-5 w-5" />
                Upload Your Statement
              </Link>
            </Button>
          </div>

          {/* Demo Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto mb-16">
            <div className="flex items-center justify-center text-yellow-800">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                <strong>Try Demo</strong> uses sample/dummy transaction data to
                showcase platform features. No real financial data is used or
                stored.
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md hover:scale-105"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-3 bg-gray-50 rounded-full w-fit group-hover:bg-blue-50 transition-colors">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-gray-600 leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Features Highlight Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <Badge
              variant="secondary"
              className="mb-4 bg-purple-100 text-purple-800"
            >
              🤖 AI-Powered Features
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Advanced AI Financial Assistant
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience the future of financial analysis with our intelligent
              AI assistant that understands your data
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {[
              {
                title: "AI Chat Assistant",
                description:
                  "Ask questions about your finances in natural language and get intelligent insights instantly",
                image: "chat_example.png",
                isHighlight: true,
                icon: <MessageSquare className="h-6 w-6 text-purple-600" />,
              },
              {
                title: "Statement AI Assistant",
                description:
                  "AI-powered analysis that provides personalized financial recommendations and insights",
                image: "statement_assistant.png",
                isHighlight: true,
                icon: <Sparkles className="h-6 w-6 text-purple-600" />,
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-105 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 cursor-pointer group"
                onClick={() =>
                  setSelectedImage({
                    src: `/${feature.image}`,
                    title: feature.title,
                    description: feature.description,
                  })
                }
              >
                <div className="relative bg-gradient-to-br from-purple-100 to-blue-100 p-6">
                  <div className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    AI Feature
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-lg bg-white p-2 group-hover:shadow-2xl transition-shadow duration-300">
                    <img
                      src={`/${feature.image}`}
                      alt={feature.title}
                      className="w-full h-64 object-contain bg-white rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling!.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden text-gray-400 text-center p-8 flex-col items-center justify-center h-64">
                      {feature.icon}
                      <p className="text-sm font-medium mt-2">
                        {feature.title}
                      </p>
                    </div>
                  </div>
                </div>
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3 mb-2">
                    {feature.icon}
                    <CardTitle className="text-xl font-bold text-gray-900">
                      {feature.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-gray-700 leading-relaxed text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Screenshots Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Complete Feature Overview
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore all the powerful features that make financial analysis
              simple and insightful
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Transaction Overview",
                description:
                  "Complete view of all your transactions with smart filtering and search",
                image: "transactions.png",
              },
              {
                title: "Visual Analytics",
                description:
                  "Interactive charts and graphs for spending patterns and trends",
                image: "visualization.png",
              },
              {
                title: "Smart Tagging System",
                description:
                  "Organize transactions with custom categories and intelligent tags",
                image: "tag_manage.png",
              },
              {
                title: "Statement Analysis",
                description:
                  "Comprehensive analysis of your bank statement data",
                image: "statement_analysis.png",
              },
              {
                title: "Transaction Analysis",
                description:
                  "Deep dive into individual transaction patterns and insights",
                image: "transaction_analysis.png",
              },
              {
                title: "Anonymous Mode",
                description:
                  "Try the platform without login using anonymous analysis mode",
                image: "anonymous_mode.png",
              },
            ].map((screenshot, index) => (
              <Card
                key={index}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 bg-white cursor-pointer group"
                onClick={() =>
                  setSelectedImage({
                    src: `/${screenshot.image}`,
                    title: screenshot.title,
                    description: screenshot.description,
                  })
                }
              >
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                  <div className="rounded-lg overflow-hidden shadow-md bg-white group-hover:shadow-lg transition-shadow duration-300">
                    <img
                      src={`/${screenshot.image}`}
                      alt={screenshot.title}
                      className="w-full h-48 object-contain bg-white"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling!.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden text-gray-400 text-center p-8 flex-col items-center justify-center h-48">
                      <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm font-medium">{screenshot.title}</p>
                    </div>
                  </div>
                </div>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {screenshot.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {screenshot.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl p-12 shadow-lg mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our Platform?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built specifically for HDFC bank customers with security and
              ease-of-use in mind
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto mb-4 p-3 bg-gray-50 rounded-full w-fit">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Analyze Your Finances with AI?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleTryDemo}
              size="lg"
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-6 text-lg font-semibold"
            >
              Try Demo First
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white text-blue-900 hover:bg-white hover:text-blue-600 px-8 py-6 text-lg font-semibold"
            >
              <Link to="/dashboard">Get Started Now →</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Image Popup Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {selectedImage?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-lg">
              {selectedImage?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {selectedImage && (
              <div className="rounded-xl overflow-hidden bg-white shadow-lg">
                <img
                  src={selectedImage.src}
                  alt={selectedImage.title}
                  className="w-full h-auto object-contain max-h-[70vh]"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
