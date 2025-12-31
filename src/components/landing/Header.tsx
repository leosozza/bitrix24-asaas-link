import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md group-hover:shadow-glow transition-shadow">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              Connect<span className="text-primary">Pay</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 shadow-sm" asChild>
              <Link to="/auth">Começar Grátis</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <nav className="flex flex-col gap-1">
              <a 
                href="#features" 
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors py-3 px-3 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                Recursos
              </a>
              <a 
                href="#pricing" 
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors py-3 px-3 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                Planos
              </a>
              <a 
                href="#faq" 
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors py-3 px-3 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                FAQ
              </a>
              <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-border/50">
                <Button variant="outline" className="justify-center" asChild>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button className="gradient-primary text-primary-foreground justify-center" asChild>
                  <Link to="/auth">Começar Grátis</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
