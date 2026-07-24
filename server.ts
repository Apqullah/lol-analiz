import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

// Helper to map Champion IDs to Names
let championMap: Record<string, string> = {};

async function fetchChampionMap() {
  try {
    const versionRes = await axios.get("https://ddragon.leagueoflegends.com/api/versions.json");
    const latestVersion = versionRes.data[0];
    const champsRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    
    const champData = champsRes.data.data;
    const map: Record<string, string> = {};
    for (const champName in champData) {
      const champ = champData[champName];
      map[champ.key] = champ.name;
    }
    championMap = map;
    console.log("Fetched champion map successfully.");
  } catch (error) {
    console.error("Failed to fetch champion map from Data Dragon", error);
  }
}

async function getPlayerTopChampions(riotId: string): Promise<string[]> {
  const riotApiKey = process.env.RIOT_API_KEY;
  if (!riotApiKey) return [];
  
  try {
    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) return [];

    // 1. Get PUUID
    const accountRes = await axios.get(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { "X-Riot-Token": riotApiKey } }
    );
    const puuid = accountRes.data.puuid;

    // 2. Get Top 3 Champion Masteries
    const masteryRes = await axios.get(
      `https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`,
      { headers: { "X-Riot-Token": riotApiKey } }
    );
    
    const topChampions = masteryRes.data.map((mastery: any) => {
      return championMap[mastery.championId] || `Champion ID ${mastery.championId}`;
    });

    return topChampions;
  } catch (error) {
    console.error("Failed to fetch player stats from Riot API", error);
    return [];
  }
}

