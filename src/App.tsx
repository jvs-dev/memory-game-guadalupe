import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Play, 
  RotateCcw, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  CheckCircle2, 
  XCircle,
  Trophy,
  GraduationCap,
  Users,
  Instagram,
  MessageCircle,
  Globe,
  Code
} from 'lucide-react';

import { appwriteService, isAppwriteConfigured } from './services/appwrite';

// --- Types ---

interface CardData {
  id: string;
  image_data: string;
  points?: number;
  author?: string;
  appwriteId?: string;
  fileId?: string;
}

interface GameCard extends CardData {
  uniqueId: number;
  isFlipped: boolean;
  isMatched: boolean;
  isHighlighting?: boolean;
  cardType: 'image' | 'text';
}

// --- Components ---

const Card = ({ card, onClick, disabled }: { card: GameCard; onClick: () => void; disabled: boolean }) => {
  return (
    <div 
      className="relative aspect-square cursor-pointer perspective-1000"
      onClick={() => !disabled && !card.isFlipped && !card.isMatched && onClick()}
    >
      <motion.div
        className="w-full h-full transition-all duration-500 preserve-3d"
        animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
      >
        {/* Front (Hidden) */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-blue-600 rounded-xl shadow-lg border-4 border-white flex items-center justify-center">
          <GraduationCap className="w-8 h-8 md:w-12 md:h-12 text-white opacity-50" />
        </div>

        {/* Back (Image or Text) */}
        <div 
          className={`absolute inset-0 w-full h-full backface-hidden bg-white rounded-xl shadow-lg border-4 overflow-hidden flex items-center justify-center transition-colors duration-300 ${
            card.isHighlighting ? 'border-green-500 bg-green-50 shadow-green-200 shadow-2xl scale-105 z-10' : 'border-blue-500'
          }`}
          style={{ transform: 'rotateY(180deg)' }}
        >
          {card.cardType === 'image' ? (
            <img 
              src={card.image_data} 
              alt={card.id} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget;
                // If it fails, try adding the project ID manually if not present
                if (!img.src.includes('project=')) {
                  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
                  img.src = `${img.src}${img.src.includes('?') ? '&' : '?'}project=${projectId}`;
                  return;
                }
                console.error(`Erro ao carregar imagem da carta ${card.id}:`, card.image_data);
                img.style.display = 'none';
                img.parentElement!.innerHTML = `<div class="flex flex-col items-center text-red-400 p-2"><span class="text-[10px] font-bold uppercase">${card.id}</span><small class="text-[8px]">Erro de carga</small></div>`;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 bg-blue-50">
              <span className="text-xl md:text-2xl font-black text-blue-900 uppercase text-center break-words leading-tight">
                {card.id}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [newId, setNewId] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isValuable, setIsValuable] = useState(false);
  const [loading, setLoading] = useState(false);
  const appwriteActive = isAppwriteConfigured();

  const fetchCards = async () => {
    if (appwriteActive) {
      try {
        const appwriteCards = await appwriteService.getCards();
        setCards(appwriteCards);
      } catch (error) {
        console.error('Appwrite fetch error:', error);
        // Fallback to local
        const res = await fetch('/api/cards');
        const data = await res.json();
        setCards(data);
      }
    } else {
      const res = await fetch('/api/cards');
      const data = await res.json();
      setCards(data);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!newId || !newImage) return;
    setLoading(true);
    const points = isValuable ? 20 : 10;
    const author = 'Admin';
    try {
      let success = false;
      if (appwriteActive) {
        try {
          await appwriteService.uploadCard(newId, newImage, points, author);
          success = true;
        } catch (error) {
          console.error('Appwrite upload failed, trying local fallback:', error);
          // If Appwrite fails, we try local as fallback
          const res = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: newId, image_data: newImage, points, author }),
          });
          if (res.ok) success = true;
        }
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newId, image_data: newImage, points, author }),
        });
        if (res.ok) success = true;
      }

      if (success) {
        setNewId('');
        setNewImage(null);
        setIsValuable(false);
        fetchCards();
      } else {
        alert('Erro ao salvar carta no servidor local.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro crítico ao salvar carta. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (card: CardData) => {
    if (!confirm('Tem certeza que deseja excluir esta carta?')) return;
    
    try {
      if (appwriteActive && card.appwriteId && card.fileId) {
        await appwriteService.deleteCard(card.appwriteId, card.fileId);
      } else {
        await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
      }
      fetchCards();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erro ao excluir carta.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white rounded-3xl shadow-xl mt-4 md:mt-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-blue-800 flex items-center gap-2">
          <Settings className="w-6 h-6 md:w-8 md:h-8" />
          Painel Administrativo
        </h2>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${appwriteActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {appwriteActive ? 'Appwrite Ativo' : 'Armazenamento Local'}
          </div>
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-blue-100 text-blue-700 rounded-full font-semibold hover:bg-blue-200 transition-colors"
          >
            Voltar ao Jogo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12">
        <div className="space-y-4 p-4 md:p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200">
          <h3 className="text-xl font-semibold text-blue-700">Adicionar Nova Carta</h3>
          <input 
            type="text" 
            placeholder="ID da Carta (ex: Leão)" 
            className="w-full px-4 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <div className="flex items-center gap-2 px-1">
            <input 
              type="checkbox" 
              id="valuable-check"
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              checked={isValuable}
              onChange={(e) => setIsValuable(e.target.checked)}
            />
            <label htmlFor="valuable-check" className="text-blue-700 font-medium cursor-pointer">
              Esta carta vale mais pontos (20 pts)
            </label>
          </div>
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              className="hidden" 
              id="file-upload"
            />
            <label 
              htmlFor="file-upload"
              className="flex items-center justify-center gap-2 w-full px-4 py-6 md:py-8 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors"
            >
              {newImage ? (
                <img src={newImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-500" />
                  <span className="text-blue-600 font-medium">Escolher Imagem</span>
                </>
              )}
            </label>
          </div>
          <button 
            onClick={handleUpload}
            disabled={loading || !newId || !newImage}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md"
          >
            {loading ? 'Subindo...' : 'Salvar Carta'}
          </button>
        </div>

        <div className="p-4 md:p-6 bg-blue-50 rounded-2xl">
          <h3 className="text-xl font-semibold text-blue-700 mb-4">Estatísticas</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-blue-800">
              <span>Total de Cartas:</span>
              <span className="font-bold">{cards.length}</span>
            </div>
            <div className="text-sm text-blue-600 italic">
              * O jogo seleciona 6 pares aleatórios das cartas cadastradas.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {cards.map((card) => (
          <div key={card.appwriteId || card.id} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-blue-100 shadow-sm flex items-center justify-center bg-gray-50">
            <img 
              src={card.image_data} 
              alt={card.id} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                const img = e.currentTarget;
                // If it fails, try adding the project ID manually if not present
                if (!img.src.includes('project=')) {
                  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
                  img.src = `${img.src}${img.src.includes('?') ? '&' : '?'}project=${projectId}`;
                  return;
                }
                console.error(`Erro ao carregar imagem administrativa da carta ${card.id}:`, card.image_data);
                img.style.display = 'none';
                img.parentElement!.innerHTML = `<div class="text-[10px] text-red-400 font-bold text-center p-2">${card.id}<br/>Erro</div>`;
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <span className="text-white font-bold text-sm">{card.id}</span>
              <div className="flex flex-col items-center gap-1">
                <span className="bg-yellow-400 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {card.points || 10} pts
                </span>
                <span className="text-white text-[10px] opacity-80 italic">
                  Por: {card.author || 'Admin'}
                </span>
              </div>
              <button 
                onClick={() => handleDelete(card)}
                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StudentUploadModal = ({ isOpen, onClose, onUploadSuccess }: { isOpen: boolean; onClose: () => void; onUploadSuccess: () => void }) => {
  const [newId, setNewId] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const appwriteActive = isAppwriteConfigured();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!newId || !newImage || !authorName) return;
    setLoading(true);
    // Students always upload 10 points cards
    const points = 10;
    try {
      let success = false;
      if (appwriteActive) {
        try {
          await appwriteService.uploadCard(newId, newImage, points, authorName);
          success = true;
        } catch (error) {
          console.error('Appwrite upload failed, trying local fallback:', error);
          const res = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: newId, image_data: newImage, points, author: authorName }),
          });
          if (res.ok) success = true;
        }
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newId, image_data: newImage, points, author: authorName }),
        });
        if (res.ok) success = true;
      }

      if (success) {
        setNewId('');
        setAuthorName('');
        setNewImage(null);
        onUploadSuccess();
        onClose();
        alert('Desenho enviado com sucesso! Obrigado por participar.');
      } else {
        alert('Erro ao enviar desenho.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao enviar desenho.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold text-blue-800">Enviar meu Desenho</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-blue-600 text-sm">
          Compartilhe sua arte com a escola! Seu desenho poderá aparecer no jogo da memória.
        </p>

        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Seu Nome (ex: Maria Silva)" 
            className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Nome do desenho (ex: Gato)" 
            className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              className="hidden" 
              id="student-file-upload"
            />
            <label 
              htmlFor="student-file-upload"
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors"
            >
              {newImage ? (
                <img src={newImage} alt="Preview" className="w-32 h-32 object-cover rounded-lg shadow-md" />
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 text-blue-300" />
                  <span className="text-blue-600 font-medium">Selecionar Imagem</span>
                </>
              )}
            </label>
          </div>

          <button 
            onClick={handleUpload}
            disabled={loading || !newId || !newImage || !authorName}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Enviando...' : 'Enviar Desenho'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [view, setView] = useState<'menu' | 'game' | 'admin'>('menu');
  const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [cards, setCards] = useState<GameCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showStudentUpload, setShowStudentUpload] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [matchedCardId, setMatchedCardId] = useState<string | null>(null);

  const initGame = useCallback(async (mode: 'solo' | 'multiplayer' = gameMode) => {
    let allCards: CardData[] = [];
    
    if (isAppwriteConfigured()) {
      try {
        allCards = await appwriteService.getCards();
      } catch (error) {
        console.error('Appwrite fetch error:', error);
        const res = await fetch('/api/cards');
        allCards = await res.json();
      }
    } else {
      const res = await fetch('/api/cards');
      allCards = await res.json();
    }

    if (allCards.length < 6) {
      alert('É necessário cadastrar pelo menos 6 cartas no painel administrativo!');
      handleAdminAccess();
      return;
    }

    setGameMode(mode);
    setCurrentPlayer(1);
    setScores({ p1: 0, p2: 0 });

    // Shuffle and pick 6
    const shuffledPool = [...allCards].sort(() => Math.random() - 0.5);
    const selected = shuffledPool.slice(0, 6);

    // Duplicate and create pairs (one image, one text)
    const gamePool: GameCard[] = [];
    selected.forEach((card) => {
      // Image version
      gamePool.push({
        ...card,
        uniqueId: Math.random(), // Temporary unique ID for sorting
        isFlipped: false,
        isMatched: false,
        cardType: 'image'
      });
      // Text version
      gamePool.push({
        ...card,
        uniqueId: Math.random(), // Temporary unique ID for sorting
        isFlipped: false,
        isMatched: false,
        cardType: 'text'
      });
    });

    // Final shuffle and assign stable uniqueIds
    const finalPool = gamePool
      .sort(() => Math.random() - 0.5)
      .map((card, index) => ({
        ...card,
        uniqueId: index
      }));

    setCards(finalPool);
    setFlippedCards([]);
    setMatches(0);
    setMoves(0);
    setIsWon(false);
    setView('game');
  }, [isAdminAuth, gameMode]);

  const handleAdminAccess = () => {
    if (isAdminAuth) {
      setView('admin');
    } else {
      setShowPassModal(true);
    }
  };

  const handleAuth = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (passwordInput === 'guadalupe@12') {
      setIsAdminAuth(true);
      setView('admin');
      setShowPassModal(false);
      setPasswordInput('');
    } else {
      alert('Senha incorreta!');
      setPasswordInput('');
    }
  };

  const handleCardClick = (uniqueId: number) => {
    if (flippedCards.length === 2) return;

    const newCards = [...cards];
    const cardIndex = newCards.findIndex(c => c.uniqueId === uniqueId);
    newCards[cardIndex].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, uniqueId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.uniqueId === firstId)!;
      const secondCard = cards.find(c => c.uniqueId === secondId)!;

      if (firstCard.id === secondCard.id) {
        // Match - Highlight first
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.uniqueId === firstId || c.uniqueId === secondId ? { ...c, isHighlighting: true } : c
          ));
          setMatchedCardId(firstCard.id);

          // After 2 seconds, mark as matched
          setTimeout(() => {
            const cardPoints = firstCard.points || 10;
            setCards(prev => prev.map(c => 
              c.id === firstCard.id ? { ...c, isMatched: true, isHighlighting: false } : c
            ));
            setMatches(m => m + 1);
            setMatchedCardId(null);
            
            if (gameMode === 'solo') {
              setScores(prev => ({ ...prev, p1: prev.p1 + cardPoints }));
            } else {
              setScores(prev => ({
                ...prev,
                [currentPlayer === 1 ? 'p1' : 'p2']: prev[currentPlayer === 1 ? 'p1' : 'p2'] + cardPoints
              }));
            }

            setFlippedCards([]);
            if (matches + 1 === 6) setIsWon(true);
          }, 2000);
        }, 600);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            newFlipped.includes(c.uniqueId) ? { ...c, isFlipped: false } : c
          ));
          setFlippedCards([]);
          if (gameMode === 'multiplayer') {
            setCurrentPlayer(prev => prev === 1 ? 2 : 1);
          }
        }, 1000);
      }
    }
  };

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-blue-50 py-6 md:py-12 px-4">
        <AdminPanel onBack={() => setView('menu')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 font-sans text-blue-900">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-100 py-4 px-4 md:px-6 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-blue-600 p-1.5 md:p-2 rounded-lg">
            <GraduationCap className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="text-lg md:text-2xl font-bold text-blue-800 tracking-tight">Colégio Guadalupe</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowStudentUpload(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex items-center gap-2"
            title="Enviar Desenho"
          >
            <Upload className="w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden md:inline text-sm font-bold">Enviar Desenho</span>
          </button>
          <button 
            onClick={handleAdminAccess}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Configurações"
          >
            <Settings className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-12">
        <AnimatePresence mode="wait">
          {showPassModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/80 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
              >
                <h3 className="text-2xl font-bold text-blue-800 text-center">Acesso Restrito</h3>
                <form onSubmit={handleAuth} className="space-y-4">
                  <input 
                    type="password" 
                    placeholder="Senha de administrador" 
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowPassModal(false)}
                      className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                    >
                      Entrar
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}

          <AnimatePresence>
            {showStudentUpload && (
              <StudentUploadModal 
                isOpen={showStudentUpload} 
                onClose={() => setShowStudentUpload(false)} 
                onUploadSuccess={() => {}} 
              />
            )}
          </AnimatePresence>

          {view === 'menu' ? (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6 md:space-y-8 py-12 md:py-20"
            >
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-black text-blue-900 leading-tight">Jogo da Memória</h2>
                <p className="text-lg md:text-xl text-blue-700 max-w-lg mx-auto px-4">
                  Divirta-se com os desenhos feitos pelos nossos alunos! Encontre os pares e complete o desafio.
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                <button 
                  onClick={() => initGame('solo')}
                  className="group relative inline-flex items-center gap-3 px-8 md:px-12 py-4 md:py-5 bg-blue-600 text-white text-xl md:text-2xl font-bold rounded-full hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-200/50 hover:-translate-y-1 active:scale-95"
                >
                  <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                  Modo Solo
                </button>
                <button 
                  onClick={() => initGame('multiplayer')}
                  className="group relative inline-flex items-center gap-3 px-8 md:px-12 py-4 md:py-5 bg-indigo-600 text-white text-xl md:text-2xl font-bold rounded-full hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-200/50 hover:-translate-y-1 active:scale-95"
                >
                  <Users className="w-6 h-6 md:w-8 md:h-8" />
                  2 Jogadores
                </button>
              </div>

              {/* Social Media & Developer Tag */}
              <div className="fixed bottom-6 right-6 flex items-center gap-4 z-30">
                <div className="flex gap-2">
                  <a 
                    href="https://www.instagram.com/colegioguadalupeoficial/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-white text-pink-600 rounded-full shadow-lg hover:scale-110 transition-transform border border-pink-100"
                    title="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a 
                    href="https://wa.me/5511999999999" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-white text-green-600 rounded-full shadow-lg hover:scale-110 transition-transform border border-green-100"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                  <a 
                    href="https://www.colegioguadalupe.com.br" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-white text-blue-600 rounded-full shadow-lg hover:scale-110 transition-transform border border-blue-100"
                    title="Website"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                </div>
                <a 
                  href="https://jvsdev.vercel.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/10 backdrop-blur-sm text-blue-900 rounded-lg hover:bg-blue-900/20 transition-colors group"
                >
                  <Code className="w-4 h-4" />
                  <span className="text-sm font-bold tracking-tight">jvsdev</span>
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 md:space-y-8"
            >
              <div className="flex flex-wrap justify-center gap-4 md:gap-8 items-center bg-white p-4 md:p-6 rounded-3xl shadow-md">
                {gameMode === 'solo' ? (
                  <>
                    <div className="text-center px-2">
                      <span className="block text-[10px] md:text-xs uppercase font-bold text-blue-500 tracking-widest">Movimentos</span>
                      <span className="text-2xl md:text-3xl font-black text-blue-800">{moves}</span>
                    </div>
                    <div className="text-center px-2">
                      <span className="block text-[10px] md:text-xs uppercase font-bold text-blue-500 tracking-widest">Pontos</span>
                      <span className="text-2xl md:text-3xl font-black text-blue-800">{scores.p1}</span>
                    </div>
                    <div className="text-center px-2">
                      <span className="block text-[10px] md:text-xs uppercase font-bold text-blue-500 tracking-widest">Pares</span>
                      <span className="text-2xl md:text-3xl font-black text-blue-800">{matches} / 6</span>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-8 items-center">
                    <div className={`text-center px-4 py-2 rounded-2xl transition-all ${currentPlayer === 1 ? 'bg-blue-100 ring-2 ring-blue-400' : 'opacity-50'}`}>
                      <span className="block text-[10px] uppercase font-bold text-blue-500 tracking-widest">Jogador 1</span>
                      <span className="text-2xl font-black text-blue-800">{scores.p1} pts</span>
                    </div>
                    <div className="text-xl font-bold text-blue-300">VS</div>
                    <div className={`text-center px-4 py-2 rounded-2xl transition-all ${currentPlayer === 2 ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'opacity-50'}`}>
                      <span className="block text-[10px] uppercase font-bold text-indigo-500 tracking-widest">Jogador 2</span>
                      <span className="text-2xl font-black text-indigo-800">{scores.p2} pts</span>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => initGame()}
                  className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-blue-100 text-blue-700 rounded-2xl font-bold hover:bg-blue-200 transition-colors text-sm md:text-base"
                >
                  <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                  Reiniciar
                </button>
              </div>

              {/* Matched Card ID Notification */}
              <AnimatePresence>
                {matchedCardId && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
                  >
                    <div className="bg-blue-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-3 border-4 border-white/20 backdrop-blur-md">
                      <CheckCircle2 className="w-12 h-12 text-blue-200" />
                      <div className="text-center">
                        <span className="block text-xs uppercase tracking-widest opacity-80 mb-1">Par encontrado!</span>
                        <span className="text-2xl md:text-3xl font-black uppercase tracking-tight">{matchedCardId}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 max-w-3xl mx-auto px-2">
                {cards.map((card) => (
                  <div key={card.uniqueId}>
                    <Card 
                      card={card} 
                      onClick={() => handleCardClick(card.uniqueId)}
                      disabled={flippedCards.length === 2}
                    />
                  </div>
                ))}
              </div>

              {isWon && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/80 backdrop-blur-sm p-4"
                >
                  <div className="bg-white rounded-[32px] md:rounded-[40px] p-8 md:p-12 text-center space-y-6 max-w-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-500" />
                    <Trophy className="w-16 h-16 md:w-24 md:h-24 text-yellow-500 mx-auto animate-bounce" />
                    <h2 className="text-3xl md:text-4xl font-black text-blue-900">
                      {gameMode === 'solo' ? 'Parabéns!' : 
                       scores.p1 > scores.p2 ? 'Jogador 1 Venceu!' :
                       scores.p2 > scores.p1 ? 'Jogador 2 Venceu!' : 'Empate!'}
                    </h2>
                    <p className="text-base md:text-lg text-blue-700">
                      {gameMode === 'solo' ? (
                        <>Você completou o jogo em <span className="font-bold">{moves}</span> movimentos e fez <span className="font-bold">{scores.p1}</span> pontos!</>
                      ) : (
                        <>Placar final: <span className="font-bold">{scores.p1}</span> vs <span className="font-bold">{scores.p2}</span> pontos.</>
                      )}
                    </p>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => initGame()}
                        className="w-full py-3 md:py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg md:text-xl hover:bg-blue-700 transition-all shadow-lg"
                      >
                        Jogar Novamente
                      </button>
                      <button 
                        onClick={() => setView('menu')}
                        className="w-full py-3 md:py-4 bg-blue-50 text-blue-700 rounded-2xl font-bold hover:bg-blue-100 transition-all"
                      >
                        Menu Principal
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-6 md:py-8 text-center text-blue-600/60 text-xs md:text-sm font-medium px-4">
        &copy; {new Date().getFullYear()} Colégio Guadalupe • Atividade Recreativa
      </footer>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
}
