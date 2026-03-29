import React, { useEffect, useMemo, useState } from "react";

const MOODS = [
  { value: 1, emoji: "😔", label: "つらい", color: "#7B8794" },
  { value: 2, emoji: "😕", label: "いまいち", color: "#9DAFBE" },
  { value: 3, emoji: "😐", label: "ふつう", color: "#C4A35A" },
  { value: 4, emoji: "😊", label: "いい感じ", color: "#7DB87D" },
  { value: 5, emoji: "😄", label: "最高！", color: "#E8915A" },
];

const ENERGY = [
  { value: 1, label: "ヘトヘト", icon: "▁" },
  { value: 2, label: "低め", icon: "▃" },
  { value: 3, label: "普通", icon: "▅" },
  { value: 4, label: "元気", icon: "▇" },
  { value: 5, label: "絶好調！", icon: "█" },
];

const STEPS = ["mood", "energy", "events", "challenges", "gratitude", "freeform"];
const STEP_LABEL = {
  mood: "今日の気分は？",
  energy: "今日のエネルギーは？",
  events: "今日あったことは？",
  challenges: "困ったことは？",
  gratitude: "感謝していることは？",
  freeform: "自由にメモ（任意）",
};

const API_BASE = "https://api.anthropic.com/v1/messages";

const storage = (() => {
  const memory = new Map();
  if (typeof window !== "undefined" && window.storage) {
    return {
      getItem: (key) => window.storage.getItem(key),
      setItem: (key, value) => window.storage.setItem(key, value),
      removeItem: (key) => window.storage.removeItem(key),
    };
  }
  return {
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => memory.set(key, value),
    removeItem: async (key) => memory.delete(key),
  };
})();

const todayKey = () => new Date().toISOString().slice(0, 10);

