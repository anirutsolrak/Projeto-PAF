
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-fraud-background">
      <header className="bg-fraud-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold">Detector de Fraude em Propostas</h1>
          <p className="text-fraud-accent mt-1">
            Identificação de endereços similares em múltiplas propostas
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t">
        <div className="container mx-auto px-4 py-4 text-sm text-gray-600 text-center">
          © 2025 Sistema de Detecção de Fraudes | Desenvolvido para análise de endereços suspeitos
        </div>
      </footer>
    </div>
  );
};

export default Layout;
