
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { ArrowRight, Scale, BookText, Shield, FileText } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl md:leading-[2]  md:text-6xl font-bold mb-6 tracking-tight text-gradient-primary">
              LegalGist
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-2xl text-foreground/80">
              Your AI legal assistant for Indian Constitutional Law and IPC questions
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => navigate("/chat")} 
                size="lg" 
                className="px-8 py-6 text-lg"
              >
                Start Chatting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                onClick={() => navigate("/register")} 
                variant="outline" 
                size="lg"
                className="px-8 py-6 text-lg"
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-12 md:py-20 px-4 bg-secondary/10">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Expert Legal Guidance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-morphism p-6 rounded-xl">
              <Scale className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Constitutional Law</h3>
              <p className="text-foreground/80">
                Detailed insights on Indian constitutional provisions, landmark cases, and interpretations by the Supreme Court.
              </p>
            </div>
            <div className="glass-morphism p-6 rounded-xl">
              <Shield className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Indian Penal Code</h3>
              <p className="text-foreground/80">
                Clear explanations of IPC sections, criminal procedures, and relevant case laws.
              </p>
            </div>
            <div className="glass-morphism p-6 rounded-xl">
              <FileText className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Document Analysis</h3>
              <p className="text-foreground/80">
                Upload legal documents for contextual analysis and get relevant legal insights.
              </p>
            </div>
            <div className="glass-morphism p-6 rounded-xl">
              <BookText className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Legal Research</h3>
              <p className="text-foreground/80">
                Access information on legal terminology, concepts, and principles specific to Indian law.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Call-to-action Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl glass-morphism p-8 md:p-12 rounded-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Legal Answers?</h2>
          <p className="mb-6 text-foreground/80">
            Start a conversation with LegalGist and discover clear, accurate information about Indian law.
          </p>
          <Button onClick={() => navigate("/chat")} size="lg" className="px-8">
            Start a Conversation
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/40">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gradient-primary text-lg font-bold">LegalGist</p>
              <p className="text-sm text-foreground/60">AI legal assistant specialized in Indian Law</p>
            </div>
            <div className="text-sm text-foreground/60">
              © {new Date().getFullYear()} LegalGist. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