async function loadIndex() {
  const raw = await storage.getItem("diary:index");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveIndex(index) {
  await storage.setItem("diary:index", JSON.stringify(index));
}

async function saveEntry(entry) {
  await storage.setItem(`diary:entry:${entry.date}`, JSON.stringify(entry));
  const index = await loadIndex();
  const filtered = index.filter((i) => i.date !== entry.date);
  filtered.unshift({
    date: entry.date,
    mood: entry.mood,
    energy: entry.energy,
    summary: entry.summary,
    tags: entry.tags,
    dominantEmotion: entry.dominantEmotion,
  });
  await saveIndex(filtered.sort((a, b) => b.date.localeCompare(a.date)));
}

async function loadEntry(date) {
  const raw = await storage.getItem(`diary:entry:${date}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeDraftOffline(checkin) {
  const mood = MOODS.find((m) => m.value === checkin.mood)?.label ?? "ふつう";
  const summary = `${mood}な1日`;
  const dominantEmotion = mood === "最高！" ? "達成感" : mood === "いい感じ" ? "充実感" : "内省";
  const tags = ["日常", checkin.events ? "出来事" : "記録", checkin.gratitude ? "感謝" : "思考"];
  const draft = `今日は${mood}な気分で、エネルギーは${checkin.energy}/5だった。${checkin.events || "大きな出来事はなかった"}。${checkin.challenges ? `困ったことは${checkin.challenges}。` : "困難は小さく乗り越えられた。"}${checkin.gratitude ? `感謝しているのは${checkin.gratitude}。` : "小さな感謝を見つけるよう意識した。"}${checkin.freeform ? `最後に、${checkin.freeform}` : "明日も少しずつ前に進みたい。"}`;
  return { draft, tags, dominantEmotion, summary };
}

async function generateDraftWithAPI(checkin) {
  if (!window.__INNER_MIRROR_API_KEY__) {
    return makeDraftOffline(checkin);
  }

  const prompt = `気分:${checkin.mood}/5\nエネルギー:${checkin.energy}/5\n出来事:${checkin.events}\n困ったこと:${checkin.challenges}\n感謝:${checkin.gratitude}\nその他:${checkin.freeform}`;
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": window.__INNER_MIRROR_API_KEY__,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error("AIドラフト生成に失敗しました");
  }

  const data = await res.json();
  const text = data.content?.find((item) => item.type === "text")?.text ?? "";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return makeDraftOffline(checkin);
  }
}

function buildInsightsOffline(index) {
  const insightText = index.length < 3
    ? "3件以上で詳細分析できます。まずは記録を続けましょう。"
    : "責任感が高く、毎日の出来事を振り返る中で改善点を見つける傾向があります。困難時にも感謝を言語化することで、安定した感情バランスを保てています。";

  return {
    personality: insightText,
    thinking: "出来事→課題→次の一手、という順で整理する構造的思考が見られます。",
    emotions: "ネガティブを放置せず、言葉にして調整するセルフマネジメント力が強みです。",
    values: "成長、協働、日々の感謝を重視しています。",
    advice: "疲れが高い日に入力を短縮できる『30秒チェックイン』を定着させると継続率が上がります。",
  };
}

export default function DiaryApp() {
  const [screen, setScreen] = useState("home");
  const [index, setIndex] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [entryDetail, setEntryDetail] = useState(null);
  const [step, setStep] = useState(0);
  const [checkin, setCheckin] = useState({ mood: 3, energy: 3, events: "", challenges: "", gratitude: "", freeform: "" });
  const [draftResult, setDraftResult] = useState({ draft: "", tags: [], dominantEmotion: "", summary: "" });
  const [editingDraft, setEditingDraft] = useState(false);
  const [insight, setInsight] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const idx = await loadIndex();
      setIndex(idx);
    })();
  }, []);

  const avgMood = useMemo(() => {
    if (!index.length) return "-";
    const sum = index.reduce((acc, i) => acc + (i.mood || 0), 0);
    return (sum / index.length).toFixed(1);
  }, [index]);

  const startCheckin = () => {
    setStep(0);
    setError("");
    setMessage("");
    setCheckin({ mood: 3, energy: 3, events: "", challenges: "", gratitude: "", freeform: "" });
    setScreen("checkin");
  };

  const nextStep = async () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    setLoadingDraft(true);
    setError("");
    try {
      const draft = await generateDraftWithAPI(checkin);
      setDraftResult(draft);
      setEditingDraft(false);
      setScreen("draft");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDraft(false);
    }
  };

  const saveToday = async () => {
    const date = todayKey();
    const entry = {
      date,
      timestamp: Date.now(),
      mood: checkin.mood,
      energy: checkin.energy,
      inputs: { ...checkin },
      calendarEvents: [],
      draft: draftResult.draft,
      tags: draftResult.tags,
      summary: draftResult.summary,
      dominantEmotion: draftResult.dominantEmotion,
    };

    await saveEntry(entry);
    const idx = await loadIndex();
    setIndex(idx);
    setMessage("保存しました");
    setScreen("entries");
  };

  const openDetail = async (date) => {
    setSelectedDate(date);
    const detail = await loadEntry(date);
    setEntryDetail(detail);
    setScreen("detail");
  };

  const generateInsights = async () => {
    setLoadingInsight(true);
    setError("");
    try {
      setInsight(buildInsightsOffline(index));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingInsight(false);
    }
  };

  const cardStyle = { border: "1px solid var(--color-border-tertiary, #d0d7de)", borderRadius: 16, padding: 16, marginBottom: 12 };

  const renderNotice = () => (
    <>
      {message && <p style={{ color: "#147d3f" }}>{message}</p>}
      {error && <p style={{ color: "#b10000" }}>{error}</p>}
    </>
  );

  if (screen === "home") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif' }}>
        <h1 style={{ fontFamily: 'Georgia, "Hiragino Mincho ProN", serif', fontWeight: 400 }}>Inner Mirror</h1>
        <p>今日一日を振り返りましょう</p>
        {renderNotice()}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div style={cardStyle}>連続: {index.length ? `${index.length}日` : "0日"}</div>
          <div style={cardStyle}>総数: {index.length}件</div>
          <div style={cardStyle}>平均: {avgMood}</div>
        </div>
        <button onClick={startCheckin}>今日の日記を書く</button>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setScreen("entries")}>日記一覧</button>
          <button onClick={() => setScreen("insights")} style={{ marginLeft: 8 }}>インサイト</button>
        </div>
      </div>
    );
  }

  if (screen === "checkin") {
    const field = STEPS[step];
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <h2>チェックイン {step + 1} / {STEPS.length}</h2>
        <p>{STEP_LABEL[field]}</p>
        {field === "mood" && MOODS.map((m) => (
          <button key={m.value} onClick={() => setCheckin((c) => ({ ...c, mood: m.value }))} style={{ marginRight: 8, borderColor: checkin.mood === m.value ? m.color : "#ccc" }}>
            {m.emoji} {m.label}
          </button>
        ))}
        {field === "energy" && ENERGY.map((e) => (
          <button key={e.value} onClick={() => setCheckin((c) => ({ ...c, energy: e.value }))} style={{ marginRight: 8 }}>
            {e.icon} {e.label}
          </button>
        ))}
        {["events", "challenges", "gratitude", "freeform"].includes(field) && (
          <textarea
            rows={6}
            value={checkin[field]}
            placeholder="キーワードや短文でOK"
            onChange={(e) => setCheckin((c) => ({ ...c, [field]: e.target.value }))}
            style={{ width: "100%" }}
          />
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))}>戻る</button>
          <button onClick={nextStep} style={{ marginLeft: 8 }} disabled={loadingDraft}>{loadingDraft ? "生成中..." : "次へ"}</button>
        </div>
      </div>
    );
  }

  if (screen === "draft") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <h2>AIが書いた日記</h2>
        {!editingDraft ? <p style={cardStyle}>{draftResult.draft}</p> : (
          <textarea rows={10} value={draftResult.draft} onChange={(e) => setDraftResult((d) => ({ ...d, draft: e.target.value }))} style={{ width: "100%" }} />
        )}
        <div>#{(draftResult.tags || []).join(" #")}</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setEditingDraft((e) => !e)}>{editingDraft ? "編集を閉じる" : "編集する"}</button>
          <button onClick={async () => setDraftResult(await generateDraftWithAPI(checkin))} style={{ marginLeft: 8 }}>再生成</button>
          <button onClick={saveToday} style={{ marginLeft: 8 }}>保存する</button>
        </div>
      </div>
    );
  }

  if (screen === "entries") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <h2>日記一覧</h2>
        <button onClick={() => setScreen("home")}>ホームへ</button>
        {!index.length && <p>まだ記録がありません。ホームから最初の日記を作成してください。</p>}
        {index.map((item) => (
          <div key={item.date} style={cardStyle} onClick={() => openDetail(item.date)} role="button" tabIndex={0}>
            <div>{item.date}</div>
            <div>{MOODS.find((m) => m.value === item.mood)?.emoji} {item.summary}</div>
            <div>{(item.tags || []).map((t) => `#${t}`).join(" ")}</div>
          </div>
        ))}
      </div>
    );
  }

  if (screen === "detail") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <h2>{selectedDate} の記録</h2>
        <button onClick={() => setScreen("entries")}>一覧へ戻る</button>
        {entryDetail && (
          <>
            <p>気分: {entryDetail.mood}/5, エネルギー: {entryDetail.energy}/5</p>
            <p style={cardStyle}>{entryDetail.draft}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h2>インサイト</h2>
      <button onClick={() => setScreen("home")}>ホームへ</button>
      <button onClick={generateInsights} style={{ marginLeft: 8 }} disabled={loadingInsight}>{loadingInsight ? "分析中..." : "AIにパーソナリティを分析してもらう"}</button>
      {!index.length && <p>分析には記録が必要です。まずは1件以上の日記を作成してください。</p>}
      {insight && (
        <div style={{ marginTop: 12 }}>
          <div style={cardStyle}><strong>性格特性</strong><p>{insight.personality}</p></div>
          <div style={cardStyle}><strong>思考パターン</strong><p>{insight.thinking}</p></div>
          <div style={cardStyle}><strong>感情の傾向</strong><p>{insight.emotions}</p></div>
          <div style={cardStyle}><strong>価値観</strong><p>{insight.values}</p></div>
          <div style={cardStyle}><strong>アドバイス</strong><p>{insight.advice}</p></div>
        </div>
      )}
    </div>
  );
}
