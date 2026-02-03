
import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, MotionValue } from 'framer-motion';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: 'inventory' | 'add' | 'stats' | 'shopping';
  setActiveTab: (tab: 'inventory' | 'add' | 'stats' | 'shopping') => void;
}

const DOCK_CONFIG = {
  distance: 140,
  magnification: 70,
  baseItemSize: 50,
  panelHeight: 74,
  spring: { mass: 0.1, stiffness: 150, damping: 12 }
};

const DockItem: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  mouseX: MotionValue<number>;
  label: string;
  isActive: boolean;
}> = ({ children, onClick, mouseX, label, isActive }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseDistance = useTransform(mouseX, val => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: DOCK_CONFIG.baseItemSize };
    return val - rect.x - DOCK_CONFIG.baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance, 
    [-DOCK_CONFIG.distance, 0, DOCK_CONFIG.distance], 
    [DOCK_CONFIG.baseItemSize, DOCK_CONFIG.magnification, DOCK_CONFIG.baseItemSize]
  );
  
  const size = useSpring(targetSize, DOCK_CONFIG.spring);

  return (
    <div className="relative">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 0, x: '-50%' }}
            animate={{ opacity: 1, y: -45, x: '-50%' }}
            exit={{ opacity: 0, y: 0, x: '-50%' }}
            className="absolute left-1/2 whitespace-nowrap rounded-lg border border-[#A5D6A7] bg-[#4CAF50] px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-green-100 z-50"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative flex items-center justify-center rounded-2xl shadow-md transition-colors cursor-pointer ${
          isActive 
            ? 'bg-[#4CAF50] text-white shadow-green-200 ring-2 ring-white' 
            : 'bg-white text-[#4CAF50] border border-gray-100 hover:bg-gray-50'
        }`}
      >
        {children}
      </motion.div>
    </div>
  );
};

const MobileLayout: React.FC<MobileLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const mouseX = useMotionValue(Infinity);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // Função para detectar se o teclado está visível baseado no Viewport Visual
    const updateViewport = () => {
      if (window.visualViewport) {
        // Se o viewport visual for menor que 80% da altura da janela, o teclado está aberto
        const isVisible = window.visualViewport.height < window.innerHeight * 0.85;
        setIsKeyboardVisible(isVisible);
      }
    };

    // Listeners para mudanças de foco e redimensionamento do viewport
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    
    // Adicionalmente, detectamos foco direto para uma resposta mais rápida
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardVisible(true);
      }
    };
    
    const onBlur = () => {
      // Pequeno atraso para verificar se o foco foi para outro input
      setTimeout(() => {
        const active = document.activeElement?.tagName;
        if (active !== 'INPUT' && active !== 'TEXTAREA') {
          updateViewport();
        }
      }, 100);
    };

    window.addEventListener('focusin', onFocus);
    window.addEventListener('focusout', onBlur);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('focusout', onBlur);
    };
  }, []);

  const dockItems = [
    { 
      id: 'inventory', 
      label: 'Estoque', 
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> 
    },
    { 
      id: 'add', 
      label: 'Cadastrar', 
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg> 
    },
    { 
      id: 'shopping', 
      label: 'Lista', 
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg> 
    },
    { 
      id: 'stats', 
      label: 'Impacto', 
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> 
    },
  ];

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#FAFAFA] shadow-xl overflow-hidden relative">
      <header className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#4CAF50] rounded-lg flex items-center justify-center shadow-sm shadow-green-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#4CAF50] tracking-tight">LixoZero</h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#A5D6A7] to-[#4CAF50] border-2 border-white shadow-sm flex items-center justify-center text-xs text-white font-bold">
          JS
        </div>
      </header>

      {/* Área de Conteúdo - Scrollable */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative">
        <div className={`px-4 pt-4 transition-all duration-300 ${isKeyboardVisible ? 'pb-10' : 'pb-40'}`}>
          {children}
        </div>
      </main>

      {/* Dock Magnification Menu */}
      <AnimatePresence>
        {!isKeyboardVisible && (
          <motion.div 
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-10 z-40 safe-area-bottom pointer-events-none"
          >
            <div className="flex justify-center">
              <motion.nav
                onMouseMove={(e) => mouseX.set(e.pageX)}
                onMouseLeave={() => mouseX.set(Infinity)}
                className="flex items-end gap-3 px-4 pb-3 rounded-3xl bg-white/90 backdrop-blur-2xl border border-gray-100 shadow-2xl shadow-black/10 pointer-events-auto"
                style={{ height: DOCK_CONFIG.panelHeight }}
              >
                {dockItems.map((item) => (
                  <DockItem
                    key={item.id}
                    label={item.label}
                    isActive={activeTab === item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    mouseX={mouseX}
                  >
                    {item.icon}
                  </DockItem>
                ))}
              </motion.nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Gradiente de fundo suave apenas quando o dock está visível */}
      <AnimatePresence>
        {!isKeyboardVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FAFAFA] to-transparent pointer-events-none z-30 max-w-md mx-auto" 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileLayout;
