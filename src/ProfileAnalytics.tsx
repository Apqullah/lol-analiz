import React, { useState } from "react";
import { Search, Trophy, TrendingUp, AlertTriangle, ChevronLeft, BrainCircuit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

const SERVERS = ["TR", "EUW", "EUNE", "NA", "KR"];

interface MatchStats {
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lane: string;
}

interface ProfileData {
  riotId: string;
  profileIconUrl: string;
  summonerLevel: number;
  soloQueue: { tier: string; rank: string; lp: number } | null;
  flexQueue: { tier: string; rank: string; lp: number } | null;
  matchHistory: MatchStats[];
  kpi: { csPerMin: number; visionScore: number; damageShare: number };
  aiAnalysis: string; // Markdown
}

export function ProfileAnalytics({ onBack }: { onBack: () => void }) {
  const [server, setServer] = useState("TR");
  const [riotId, setRiotId] = useState("");
  const [tagline, setTagline] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riotId || !tagline) return;

    setIsLoading(true);
    setError("");
    setProfile(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server, riotId, tagline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch profile");
      setProfile(data.profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankImage = (tier: string) => {
    const t = tier.toLowerCase();
    // Use an external source or fallback for rank icons
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${t}.png`;
  };

  const renderRank = (title: string, data: { tier: string; rank: string; lp: number } | null) => (
    <div className="flex items-center gap-4 #091428 border #785a28 rounded-lg p-4 hextech-glow">
      <img 
        src={data ? getRankImage(data.tier) : getRankImage("unranked")} 
        alt={data ? data.tier : "Unranked"} 
        className="w-16 h-16 object-contain drop-shadow-md"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div>
        <h4 className="#0397ab font-bold text-sm uppercase tracking-wider">{title}</h4>
        <div className="#f0e6d2 font-bold text-lg uppercase">
          {data ? `${data.tier} ${data.rank}` : "UNRANKED"}
        </div>
        {data && <div className="#c8aa6e text-sm">{data.lp} LP</div>}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto #f0e6d2">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="#0397ab hover:#c8aa6e uppercase tracking-wider text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Ana Menü
        </button>
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-500 uppercase tracking-wider drop-shadow-[0_0_8px_rgba(200,170,110,0.5)]">
          Profile Analytics
        </h2>
      </div>

      <form onSubmit={handleSearch} className="hextech-panel p-6 mb-8 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold #0397ab mb-2 uppercase">Sunucu</label>
          <select 
            value={server} 
            onChange={(e) => setServer(e.target.value)}
            className="w-full px-4 py-3 hextech-input"
          >
            {SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-[2] w-full">
          <label className="block text-sm font-bold #0397ab mb-2 uppercase">Riot ID</label>
          <input 
            type="text" 
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            placeholder="Örn: Faker"
            className="w-full px-4 py-3 hextech-input"
            required
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold #0397ab mb-2 uppercase">Tagline</label>
          <div className="flex items-center">
            <span className="px-3 py-3 #091428 border #785a28 border-r-0 #f0e6d2 font-bold rounded-l-md">#</span>
            <input 
              type="text" 
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="KR1"
              className="w-full px-4 py-3 hextech-input border-l-0 rounded-l-none"
              required
            />
          </div>
        </div>
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full md:w-auto px-8 py-3 #0a1428 hover:#c8aa6e text-white font-bold transition-all uppercase tracking-wider rounded-md flex items-center justify-center gap-2 min-w-[160px] shadow-[0_0_15px_rgba(200,170,110,0.5)]"
        >
          {isLoading ? <Search className="w-5 h-5 animate-pulse" /> : <Search className="w-5 h-5" />}
          Analiz Et
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg mb-8 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-8 animate-in fade-in">
          {/* Identity Card */}
          <div className="hextech-panel p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <img 
                src={profile.profileIconUrl} 
                alt="Profile Icon" 
                className="w-24 h-24 rounded-full border-2 #c8aa6e shadow-[0_0_15px_rgba(200,170,110,0.5)]"
              />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 #091428 border #c8aa6e #c8aa6e px-3 py-0.5 text-sm font-bold rounded-full">
                {profile.summonerLevel}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl font-bold #f0e6d2 tracking-wider">{profile.riotId}</h3>
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full md:w-auto">
              {renderRank("Solo / Duo", profile.soloQueue)}
              {renderRank("Flex", profile.flexQueue)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Role Distribution */}
            <div className="hextech-panel p-6">
              <h4 className="text-xl font-bold #c8aa6e mb-6 uppercase border-b #785a28 pb-2">Rol Dağılımı (Son 10 Maç)</h4>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(
                        profile.matchHistory.reduce((acc: any, m) => {
                          const lane = m.lane || "Bilinmiyor";
                          acc[lane] = (acc[lane] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(
                        profile.matchHistory.reduce((acc: any, m) => {
                          const lane = m.lane || "Bilinmiyor";
                          acc[lane] = (acc[lane] || 0) + 1;
                          return acc;
                        }, {})
                      ).map((entry, index) => (
                        <Cell key={`cell-\${index}`} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#3b82f6', color: '#f8fafc', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* KPI Radar */}
            <div className="hextech-panel p-6">
              <h4 className="text-xl font-bold #c8aa6e mb-6 uppercase border-b #785a28 pb-2">Oyun İçi Performans (KPI)</h4>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                    { subject: 'Farm (CS/Min)', A: Math.min(profile.kpi.csPerMin * 10, 100), fullMark: 100 },
                    { subject: 'Görüş Skoru', A: Math.min(profile.kpi.visionScore * 2, 100), fullMark: 100 },
                    { subject: 'Hasar Katkısı (%)', A: Math.min(profile.kpi.damageShare * 3, 100), fullMark: 100 },
                  ]}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#8b5cf6', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="KPI" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-sm mt-4 px-4 font-bold #f0e6d2">
                <div>CS: {profile.kpi.csPerMin.toFixed(1)}/dk</div>
                <div>Görüş: {profile.kpi.visionScore.toFixed(1)}</div>
                <div>Hasar: {profile.kpi.damageShare.toFixed(1)}%</div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="hextech-panel p-6 flex flex-col md:col-span-2">
              <h4 className="text-xl font-bold #c8aa6e mb-4 uppercase border-b #785a28 pb-2 flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 #0397ab" /> Yapay Zeka Koçluk Analizi
              </h4>
              <div className="flex-1 overflow-auto markdown-body text-sm #091428/50 p-4 rounded-lg border border-slate-800">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{profile.aiAnalysis}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
