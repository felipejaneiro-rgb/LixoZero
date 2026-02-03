
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MobileLayout from './components/MobileLayout';
import { FoodItem, FoodStatus, StorageType, ShoppingListItem, UserProfile, ShoppingPriority } from './types';
import { identifyFoodInput, interpretConsumption } from './services/geminiService';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'add' | 'stats' | 'shopping'>('inventory');
  const [inventory, setInventory] = useState<FoodItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  
  const [addTextInput, setAddTextInput] = useState('');
  const [consumeTextInput, setConsumeTextInput] = useState('');
  const [selectedStorage, setSelectedStorage] = useState<StorageType | 'AUTO'>('AUTO');

  const [user, setUser] = useState<UserProfile>({
    name: 'João Silva',
    plan: 'premium',
    alertDaysBefore: 3
  });

  const recognitionInstanceRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  // Load mock initial data and check for expired items
  useEffect(() => {
    const mockData: FoodItem[] = [
      {
        id: '1',
        name: 'Leite Integral',
        initialQuantity: 1,
        currentQuantity: 1,
        unit: 'litro',
        storageType: StorageType.FRIDGE,
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        status: FoodStatus.ACTIVE,
        estimatedValue: 4.50
      },
      {
        id: '2',
        name: 'Pão de Forma',
        initialQuantity: 1,
        currentQuantity: 0.5,
        unit: 'unidade',
        storageType: StorageType.PANTRY,
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        status: FoodStatus.ACTIVE,
        estimatedValue: 8.90
      }
    ];
    setInventory(mockData);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const expiredItems = inventory.filter(item => 
      item.currentQuantity > 0 && 
      item.status === FoodStatus.ACTIVE && 
      new Date(item.expiryDate).getTime() < now
    );

    if (expiredItems.length > 0) {
      setInventory(prev => prev.map(item => {
        if (item.currentQuantity > 0 && item.status === FoodStatus.ACTIVE && new Date(item.expiryDate).getTime() < now) {
          return { ...item, status: FoodStatus.EXPIRED, currentQuantity: 0 };
        }
        return item;
      }));

      setShoppingList(s => {
        const newList = [...s];
        expiredItems.forEach(item => {
          if (!newList.find(si => si.name.toLowerCase() === item.name.toLowerCase())) {
            newList.push({
              id: Math.random().toString(36).substr(2, 9),
              name: item.name,
              suggestedQuantity: 1,
              unit: item.unit,
              reason: 'expired',
              priority: 'Urgente'
            });
          }
        });
        return newList;
      });
    }
  }, [inventory]);

  const totalWasteValue = useMemo(() => {
    return inventory
      .filter(i => i.status === FoodStatus.SPOILED || i.status === FoodStatus.EXPIRED)
      .reduce((acc, curr) => acc + curr.estimatedValue, 0);
  }, [inventory]);

  const wasteByItem = useMemo(() => {
    const map: Record<string, number> = {};
    inventory
      .filter(i => i.status === FoodStatus.SPOILED || i.status === FoodStatus.EXPIRED)
      .forEach(i => {
        map[i.name] = (map[i.name] || 0) + i.estimatedValue;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [inventory]);

  const registerFood = useCallback(async (input: string | File) => {
    setIsProcessing(true);
    try {
      let result;
      if (typeof input === 'string') {
        if (!input.trim()) {
          setIsProcessing(false);
          return;
        }
        const finalInput = selectedStorage !== 'AUTO' 
          ? `${input} (IMPORTANTE: armazenar todos os itens em: ${selectedStorage})`
          : input;
        result = await identifyFoodInput(finalInput);
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(input);
        });
        const base64 = await base64Promise;
        result = await identifyFoodInput({ 
          data: base64.split(',')[1], 
          mimeType: input.type 
        });
      }

      if (result && result.length > 0) {
        const newItems: FoodItem[] = result.map(r => ({
          id: Math.random().toString(36).substr(2, 9),
          name: r.name,
          initialQuantity: r.quantity,
          currentQuantity: r.quantity,
          unit: r.unit,
          storageType: selectedStorage !== 'AUTO' ? selectedStorage as StorageType : r.storageType,
          expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * r.expiryDays).toISOString(),
          createdAt: new Date().toISOString(),
          status: FoodStatus.ACTIVE,
          estimatedValue: r.estimatedPrice
        }));

        setInventory(prev => [...prev, ...newItems]);
        setAddTextInput('');
        setActiveTab('inventory');
      }
    } catch (error) {
      console.error("Erro ao registrar alimento:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedStorage]);

  const handleSpoiled = useCallback((id: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    setInventory(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, currentQuantity: 0, status: FoodStatus.SPOILED };
      }
      return i;
    }));

    setShoppingList(s => {
       const existing = s.find(si => si.name.toLowerCase() === item.name.toLowerCase());
       if (existing) {
         return s.map(si => si.id === existing.id ? { ...si, priority: 'Urgente' as ShoppingPriority, reason: 'spoiled' as const } : si);
       }
       return [...s, { 
        id: Math.random().toString(36).substr(2, 9), 
        name: item.name, 
        suggestedQuantity: 1, 
        unit: item.unit, 
        reason: 'spoiled',
        priority: 'Urgente'
      }];
    });
  }, [inventory]);

  const consumeFood = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    try {
      const consumptions = await interpretConsumption(text);
      setInventory(prev => {
        let updatedInventory = [...prev];
        consumptions.forEach(c => {
          const matchingItems = updatedInventory
            .filter(item => item.name.toLowerCase() === c.name.toLowerCase() && item.currentQuantity > 0)
            .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

          let amountToConsume = c.quantity;
          matchingItems.forEach(item => {
            if (amountToConsume <= 0) return;
            const canTake = Math.min(item.currentQuantity, amountToConsume);
            item.currentQuantity -= canTake;
            amountToConsume -= canTake;
            
            if (item.currentQuantity === 0) {
              item.status = FoodStatus.CONSUMED;
              setShoppingList(s => {
                if (s.find(si => si.name.toLowerCase() === item.name.toLowerCase())) return s;
                return [...s, { 
                  id: Math.random().toString(36).substr(2, 9), 
                  name: item.name, 
                  suggestedQuantity: 1, 
                  unit: item.unit, 
                  reason: 'finished',
                  priority: 'Normal'
                }];
              });
            }
          });
        });
        return [...updatedInventory];
      });
      setConsumeTextInput('');
      setActiveTab('inventory');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionInstanceRef.current) {
        recognitionInstanceRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    transcriptRef.current = '';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        transcriptRef.current += ' ' + finalTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.error("Erro no reconhecimento de voz:", event.error);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionInstanceRef.current = null;
      const finalText = transcriptRef.current.trim();
      if (finalText) {
        registerFood(finalText);
      }
    };

    try {
      recognition.start();
      recognitionInstanceRef.current = recognition;
    } catch (e) {
      console.error("Falha ao iniciar reconhecimento:", e);
      setIsRecording(false);
    }
  };

  const clearShoppingList = useCallback(() => {
    if (confirm('Tem certeza que deseja limpar toda a lista de compras?')) {
      setShoppingList([]);
    }
  }, []);

  const manualAddShoppingItem = useCallback(() => {
    if (!manualItemName.trim()) return;
    setShoppingList(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: manualItemName,
      suggestedQuantity: 1,
      unit: 'unidade',
      reason: 'manual',
      priority: 'Normal'
    }]);
    setManualItemName('');
  }, [manualItemName]);

  const updatePriority = useCallback((id: string, priority: ShoppingPriority) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, priority } : item));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setShoppingList(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.suggestedQuantity + delta);
        return { ...item, suggestedQuantity: newQty };
      }
      return item;
    }));
  }, []);

  const getPriorityStyle = (priority: ShoppingPriority) => {
    switch (priority) {
      case 'Urgente': return 'bg-red-100 text-red-600 border-red-200';
      case 'Normal': return 'bg-green-100 text-green-600 border-green-200';
      case 'Baixa': return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getReasonText = (reason: 'finished' | 'spoiled' | 'manual' | 'expired') => {
    switch (reason) {
      case 'finished': return 'Estoque acabou';
      case 'spoiled': return 'Reposição de item estragado';
      case 'manual': return 'Adicionado manualmente';
      case 'expired': return 'Vencido no estoque';
      default: return '';
    }
  };

  return (
    <MobileLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Bem-vindo, {user.name}</h2>
            <div className="bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] rounded-2xl p-6 text-white shadow-lg shadow-green-100">
              <p className="text-sm opacity-80">Sua economia este mês</p>
              <h3 className="text-3xl font-bold mt-1">R$ 142,50</h3>
              <div className="flex items-center mt-4 text-xs bg-white/20 w-fit px-2 py-1 rounded-full">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
                +12% que mês passado
              </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Seu Estoque</h3>
              <button className="text-[#4CAF50] text-sm font-medium">Ver tudo</button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {inventory.filter(i => i.currentQuantity > 0 || i.status === FoodStatus.EXPIRED).map(item => {
                const diffTime = new Date(item.expiryDate).getTime() - Date.now();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isNearExpiry = daysLeft <= user.alertDaysBefore && daysLeft > 0;
                const isExpired = daysLeft <= 0 || item.status === FoodStatus.EXPIRED;
                
                return (
                  <div key={item.id} className={`bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 ${isExpired ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${isExpired ? 'bg-red-50' : 'bg-[#A5D6A7]/20'}`}>
                      {item.name.toLowerCase().includes('leite') ? '🥛' : item.name.toLowerCase().includes('pão') ? '🍞' : item.name.toLowerCase().includes('carne') ? '🥩' : '🍎'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{item.name}</h4>
                      <p className="text-xs text-gray-400">{item.currentQuantity} {item.unit} • {item.storageType}</p>
                      <p className="text-[10px] text-gray-400">Cadastrado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}</p>
                      <div className="flex items-center mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isExpired 
                            ? 'bg-red-100 text-red-600' 
                            : isNearExpiry 
                              ? 'bg-[#FBC02D]/10 text-[#FBC02D]' 
                              : 'bg-[#A5D6A7]/10 text-[#4CAF50]'
                        }`}>
                          {isExpired 
                            ? 'Vencido' 
                            : daysLeft === 1 
                              ? 'Vence amanhã' 
                              : `Vence em ${daysLeft} dias`
                          }
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSpoiled(item.id)} 
                      aria-label="Marcar como estragado"
                      className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                );
              })}
              {inventory.filter(i => i.currentQuantity > 0 || i.status === FoodStatus.EXPIRED).length === 0 && (
                <div className="text-center py-12 text-gray-400">
                   Seu estoque está vazio. Comece adicionando itens!
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <header className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Gerenciar Estoque</h2>
            <p className="text-sm text-gray-500">Adicione compras ou registre o que usou</p>
          </header>

          {/* SESSÃO 1: ENTRADA (NOVA COMPRA) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 bg-[#4CAF50] rounded flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Entrada de Estoque</h3>
            </div>
            
            <div className="bg-white rounded-3xl p-5 border border-green-50 shadow-sm shadow-green-100/50 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => document.getElementById('camera-input')?.click()}
                  className="bg-green-50 border border-green-100 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 text-[#4CAF50] hover:bg-green-100 transition-all active:scale-95"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-[11px] font-bold uppercase">Foto do Item</span>
                </button>
                <button 
                  onClick={toggleVoiceRecording}
                  className={`border rounded-2xl py-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${isRecording ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-green-50 text-[#4CAF50] border-green-100 hover:bg-green-100'}`}
                >
                  {isRecording ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  )}
                  <span className="text-[11px] font-bold uppercase">{isRecording ? 'Ouvindo...' : 'Falar Itens'}</span>
                </button>
                <input id="camera-input" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && registerFood(e.target.files[0])} />
              </div>

              <div className="space-y-3">
                <div className="relative group">
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#4CAF50] outline-none min-h-[110px] resize-none placeholder:text-gray-300"
                    placeholder="Ex: Comprei 2kg de frango e 1 pacote de macarrão..."
                    value={addTextInput}
                    onChange={(e) => setAddTextInput(e.target.value)}
                  />
                  <button 
                    onClick={() => registerFood(addTextInput)}
                    disabled={!addTextInput.trim()}
                    className="absolute bottom-3 right-3 bg-[#4CAF50] text-white p-2.5 rounded-xl shadow-lg shadow-green-200 hover:bg-[#43A047] disabled:opacity-30 transition-all active:scale-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  </button>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">Local de Armazenamento</span>
                  <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { type: StorageType.FRIDGE, emoji: '❄️', label: 'Geladeira' },
                      { type: StorageType.FREEZER, emoji: '🧊', label: 'Freezer' },
                      { type: StorageType.PANTRY, emoji: '📦', label: 'Despensa' },
                      { type: 'AUTO', emoji: '🤖', label: 'Auto IA' }
                    ].map(opt => (
                      <button 
                        key={opt.type}
                        onClick={() => setSelectedStorage(opt.type as any)}
                        className={`flex-none min-w-[85px] flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold transition-all ${selectedStorage === opt.type ? 'bg-white text-[#4CAF50] shadow-sm scale-105' : 'text-gray-400 opacity-60'}`}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SESSÃO 2: SAÍDA (CONSUMO) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 bg-slate-500 rounded flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" /></svg>
              </div>
              <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Saída de Estoque (Consumo)</h3>
            </div>
            
            <div className="bg-white rounded-3xl p-5 border border-slate-50 shadow-sm shadow-slate-200/50 space-y-4">
              <p className="text-[11px] text-gray-400 px-1 italic">Diga o que você usou para que a IA atualize o estoque automaticamente.</p>
              
              <div className="relative">
                <textarea 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-slate-400 outline-none min-h-[80px] resize-none placeholder:text-gray-300"
                  placeholder="Ex: Usei metade da carne moída e comi 1 pão..."
                  value={consumeTextInput}
                  onChange={(e) => setConsumeTextInput(e.target.value)}
                />
                <button 
                  onClick={() => consumeFood(consumeTextInput)}
                  disabled={!consumeTextInput.trim()}
                  className="absolute bottom-3 right-3 bg-slate-600 text-white p-2.5 rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-90"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'shopping' && (
        <div className="space-y-6">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Lista de Compras</h2>
              <p className="text-sm text-gray-500">Gerada automaticamente</p>
            </div>
            <div className="flex gap-2">
              {shoppingList.length > 0 && (
                <button 
                  onClick={clearShoppingList}
                  className="bg-red-50 text-red-500 px-4 py-2 rounded-full text-xs font-bold border border-red-100"
                >
                  Limpar Tudo
                </button>
              )}
              <button className="bg-[#4CAF50] text-white px-4 py-2 rounded-full text-xs font-bold">Enviar</button>
            </div>
          </header>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Adicionar Item Manualmente</h3>
            <div className="flex gap-2">
              <input 
                type="text"
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualAddShoppingItem()}
                placeholder="Ex: Maçã, Detergente..."
                className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#4CAF50] outline-none border-none"
              />
              <button 
                onClick={manualAddShoppingItem}
                className="bg-[#4CAF50] text-white p-2 rounded-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            {shoppingList.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                Sua lista está vazia
              </div>
            ) : (
              shoppingList.map((item, idx) => (
                <div key={item.id} className={`p-4 flex flex-col gap-3 ${idx !== shoppingList.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-[#4CAF50] focus:ring-[#4CAF50]" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-800">{item.name}</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-gray-100 rounded-lg px-1 py-0.5">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded transition-colors"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-gray-800 px-2 min-w-[20px] text-center">
                              {item.suggestedQuantity}
                            </span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <select 
                            value={item.priority} 
                            onChange={(e) => updatePriority(item.id, e.target.value as ShoppingPriority)}
                            className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase border cursor-pointer outline-none ${getPriorityStyle(item.priority)}`}
                          >
                            <option value="Urgente">Urgente</option>
                            <option value="Normal">Normal</option>
                            <option value="Baixa">Baixa</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {item.suggestedQuantity} {item.unit} • {getReasonText(item.reason)}
                      </p>
                    </div>
                    <button onClick={() => setShoppingList(prev => prev.filter(i => i.id !== item.id))} className="text-gray-300 ml-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <header>
            <h2 className="text-2xl font-bold text-gray-800">Insights</h2>
            <p className="text-sm text-gray-500">Seu impacto positivo</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">Desperdício</span>
              <p className="text-2xl font-bold text-red-400 mt-1">R$ {totalWasteValue.toFixed(2).replace('.', ',')}</p>
              <p className="text-[10px] text-gray-400 mt-1">Total acumulado</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">Itens Salvos</span>
              <p className="text-2xl font-bold text-[#4CAF50] mt-1">{inventory.filter(i => i.status === FoodStatus.CONSUMED).length}</p>
              <p className="text-[10px] text-gray-400 mt-1">Alimentos consumidos</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">Maiores Desperdícios</h3>
            <div className="space-y-4">
              {wasteByItem.length > 0 ? (
                wasteByItem.slice(0, 3).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${value > 10 ? 'bg-red-400' : 'bg-[#FBC02D]'}`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{name}</p>
                      <div className="w-full bg-gray-100 h-1 rounded-full mt-1">
                        <div className={`h-1 rounded-full ${value > 10 ? 'bg-red-400' : 'bg-[#FBC02D]'}`} style={{width: `${Math.min(100, (value / (totalWasteValue || 1)) * 100)}%`}}></div>
                      </div>
                    </div>
                    <span className="text-sm font-bold">R$ {value.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum desperdício registrado ainda. Ótimo trabalho!</p>
              )}
            </div>
          </div>
          
          <div className="bg-[#A5D6A7]/10 p-4 rounded-2xl border border-[#A5D6A7]/30">
            <div className="flex gap-3">
              <span className="text-xl">💡</span>
              <div>
                <h4 className="font-bold text-[#2E7D32]">Dica do Especialista</h4>
                <p className="text-xs text-[#2E7D32]/80 mt-1 leading-relaxed">
                  {wasteByItem.length > 0 && wasteByItem[0][0].toLowerCase().includes('pão') 
                    ? 'Você costuma perder pães na despensa. Tente congelar metade do pacote logo que comprar para manter a validade por até 3 meses!' 
                    : 'Mantenha os itens que vencem primeiro na frente da geladeira ("First In, First Out") para garantir que sejam consumidos a tempo.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[#4CAF50] font-bold animate-pulse">LixoZero está processando...</p>
        </div>
      )}
    </MobileLayout>
  );
};

export default App;
