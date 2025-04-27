import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu, X, User, LogOut, AlignLeft } from "lucide-react"; // <-- Added AlignLeft icon for sidebar
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Dummy sidebar toggle (you can connect to your actual sidebar logic)
  const handleSidebar = () => {
    console.log("Sidebar opened");
  };

  return (
    <header className="fixed border-b top-0 left-0 w-full z-50 bg-background/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:justify-between">

          {/* Left side - Sidebar button on Mobile */}
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSidebar}
            >
              <AlignLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Center - Logo */}
          <div className="flex-1 flex justify-center md:justify-start">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 ml-[-80px]" >
                LegalGist
              </span>
            </Link>
          </div>

          {/* Right side - Mobile dropdown button */}
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-4 mr-[-84px]">
            <Link to="/" className="text-foreground/80 hover:text-primary transition-colors">
              Home
            </Link>
            {user ? (
              <>
                <Link to="/chat" className="text-foreground/80 hover:text-primary transition-colors">
                  Chat
                </Link>
                <Link to="/account" className="text-foreground/80 hover:text-primary transition-colors">
                  Account
                </Link>
                <div className="w-px h-6 bg-border mx-2"></div>
                <Button onClick={handleLogout} variant="ghost" size="sm" className="flex items-center gap-1.5">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <>
                <div className="w-px h-6 bg-border mx-2"></div>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="default" size="sm">Sign Up</Button>
                </Link>
              </>
            )}
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="md:hidden bg-background border-t shadow-md">
          <div className="flex flex-col px-4 pt-2 pb-3 space-y-1">
            {user ? (
              <>
                <Link
                  to="/chat"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Chat
                </Link>
                <Link
                  to="/account"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="inline-block mr-2 h-4 w-4" />
                  Account
                </Link>
                <Button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  variant="ghost"
                  className="justify-start px-3 py-2 w-full text-left"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
            
            {/* Theme Toggle in dropdown */}
            <div className="pt-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
