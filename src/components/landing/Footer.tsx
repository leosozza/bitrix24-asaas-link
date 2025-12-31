import { Mail, Linkedin, Instagram, Phone, MapPin, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">B+A</span>
              </div>
              <span className="font-display font-bold text-xl">ConnectPay</span>
            </div>
            <p className="text-background/70 text-sm leading-relaxed mb-4">
              A integração oficial do Asaas para o Bitrix24. 
              Automatize pagamentos e acelere suas vendas.
            </p>
            <div className="flex items-center gap-2 text-sm text-background/70">
              <MapPin className="w-4 h-4" />
              <span>São Paulo, Brasil</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-semibold mb-4">Produto</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li>
                <a href="#features" className="hover:text-background transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-background transition-colors">
                  Planos e Preços
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Integrações
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-semibold mb-4">Recursos</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Documentação
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Guia de Instalação
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-background transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Status do Sistema
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold mb-4">Empresa</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Sobre Nós
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Contato
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-background transition-colors">
                  Parceiros
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-background/50">
            <span>© 2025 ConnectPay. Todos os direitos reservados.</span>
            <span className="hidden md:inline">•</span>
            <a 
              href="https://thoth24.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-background transition-colors"
            >
              Desenvolvido por Thoth24
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-background/70 hover:text-background transition-colors">
              Termos de Uso
            </a>
            <a href="#" className="text-sm text-background/70 hover:text-background transition-colors">
              Privacidade
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="mailto:contato@thoth24.com" 
              className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              title="Email"
            >
              <Mail className="w-5 h-5" />
            </a>
            <a 
              href="https://wa.me/5511978659280" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              title="WhatsApp"
            >
              <Phone className="w-5 h-5" />
            </a>
            <a 
              href="https://www.linkedin.com/company/thoth24" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              title="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a 
              href="https://www.instagram.com/thoth24oficial" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              title="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