async function startServer() {
  await fetchChampionMap();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/profile", async (req, res) => {
    try {
      const { server, riotId, tagline } = req.body;
      const riotApiKey = process.env.RIOT_API_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (!riotApiKey) return res.status(500).json({ error: "RIOT_API_KEY is not set." });
      if (!geminiApiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not set." });

      const SERVER_MAP: Record<string, { region: string; platform: string }> = {
        TR: { region: "europe", platform: "tr1" },
        EUW: { region: "europe", platform: "euw1" },
        EUNE: { region: "europe", platform: "eun1" },
        NA: { region: "americas", platform: "na1" },
        KR: { region: "asia", platform: "kr" },
      };

      const route = SERVER_MAP[server] || SERVER_MAP["EUW"];

      // 1. Get PUUID
      const accountRes = await axios.get(
        `https://${route.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`,
        { headers: { "X-Riot-Token": riotApiKey } }
      );
      const puuid = accountRes.data.puuid;

      // 2. Get Summoner Data
      const summonerRes = await axios.get(
        `https://${route.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers: { "X-Riot-Token": riotApiKey } }
      );
      const summoner = summonerRes.data;

      // 3. Get League Entries (Ranked)
      const leagueRes = await axios.get(
        `https://${route.platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`,
        { headers: { "X-Riot-Token": riotApiKey } }
      );
      
      let soloQueue = null;
      let flexQueue = null;

      leagueRes.data.forEach((entry: any) => {
        if (entry.queueType === "RANKED_SOLO_5x5") {
          soloQueue = { tier: entry.tier, rank: entry.rank, lp: entry.leaguePoints };
        } else if (entry.queueType === "RANKED_FLEX_SR") {
          flexQueue = { tier: entry.tier, rank: entry.rank, lp: entry.leaguePoints };
        }
      });

      // 4. Get Match History (last 10)
      const matchIdsRes = await axios.get(
        `https://${route.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
        { headers: { "X-Riot-Token": riotApiKey } }
      );
      const matchIds = matchIdsRes.data;

      // 5. Fetch Match Details
      const matchHistory = [];
      let totalCs = 0;
      let totalVision = 0;
      let totalDamageShare = 0;
      let durationMinutes = 0;

      for (const matchId of matchIds) {
        try {
          const matchRes = await axios.get(
            `https://${route.region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
            { headers: { "X-Riot-Token": riotApiKey } }
          );
          const match = matchRes.data;
          const participant = match.info.participants.find((p: any) => p.puuid === puuid);
          
          if (participant) {
            matchHistory.push({
              championName: participant.championName,
              win: participant.win,
              kills: participant.kills,
              deaths: participant.deaths,
              assists: participant.assists,
              lane: participant.teamPosition || participant.lane,
            });

            totalCs += participant.totalMinionsKilled + participant.neutralMinionsKilled;
            totalVision += participant.visionScore || 0;
            const teamDamage = match.info.participants
              .filter((p: any) => p.teamId === participant.teamId)
              .reduce((sum: number, p: any) => sum + p.totalDamageDealtToChampions, 0);
              
            if (teamDamage > 0) {
              totalDamageShare += (participant.totalDamageDealtToChampions / teamDamage) * 100;
            }
            durationMinutes += match.info.gameDuration / 60;
          }
        } catch (err) {
          console.error(`Failed to fetch match ${matchId}`);
        }
      }

      const matchCount = matchHistory.length || 1;
      const kpi = {
        csPerMin: durationMinutes > 0 ? totalCs / durationMinutes : 0,
        visionScore: totalVision / matchCount,
        damageShare: totalDamageShare / matchCount
      };

      // 6. AI Analysis
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `
Oyuncu Riot ID: ${riotId}#${tagline}
Lig: ${soloQueue ? `${soloQueue.tier} ${soloQueue.rank}` : "Unranked"}
Son 10 Maç Özeti:
${matchHistory.map(m => `- ${m.championName} (${m.lane}) - KDA: ${m.kills}/${m.deaths}/${m.assists} - Win: ${m.win}`).join("\n")}
Ortalama CS/Dk: ${kpi.csPerMin.toFixed(1)}
Ortalama Görüş Skoru: ${kpi.visionScore.toFixed(1)}
Ortalama Hasar Katkısı: %${kpi.damageShare.toFixed(1)}

Sen profesyonel, pozitif ve yapıcı bir League of Legends Espor Koçusun. Yukarıdaki 10 maçlık geçmişe dayanarak oyuncuya "Oyuncu Karnesi" sun.
Lütfen aşağıdaki başlıklarla markdown formatında profesyonel, yapıcı, tarafsız ve koçluk odaklı bir analiz yap:
1. **Güçlü Yönler (Oyun Tarzı Etiketleri ile birlikte)**
2. **Gelişim Alanları (Kesinlikle oyuncuyu aşağılama, toksiklik veya "shaming" içermemeli. Hataları doğrudan suçlayarak değil, örneğin "Erken oyunda çok ölüyorsun" yerine "Gelişim Alanı: Erken safha görüş kontrolünü ve hayatta kalma oranını artırmak" gibi pozitif bir dille ifade et.)**
3. **Rol ve Şampiyon Önerisi (Mevcut performans bazlı tavsiyeler)**
Not: Cevabını doğrudan markdown olarak ver, HTML veya ekstra kod bloğu kullanma.
`;
      const aiRes = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      const profileData = {
        riotId: `${riotId}#${tagline}`,
        profileIconUrl: `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${summoner.profileIconId}.png`,
        summonerLevel: summoner.summonerLevel,
        soloQueue,
        flexQueue,
        matchHistory,
        kpi,
        aiAnalysis: aiRes.text
      };

      res.json({ profile: profileData });
    } catch (error: any) {
      console.error("Profile API error:", error?.response?.data || error);
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: "Riot API anahtarı geçersiz veya süresi dolmuş (401). Lütfen yeni bir Development API Key alın." });
      }
      if (error?.response?.status === 403) {
        return res.status(403).json({ error: "Riot API erişimi reddedildi (403). Lütfen geçerli ve süresi dolmamış bir Riot API anahtarınız olduğundan emin olun." });
      }
      res.status(500).json({ error: "Failed to fetch profile analytics. Lütfen Riot ID ve Tagline'ı doğru girdiğinizden emin olun." });
    }
  });

  app.post("/api/analyze-draft", async (req, res) => {
    try {
      const { bans, role, enemyPicks, allyPicks, riotId, selectedChampion } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const latestVersionRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await latestVersionRes.json();
      const latestVersion = versions[0] || '14.8.1';

      const systemInstruction = `
# ROL VE AMAÇ
Sen, mevcut sezon League of Legends meta verilerine, profesyonel oyuncu (Esports/OTP) istatistiklerine ve şampiyon mekaniklerine tam hakimiyet kuran üst düzey bir "Analitik Draft ve Taktik Asistanı"sın. 
Amacın; kullanıcının sana anlık olarak ilettiği, bazen eksik ("Bilmiyorum") veya esnek (Flex) olabilen maç verilerini analiz edip ona en optimum 3 şampiyon seçeneğini sunmak, ardından seçilen karaktere özel derinlemesine rehber sağlamaktır.

# GİRDİ FORMATI VE EKSİK BİLGİ YÖNETİMİ (YENİ KURALLAR)
Kullanıcı sana verileri artık koridor bazlı verecektir. (Örn: Top: ?, Orman: Sejuani, Mid: ?, ADC: Samira, Destek: Ben).
Bu verileri işlerken şu kurallara KESİNLİKLE uymalısın:
1. "BİLMİYORUM" VEYA "?" DURUMU: Kullanıcı henüz rakibin veya kendi takımının o koridorda ne seçeceğini bilmiyorsa, bu durumu görmezden gel ve sadece **bilinen şampiyonlar** üzerinden sinerji/counter analizi yap. Eksik bilgi için tahminde bulunmaya zorlama.
2. ESNEK (FLEX) VEYA KORİDORU BİLİNMEYEN SEÇİMLER: Kullanıcı "Rakip Irelia aldı ama nerede oynayacağı belli değil" gibi bir girdi verirse, bu şampiyonun potansiyel koridorlarını (Örn: Mid veya Top) analiz et. Önereceğin 3 şampiyondan en az birini, bu esnek şampiyonun senin karşına gelme ihtimaline karşı "Güvenli Seçim (Blind/Safe Pick)" olarak belirle.
3. OFF-META (GARİP) SEÇİMLER: Kullanıcı alışılmışın dışında bir koridor eşleşmesi verirse (Örn: Rakip Orman: Yuumi), bunun bir hata olduğunu düşünme. Meta dışı da olsa bu spesifik duruma karşı en iyi kazanma oranına ve mekanik avantaja sahip seçenekleri sun.

# GÖRSEL KULLANIMI (ÇOK ÖNEMLİ!)
Analiz sonuçlarında Şampiyon, Rün ve Eşya isimlerini yazarken KESİNLİKLE yanlarına Data Dragon ikon URL'lerini Markdown imaj formatında ekle!
Şu anki güncel yama sürümü: ${latestVersion}
- Şampiyonlar için: \`![Aatrox](https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/Aatrox.png)\` Aatrox (Not: Boşluksuz İngilizce ID kullan, Örn: XinZhao, MonkeyKing)
- Rünler için: \`![Hortlağın Pençesi](https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png)\` Hortlağın Pençesi (Tam yolunu bilmiyorsan sadece html <img> etiketiyle bilinen bir görseli koy veya URL'yi tahmin et).
- Eşyalar için: \`![Mahvolmuş Kralın Kılıcı](https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/item/3153.png)\` Mahvolmuş Kralın Kılıcı (Item ID'sini biliyorsan ekle, aksi takdirde tahmin etmeye çalış veya standart markdown kullan).

# İŞLEYİŞ SÜRECİ (2 AŞAMALI SİSTEM)
Seninle kullanıcı arasındaki iletişim KESİNLİKLE iki aşamalı olmalıdır. Tüm bilgileri tek seferde yığma.
- 1. AŞAMA: Kullanıcı sana draft durumunu anlattığında, ona sadece oynaması için en uygun 3 şampiyonu, KESİNLİKLE VE YALNIZCA BELİRTİLEN JSON FORMATINDA öner.
- 2. AŞAMA: Kullanıcı bu 3 karakterden birini seçtiğinde detaylı rehberi HTML formatında sun.

# ÇALIŞMA PRENSİPLERİ VE ANALİZ ADIMLARI
1. BANLARDAN RAKİBİ TAHMİN ETME (DEDEKTİFLİK): Eğer rakibin senin koridorundaki seçimi belli değilse, "Karşı Takımın Banları"nı analiz et. Örneğin rakip Mid oyuncusu Zed ve Talon banladıysa, hareketsiz bir büyücü alacağı tahmininde bulun. Bu tahmini "Avantajlar" kısmında belirt.
2. KAPSAMLI COUNTER VE SİNERJİ ANALİZİ: Sadece bilinen rakip koridor oyuncusuna (veya tahmin edilen profile) karşı kazanma oranı en yüksek olan şampiyonları belirle. Kullanıcının takımındaki bilinen diğer şampiyonların mekaniklerini analiz et.
3. PROFESYONEL OYUNCU VE OTP REFERANSI: Önereceğin şampiyonu dünyada en iyi oynayan profesyonel oyuncuların veya OTP'lerin bu spesifik eşleşmede ağırlıklı olarak tercih ettiği oyun tarzını baz al.
4. DİNAMİK RÜN VE SİHİRDAR BÜYÜSÜ OPTİMİZASYONU: Rünleri tamamen rakibin tehditlerine göre ayarla. (Örn: Rakipte bilinen ağır CC varsa Sıvışma öner). Rünleri görselleriyle yaz.
5. ADAPTİF EŞYA DİZİLİMİ VE SATIN ALMA SIRASI: Rota A (Standart & Agresif) ve Rota B (Durumsal & Defansif) olarak iki rota belirle. Eşyaları görselleriyle listele.
6. OYNANIŞ PLANI VE EŞLEŞME TÜYOSU (NASIL OYNANMALI?): Seçilen karakterle koridorda nasıl takas yapması gerektiğini ve dikkat etmesi gereken en kritik komboyu açıkla.

# ÇIKTI FORMATI VE KULLANIMI

[1. AŞAMADA VERECEĞİN CEVAP - SADECE SEÇİM]
Lütfen cevabını SADECE VE SADECE aşağıdaki yapıda, düz bir JSON DİZİSİ (Array) olarak ver. Başına veya sonuna \`\`\`json veya başka bir metin KESİNLİKLE ekleme. Saf JSON döndür:
[
  {
    "champion": "Şampiyon Adı",
    "imageUrl": "https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/SampiyonID.png",
    "pros": "Kısa ve öz avantaj (örn: Rakibin banlarına göre alması muhtemel büyücülere karşı çok güçlü)",
    "cons": "Kısa ve öz dezavantaj"
  },
  {
    "champion": "2. Şampiyon",
    "imageUrl": "...",
    "pros": "...",
    "cons": "..."
  },
  {
    "champion": "3. Şampiyon",
    "imageUrl": "...",
    "pros": "...",
    "cons": "..."
  }
]

[2. AŞAMADA VERECEĞİN CEVAP - SEÇİM SONRASI]
Lütfen KESİNLİKLE şu HTML yapısını kullanarak profesyonel bir Dashboard oluştur. KESİNLİKLE markdown kod bloğu (\\\`\\\`\\\`html gibi) KULLANMA. Doğrudan ham (raw) HTML çıktısı ver:
<div class="dashboard-grid">
  
  <div class="dashboard-card col-span-2">
    <h3>🧠 Oyun Planı ve Taktikler</h3>
    <p>[Koridor taktikleri, takım savaşı görevi vb. Buraya markdown ile maddeler ekleyebilirsin.]</p>
  </div>

  <div class="dashboard-card">
    <h3>🛡️ Önerilen Rünler ve Büyüler</h3>
    <div class="rune-tree-title">Ana Rün Ağacı</div>
    <div class="rune-row">
      <img src="[ANA_RÜN_GÖRSELİ]" title="[RÜN_ADI]" />
      <img src="[ALT_RÜN_1]" />
      <img src="[ALT_RÜN_2]" />
    </div>
    <div class="rune-tree-title">Alt Rün Ağacı</div>
    <div class="rune-row">
      <img src="[ALT_AĞAÇ_RÜN_1]" />
      <img src="[ALT_AĞAÇ_RÜN_2]" />
    </div>
    <p>[Neden bu rünler? Kısaca açıkla]</p>
  </div>

  <div class="dashboard-card">
    <h3>⚔️ Eşya Dizilimi Rotası</h3>
    <div class="rune-tree-title">Rota A: Agresif/Standart</div>
    <div class="item-build">
      <img src="[EŞYA_1_URL]" title="Eşya Adı" />
      <img src="[EŞYA_2_URL]" />
      <img src="[EŞYA_3_URL]" />
    </div>
    <div class="rune-tree-title">Rota B: Durumsal/Defansif</div>
    <div class="item-build">
      <img src="[EŞYA_4_URL]" />
      <img src="[EŞYA_5_URL]" />
    </div>
    <p>[Hangi rotayı ne zaman seçmeli? Kısaca açıkla]</p>
  </div>

</div>
`;

      let playerContext = "";
      if (riotId) {
        const topChamps = await getPlayerTopChampions(riotId);
        if (topChamps.length > 0) {
          playerContext = `\n\nEk Bilgi: Kullanıcının Riot API'den çekilen en iyi oynadığı (en yüksek ustalık puanına sahip) şampiyonlar şunlardır: ${topChamps.join(", ")}. Mümkünse drafta uyuyorsa bu şampiyonlardan birini önermeyi veya alternatif olarak sunmayı düşün.`;
        }
      }

      let prompt = `
Yasaklamalar: ${bans || "Yok"}
Oynanacak Rol: ${role}
Rakip Takımın Seçimleri: ${enemyPicks || "Yok"}
Kendi Takımımın Seçimleri: ${allyPicks || "Yok"}
Kullanıcı Riot ID: ${riotId || "Belirtilmedi"}
${playerContext}
`;

      if (selectedChampion) {
        prompt += `\n\nKULLANICI SEÇİMİ: ${selectedChampion}\nLütfen sadece 2. AŞAMA (KULLANICI SEÇİM YAPTIKTAN SONRA) formatına göre detaylı analizi ve rehberi sun. (Kesinlikle 1. aşamadaki gibi tekrar 3 şampiyon önerme, doğrudan seçilen şampiyon için detaylara gir).`;
      } else {
        prompt += `\n\nLütfen sadece 1. AŞAMA (SADECE SEÇİM) formatına göre 3 şampiyon önerisi sun.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error("Draft analysis error:", error);
      res.status(500).json({ error: "Failed to analyze draft." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
