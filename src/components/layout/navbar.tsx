
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu, X, User, LogOut } from "lucide-react";
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

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">LegalGist</span>
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-4">
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
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div
        className={`${
          isOpen ? "block" : "hidden"
        } md:hidden bg-background border-t shadow-md`}
      >
        <div className="flex flex-col px-4 pt-2 pb-3 space-y-1">
          <Link
            to="/"
            className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Home
          </Link>
          
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
        </div>
      </div>
    </header>
  );
}
