import { AlertCircle, BrainCircuit, Swords, Shield, Coins, Sparkles, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import React, { useState, useEffect, useRef } from "react";

import rehypeRaw from "rehype-raw";

export type Role = "Top" | "Jungle" | "Mid" | "ADC" | "Support" | "";

export interface DraftState {
  allyBans: string;
  enemyBans: string;
  role: Role | "";
  enemyPicks: string;
  allyPicks: string;
  riotId?: string;
  selectedChampion?: string;
}

export interface ChampionData {
  id: string;
  name: string;
}

export interface ChampionSuggestion {
  champion: string;
  imageUrl: string;
  pros: string;
  cons: string;
}

const ROLES: Role[] = ["Top", "Jungle", "Mid", "ADC", "Support"];

const ROLE_ICONS: Record<Role, string> = {
  "Top": "https://s-lol-web.op.gg/images/icon/icon-position-top.svg",
  "Jungle": "https://s-lol-web.op.gg/images/icon/icon-position-jungle.svg",
  "Mid": "https://s-lol-web.op.gg/images/icon/icon-position-mid.svg",
  "ADC": "https://s-lol-web.op.gg/images/icon/icon-position-adc.svg",
  "Support": "https://s-lol-web.op.gg/images/icon/icon-position-support.svg",
  "": ""
};

function AutocompleteInput({ 
  value, 
  onChange, 
  options, 
  version,
  placeholder, 
  disabled 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  options: ChampionData[]; 
  version: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<ChampionData[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val) {
      setFilteredOptions(options.filter(o => o.name.toLowerCase().includes(val.toLowerCase())));
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const selectedChamp = options.find(o => o.name === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className={`flex items-center hextech-input clip-chamfer px-3 py-1.5 transition-all ${disabled ? 'opacity-50 grayscale' : ''}`}>
        {selectedChamp && version && (
          <img 
            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${selectedChamp.id}.png`} 
            alt={selectedChamp.name} 
            className="w-6 h-6 mr-2 border border-[#785a28]" 
          />
        )}
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (value) setIsOpen(true); else { setFilteredOptions(options); setIsOpen(true); } }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent outline-none text-[#f0e6d2] placeholder:text-[#c8aa6e]/50 text-sm"
        />
      </div>
      {isOpen && filteredOptions.length > 0 && !disabled && (
        <ul className="absolute z-[9999] w-full mt-1 bg-[#091428] border border-[#785a28] shadow-lg max-h-48 overflow-y-auto hextech-text left-0 top-full">
          {filteredOptions.map(opt => (
            <li 
              key={opt.id}
              className="px-3 py-2 hover:bg-[#c8aa6e]/20 cursor-pointer text-sm flex items-center transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.name);
                setIsOpen(false);
              }}
            >
              {version && (
                <img 
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${opt.id}.png`} 
                  alt={opt.name} 
                  className="w-6 h-6 mr-3 border border-[#785a28]" 
                />
              )}
              {opt.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DraftForm({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (state: DraftState) => void;
  isLoading: boolean;
}) {
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [version, setVersion] = useState<string>("");
  
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        setVersion(versions[0]);
        fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`)
          .then(res => res.json())
          .then(data => {
            const champsArray = Object.values(data.data).map((c: any) => ({
              id: c.id,
              name: c.name
            })).sort((a, b) => a.name.localeCompare(b.name));
            setChampions(champsArray);
          });
      });
  }, []);

  const [allyBans, setAllyBans] = useState<string[]>([]);
  const [enemyBans, setEnemyBans] = useState<string[]>([]);
  const [allyBanInput, setAllyBanInput] = useState("");
  const [enemyBanInput, setEnemyBanInput] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [riotId, setRiotId] = useState("");

  const addAllyBan = () => {
    if (allyBanInput && !allyBans.includes(allyBanInput)) {
      setAllyBans([...allyBans, allyBanInput]);
    }
    setAllyBanInput("");
  };

  const addEnemyBan = () => {
    if (enemyBanInput && !enemyBans.includes(enemyBanInput)) {
      setEnemyBans([...enemyBans, enemyBanInput]);
    }
    setEnemyBanInput("");
  };

  type TeamState = Record<string, { champion: string; isTbd: boolean }>;
  
  const [allyTeam, setAllyTeam] = useState<TeamState>({
    Top: { champion: "", isTbd: false },
    Jungle: { champion: "", isTbd: false },
    Mid: { champion: "", isTbd: false },
    ADC: { champion: "", isTbd: false },
    Support: { champion: "", isTbd: false },
  });

  const [enemyTeam, setEnemyTeam] = useState<TeamState>({
    Top: { champion: "", isTbd: false },
    Jungle: { champion: "", isTbd: false },
    Mid: { champion: "", isTbd: false },
    ADC: { champion: "", isTbd: false },
    Support: { champion: "", isTbd: false },
  });

  const [flexInput, setFlexInput] = useState("");
  const [flexPicks, setFlexPicks] = useState<string[]>([]);

  const addFlexPick = () => {
    if (flexInput && !flexPicks.includes(flexInput)) {
      setFlexPicks([...flexPicks, flexInput]);
    }
    setFlexInput("");
  };

  const usedChampions = [
    ...allyBans,
    ...enemyBans,
    ...Object.values(allyTeam).map(t => t.champion).filter(Boolean),
    ...Object.values(enemyTeam).map(t => t.champion).filter(Boolean),
    ...flexPicks
  ];

  const availableChampions = champions.filter(c => !usedChampions.includes(c.name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      alert("Lütfen Bizim Takım'dan kendi oynayacağınız rolü seçin.");
      return;
    }

    const formatTeam = (team: TeamState, isAlly: boolean) => {
      return ROLES.map(r => {
        if (isAlly && role === r) {
          return `${r}: ? (Ben - Şampiyon Önerisi Bekliyor)`;
        }
        return `${r}: ${team[r].isTbd ? "?" : (team[r].champion || "?")}`;
      }).join(", ");
    };

    const allyPicksStr = formatTeam(allyTeam, true);
    const enemyPicksStr = formatTeam(enemyTeam, false) + (flexPicks.length > 0 ? ` | Flex Seçimler: ${flexPicks.join(", ")}` : "");

    onSubmit({ 
      allyBans: allyBans.join(", "),
      enemyBans: enemyBans.join(", "),
      role, 
      enemyPicks: enemyPicksStr, 
      allyPicks: allyPicksStr, 
      riotId 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Top Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-50">
        
        {/* Blue Side Bans */}
        <div className="hextech-panel p-4" style={{ zIndex: 2 }}>
          <label className="block text-sm font-bold text-[#0397ab] mb-2 uppercase tracking-wider">Bizim Takımın Banları (Mavi)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <AutocompleteInput
                value={allyBanInput}
                onChange={setAllyBanInput}
                options={availableChampions}
                version={version}
                placeholder="Şampiyon ara..."
              />
            </div>
            <button 
              type="button" 
              onClick={addAllyBan}
              className="px-4 py-2 bg-[#091428] border border-[#c8aa6e] text-[#c8aa6e] hover:bg-[#c8aa6e]/20 font-medium clip-chamfer transition-colors text-sm"
            >
              Ekle
            </button>
          </div>
          {allyBans.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {allyBans.map(c => {
                const champObj = champions.find(champ => champ.name === c);
                return (
                  <span key={c} className="pr-2 bg-[#091428] border border-[#0397ab]/50 shadow-sm rounded-sm text-xs font-medium flex items-center gap-1 text-[#f0e6d2]">
                    {champObj && version && (
                      <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champObj.id}.png`} alt={c} className="w-5 h-5 grayscale" />
                    )}
                    <span className="pl-1">{c}</span>
                    <button 
                      type="button" 
                      onClick={() => setAllyBans(allyBans.filter(b => b !== c))} 
                      className="text-[#0397ab] hover:text-[#f0e6d2] ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Red Side Bans */}
        <div className="hextech-panel p-4" style={{ zIndex: 1 }}>
          <label className="block text-sm font-bold text-red-500 mb-2 uppercase tracking-wider drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]">Karşı Takımın Banları (Kırmızı)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <AutocompleteInput
                value={enemyBanInput}
                onChange={setEnemyBanInput}
                options={availableChampions}
                version={version}
                placeholder="Şampiyon ara..."
              />
            </div>
            <button 
              type="button" 
              onClick={addEnemyBan}
              className="px-4 py-2 bg-[#091428] border border-[#c8aa6e] text-[#c8aa6e] hover:bg-[#c8aa6e]/20 font-medium clip-chamfer transition-colors text-sm"
            >
              Ekle
            </button>
          </div>
          {enemyBans.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {enemyBans.map(c => {
                const champObj = champions.find(champ => champ.name === c);
                return (
                  <span key={c} className="pr-2 bg-[#091428] border border-red-500/50 shadow-sm rounded-sm text-xs font-medium flex items-center gap-1 text-[#f0e6d2]">
                    {champObj && version && (
                      <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champObj.id}.png`} alt={c} className="w-5 h-5 grayscale" />
                    )}
                    <span className="pl-1">{c}</span>
                    <button 
                      type="button" 
                      onClick={() => setEnemyBans(enemyBans.filter(b => b !== c))} 
                      className="text-red-500 hover:text-[#f0e6d2] ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      <div className="hextech-panel p-4 relative z-40">
        <label className="block text-sm font-medium text-[#c8aa6e] mb-2 uppercase tracking-wider">Riot ID (Opsiyonel)</label>
        <input
          type="text"
          value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            placeholder="Örn: Faker#KR1"
            className="w-full px-3 py-2 hextech-input clip-chamfer transition-all"
          />
          <p className="text-xs text-[#0397ab] mt-2">Belirtilirse en çok oynadığınız şampiyonlar analiz edilir.</p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start relative z-30">
        
        {/* Blue Side / Bizim Takım */}
        <div className="hextech-panel p-4" style={{ zIndex: 2 }}>
          <div className="border-b border-[#785a28] pb-2 mb-4">
            <h3 className="font-bold text-lg text-[#0397ab] uppercase tracking-wider">BİZİM TAKIM (Mavİ)</h3>
          </div>
          
          <div className="space-y-3">
            {ROLES.map((r, i) => (
              <div key={`ally-${r}`} className="flex flex-col sm:flex-row gap-2 sm:items-center p-2 bg-[#091428]/40 border border-[#785a28]/30 hextech-glow relative" style={{ zIndex: 10 - i }}>
                <div className="w-24 flex items-center gap-2">
                  <img src={ROLE_ICONS[r]} alt={r} className="w-8 h-8 object-contain drop-shadow-[0_0_2px_#c8aa6e]" />
                  <span className="text-sm font-semibold text-[#f0e6d2]">{r}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <AutocompleteInput 
                    value={role === r ? "" : allyTeam[r].champion}
                    onChange={(val) => setAllyTeam({...allyTeam, [r]: {...allyTeam[r], champion: val}})}
                    options={availableChampions}
                    version={version}
                    disabled={role === r || allyTeam[r].isTbd}
                    placeholder={role === r ? "Sizin rolünüz" : "Şampiyon..."}
                  />
                </div>

                <div className="flex items-center gap-3 sm:gap-2">
                  <label className={`text-xs font-medium flex items-center gap-1 cursor-pointer px-2 py-1.5 border transition-colors ${role === r ? 'bg-[#c8aa6e]/20 border-[#c8aa6e] text-[#c8aa6e]' : 'bg-[#091428] border-[#785a28] hover:bg-[#c8aa6e]/10 text-[#f0e6d2]'} whitespace-nowrap`}>
                    <input 
                      type="radio" 
                      name="myRole" 
                      checked={role === r} 
                      onChange={() => setRole(r as Role)}
                      className="hidden"
                    />
                    BENİM
                  </label>
                  {role !== r && (
                    <label className={`text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap px-2 py-1.5 border transition-colors ${allyTeam[r].isTbd ? 'bg-[#c8aa6e]/20 border-[#c8aa6e] text-[#c8aa6e]' : 'bg-transparent border-transparent hover:border-[#785a28] text-[#f0e6d2]'}`}>
                      <input 
                        type="checkbox" 
                        checked={allyTeam[r].isTbd}
                        onChange={(e) => setAllyTeam({...allyTeam, [r]: {...allyTeam[r], isTbd: e.target.checked}})}
                        className="hidden"
                      />
                      TBD
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Red Side / Karşı Takım */}
        <div className="hextech-panel p-4" style={{ zIndex: 1 }}>
          <div className="border-b border-[#785a28] pb-2 mb-4">
            <h3 className="font-bold text-lg text-red-500 uppercase tracking-wider drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]">KARŞI TAKIM (Kırmızı)</h3>
          </div>
          
          <div className="space-y-3">
            {ROLES.map((r, i) => (
              <div key={`enemy-${r}`} className="flex flex-col sm:flex-row gap-2 sm:items-center p-2 bg-[#091428]/40 border border-[#785a28]/30 hextech-glow relative" style={{ zIndex: 10 - i }}>
                <div className="w-24 flex items-center gap-2">
                  <img src={ROLE_ICONS[r]} alt={r} className="w-8 h-8 object-contain drop-shadow-[0_0_2px_#c8aa6e]" />
                  <span className="text-sm font-semibold text-[#f0e6d2]">{r}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <AutocompleteInput 
                    value={enemyTeam[r].champion}
                    onChange={(val) => setEnemyTeam({...enemyTeam, [r]: {...enemyTeam[r], champion: val}})}
                    options={availableChampions}
                    version={version}
                    disabled={enemyTeam[r].isTbd}
                    placeholder="Şampiyon..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className={`text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap px-2 py-1.5 border transition-colors ${enemyTeam[r].isTbd ? 'bg-[#c8aa6e]/20 border-[#c8aa6e] text-[#c8aa6e]' : 'bg-transparent border-transparent hover:border-[#785a28] text-[#f0e6d2]'}`}>
                    <input 
                      type="checkbox" 
                      checked={enemyTeam[r].isTbd}
                      onChange={(e) => setEnemyTeam({...enemyTeam, [r]: {...enemyTeam[r], isTbd: e.target.checked}})}
                      className="hidden"
                    />
                    TBD
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flex Picks */}
      <div className="hextech-panel p-4 mt-6 relative z-20">
        <h3 className="font-bold text-lg text-[#c8aa6e] mb-1 uppercase tracking-wider">Esnek (Flex) Seçİmler</h3>
        <p className="text-sm text-[#f0e6d2]/70 mb-4">Rakibin seçtiği ancak hangi koridora gideceği belirsiz olan şampiyonları buraya ekleyin.</p>
        
        <div className="flex gap-2 max-w-md">
          <div className="flex-1">
            <AutocompleteInput
              value={flexInput}
              onChange={setFlexInput}
              options={availableChampions}
              version={version}
              placeholder="Örn: Irelia, Yasuo..."
            />
          </div>
          <button 
            type="button" 
            onClick={addFlexPick}
            className="px-4 py-2 bg-[#091428] border border-[#c8aa6e] text-[#c8aa6e] hover:bg-[#c8aa6e]/20 font-medium clip-chamfer transition-colors text-sm"
          >
            Ekle
          </button>
        </div>
        
        {flexPicks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {flexPicks.map(p => {
               const champObj = champions.find(champ => champ.name === p);
               return (
                <span key={p} className="pr-2 bg-[#091428] border border-[#c8aa6e]/50 shadow-sm text-sm font-medium flex items-center gap-1 text-[#f0e6d2]">
                  {champObj && version && (
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champObj.id}.png`} alt={p} className="w-6 h-6 grayscale" />
                  )}
                  <span className="pl-1">{p}</span>
                  <button 
                    type="button" 
                    onClick={() => setFlexPicks(flexPicks.filter(fp => fp !== p))} 
                    className="text-[#c8aa6e] hover:text-white ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="relative z-10">
        <button
          type="submit"
          disabled={isLoading || !role}
          className="w-full bg-[#0a1428] hover:bg-[#0397ab]/20 border-2 border-[#c8aa6e] text-[#c8aa6e] font-bold py-4 px-4 clip-chamfer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg uppercase tracking-wider hextech-glow mt-6"
        >
          {isLoading ? (
            <>
              <BrainCircuit className="w-6 h-6 animate-pulse" />
              Analİz Edİlİyor...
            </>
          ) : (
            <>
              <Send className="w-6 h-6" />
              Taktİksel Analİzİ Başlat
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function DraftResult({ result }: { result: string }) {
  if (!result) return null;

  return (
    <div className="mt-8 hextech-panel overflow-visible">
      <div className="bg-[#091428] border-b border-[#785a28] px-6 py-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#c8aa6e]" />
        <h3 className="font-bold text-[#c8aa6e] uppercase tracking-wider">Taktİksel Analİz Sonucu</h3>
      </div>
      <div className="p-6 md:p-8">
        <div className="markdown-body">
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{result}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function ChampionCardsForm({
  suggestions,
  onSelect,
  isLoading
}: {
  suggestions: ChampionSuggestion[];
  onSelect: (champion: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      {suggestions.map((s, idx) => (
        <div 
          key={idx} 
          onClick={() => !isLoading && onSelect(s.champion)}
          className={`dashboard-card cursor-pointer hextech-glow group relative ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex flex-col items-center mb-4">
            <img 
              src={s.imageUrl} 
              alt={s.champion} 
              className="w-20 h-20 rounded-full border-2 border-[#c8aa6e] mb-3 group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(200,170,110,0.5)]" 
            />
            <h4 className="text-xl font-bold text-[#f0e6d2] uppercase tracking-wider">{s.champion}</h4>
          </div>
          <div className="flex-1 space-y-3 text-sm">
            <div>
              <span className="text-green-400 font-bold block mb-1">Avantajları (Pros):</span>
              <p className="text-[#f0e6d2]/80 leading-snug">{s.pros}</p>
            </div>
            <div>
              <span className="text-red-400 font-bold block mb-1">Dezavantajları (Cons):</span>
              <p className="text-[#f0e6d2]/80 leading-snug">{s.cons}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
