import { useState } from "react";
import { Swords, BarChart2, Settings, X } from "lucide-react";
import { DraftForm, DraftResult, DraftState, ChampionCardsForm, ChampionSuggestion } from "./components";
import { ProfileAnalytics } from "./ProfileAnalytics";

function MainMenu({ onSelect }: { onSelect: (module: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-[#091428] border-2 border-[#c8aa6e] clip-chamfer inline-block hextech-glow shadow-[0_0_15px_rgba(200,170,110,0.3)]">
            <Swords className="w-12 h-12 text-[#c8aa6e]" />
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-[#c8aa6e] tracking-tight uppercase drop-shadow-[0_0_8px_rgba(200,170,110,0.5)]">
          Poro Analist
        </h1>
        <p className="text-lg text-[#0397ab] max-w-2xl mx-auto mt-4 drop-shadow-md">
          E-spor standartlarında derinlemesine analiz araçları.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
        <button 
          onClick={() => onSelect('draft')}
          className="group relative hextech-panel clip-chamfer p-8 md:p-12 text-center transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(200,170,110,0.4)] border-2 border-transparent hover:border-[#c8aa6e] flex flex-col items-center justify-center gap-6"
        >
          <div className="absolute inset-0 bg-[#c8aa6e]/0 group-hover:bg-[#c8aa6e]/10 transition-colors z-0"></div>
          <Swords className="w-20 h-20 text-[#0397ab] group-hover:text-[#c8aa6e] transition-colors relative z-10" />
          <h2 className="text-2xl font-bold text-[#f0e6d2] uppercase tracking-wider relative z-10">Draft Assistant</h2>
          <p className="text-sm text-[#f0e6d2]/70 relative z-10">Meta ve counter analizleri ile en optimum şampiyon seçimini yap, kazanma şansını artır.</p>
        </button>

        <button 
          onClick={() => onSelect('profile')}
          className="group relative hextech-panel clip-chamfer p-8 md:p-12 text-center transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(200,170,110,0.4)] border-2 border-transparent hover:border-[#c8aa6e] flex flex-col items-center justify-center gap-6"
        >
          <div className="absolute inset-0 bg-[#c8aa6e]/0 group-hover:bg-[#c8aa6e]/10 transition-colors z-0"></div>
          <BarChart2 className="w-20 h-20 text-[#0397ab] group-hover:text-[#c8aa6e] transition-colors relative z-10" />
          <h2 className="text-2xl font-bold text-[#f0e6d2] uppercase tracking-wider relative z-10">Profile Analytics</h2>
          <p className="text-sm text-[#f0e6d2]/70 relative z-10">Oyuncu karneni çıkar, güçlü ve zayıf yönlerini keşfet, oyun stilini yapay zeka ile analiz et.</p>
        </button>
      </div>
    </div>
  );
}

function DraftAssistantModule({ onBack }: { onBack: () => void }) {
  const [result, setResult] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ChampionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [draftState, setDraftState] = useState<DraftState | null>(null);

  const analyzeDraft = async (state: DraftState) => {
    setIsLoading(true);
    setError("");
    
    if (!state.selectedChampion) {
      setResult("");
      setSuggestions([]);
    }
    setDraftState(state);

    try {
      const response = await fetch("/api/analyze-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-riot-api-key": localStorage.getItem("riotApiKey") || "",
          "x-gemini-api-key": localStorage.getItem("geminiApiKey") || "",
        },
        body: JSON.stringify(state),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze draft.");
      }

      if (!state.selectedChampion) {
        try {
          const textResponse = data.result.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(textResponse);
          if (Array.isArray(parsed)) {
            setSuggestions(parsed);
          } else {
            throw new Error("Invalid format");
          }
        } catch (e) {
          console.error("Failed to parse JSON suggestions:", data.result);
          setError("Yapay zeka yanıtı anlaşılamadı. Lütfen tekrar deneyin.");
        }
        setStage(1);
      } else {
        setResult(data.result);
        setStage(2);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setStage(0);
    setResult("");
    setSuggestions([]);
    setDraftState(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={onBack}
          className="text-[#0397ab] hover:text-[#c8aa6e] uppercase tracking-wider text-sm font-bold flex items-center gap-2 transition-colors"
        >
          &larr; Ana Menü
        </button>
        <h2 className="text-2xl font-bold text-[#c8aa6e] uppercase tracking-wider drop-shadow-[0_0_8px_rgba(200,170,110,0.5)]">
          Draft Assistant
        </h2>
      </div>

      {stage === 0 && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <DraftForm onSubmit={analyzeDraft} isLoading={isLoading} />
        </section>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-900/50 border border-red-500 text-red-200 clip-chamfer animate-in fade-in backdrop-blur-sm">
          {error}
        </div>
      )}

      {(stage === 1 || stage === 2) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center hextech-panel clip-chamfer p-4">
            <h2 className="text-xl font-bold text-[#c8aa6e] uppercase tracking-wider">Taktiksel Analiz</h2>
            <button 
              onClick={handleStartOver} 
              className="text-sm font-medium text-[#0397ab] hover:text-[#c8aa6e] transition-colors uppercase flex items-center gap-2"
              disabled={isLoading}
            >
              &larr; Yeni Draft
            </button>
          </div>
          
          {stage === 2 && <DraftResult result={result} />}
          
          {stage === 1 && draftState && suggestions.length > 0 && (
            <div className="hextech-panel clip-chamfer p-6 md:p-8 mt-6">
              <h3 className="text-xl font-bold text-[#c8aa6e] mb-2 uppercase text-center">Şampiyon Seçimi</h3>
              <p className="text-[#f0e6d2]/80 text-base mb-6 text-center">
                Aşağıda önerilen 3 şampiyondan oynamak istediğine tıkla. Rünler, eşyalar ve oynanış taktikleri anında yüklenecek.
              </p>
              <ChampionCardsForm 
                suggestions={suggestions}
                onSelect={(champion) => analyzeDraft({ ...draftState, selectedChampion: champion })}
                isLoading={isLoading} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [riotKey, setRiotKey] = useState(localStorage.getItem("riotApiKey") || "");
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem("geminiApiKey") || "");

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("riotApiKey", riotKey);
    localStorage.setItem("geminiApiKey", geminiKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="hextech-panel p-6 md:p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6 border-b border-[#785a28] pb-4">
          <h2 className="text-xl font-bold text-[#c8aa6e] uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5" /> API Ayarları
          </h2>
          <button onClick={onClose} className="text-[#0397ab] hover:text-[#c8aa6e] transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#0397ab] mb-2 uppercase">Riot API Key</label>
            <input 
              type="password" 
              value={riotKey}
              onChange={(e) => setRiotKey(e.target.value)}
              placeholder="RGAPI-..." 
              className="w-full px-4 py-3 hextech-input"
            />
            <p className="text-xs text-[#f0e6d2]/50 mt-1">Geliştirici portalından aldığınız Riot API anahtarı.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0397ab] mb-2 uppercase">Gemini API Key</label>
            <input 
              type="password" 
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..." 
              className="w-full px-4 py-3 hextech-input"
            />
            <p className="text-xs text-[#f0e6d2]/50 mt-1">Google AI Studio'dan aldığınız Gemini API anahtarı.</p>
          </div>
          <button 
            onClick={handleSave}
            className="w-full mt-4 px-4 py-3 bg-[#0a1428] hover:bg-[#c8aa6e]/20 text-[#c8aa6e] border border-[#c8aa6e] font-bold transition-all uppercase tracking-wider"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentModule, setCurrentModule] = useState<string>('main');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div 
      className="min-h-screen flex flex-col font-sans selection:bg-[#c8aa6e] selection:text-[#0a1428] relative bg-[#0a1428]"
      style={{
        backgroundImage: `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-[#091428]/85 backdrop-blur-[2px] z-0 pointer-events-none"></div>
      
      <div className="relative z-20 flex justify-end p-4">
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#091428]/80 hover:bg-[#c8aa6e]/20 border border-[#785a28] hover:border-[#c8aa6e] text-[#0397ab] hover:text-[#c8aa6e] transition-colors rounded-md font-bold text-sm uppercase"
        >
          <Settings className="w-4 h-4" /> API Ayarları
        </button>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <main className="relative z-10 flex-1 p-4 md:py-8 text-[#f0e6d2]">
        {currentModule === 'main' && <MainMenu onSelect={setCurrentModule} />}
        {currentModule === 'draft' && <DraftAssistantModule onBack={() => setCurrentModule('main')} />}
        {currentModule === 'profile' && <ProfileAnalytics onBack={() => setCurrentModule('main')} />}
      </main>

      <footer className="relative z-10 text-center py-6 border-t border-[#785a28]/50 bg-[#091428]/80 backdrop-blur-md mt-auto">
        <p className="text-xs text-[#0397ab] max-w-4xl mx-auto px-4">
          "Bu proje API kullanılarak geliştirilmiştir ve Riot Games'in resmi bir projesi değildir. Riot Games ile herhangi bir ortaklığı yoktur."
        </p>
      </footer>
    </div>
  );
}
