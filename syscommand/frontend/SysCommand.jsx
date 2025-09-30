import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, Server, History as HistoryIcon, TerminalSquare, Trash2, ChevronDown } from "lucide-react";
import { runCommand as apiRunCommand, getOutput as apiGetOutput, getMetrics as apiGetMetrics } from "./api";

const PANEL_HEIGHT = 280;
const HEADER_HEIGHT = 56;

//state tanımları
function useLiveMetrics(selectedAgent, setSelectedAgent) {
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState(0);
  const [host, setHost] = useState("-");
  const [agents, setAgents] = useState([]);
  // Yumuşatma için son değerleri tut (EMA)
  const lastCpuRef = useRef(0);
  const lastRamRef = useRef(0);
//agent listesini apiden çekme ve seçili ajanı ayarlama
  useEffect(() => {
    let mounted = true;
    let timer;
    const tick = async () => {
      try {
        const data = await apiGetMetrics();
        if (!mounted) return;
        const list = Object.entries(data).map(([id, m]) => ({ id, ...m }));
        setAgents(list);
        let currentId = selectedAgent;
        if (!currentId) {
          currentId = list[0]?.id;
          if (currentId && setSelectedAgent) setSelectedAgent(currentId);
        }
  const cur = list.find((a) => a.id === currentId);
        if (cur) {
          const toPct1 = (x) => {
            const v = Number(x);
            if (!isFinite(v)) return 0;
            return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
          };
          // Eski örnekleri yok say (>5s eski)
          const now = Date.now();
          if (typeof cur.ts === 'number') {
            const ageMs = Math.max(0, now - Number(cur.ts) * 1000);
            if (ageMs > 5000) {
              return; // önceki değerleri koru; sonraki döngüde yenilenecek
            }
          }
          // Ajan tarafından sağlanıyorsa host-normalize edilmiş CPU'yu tercih et, yoksa genel ortalamaya geri dön
          const cpuVal = cur.cpuHost ?? cur.cpu;
          const nextCpu = toPct1(cpuVal);
          const nextRam = toPct1(cur.memUsedPct ?? cur.ram);
          // Daha kararlı UI için üstel hareketli ortalama
          const smooth = (prev, next, alpha) => Math.round(((alpha * next) + ((1 - alpha) * prev)) * 10) / 10;
          // Ajan değiştiğinde yumuşatmayı sıfırla
          if (cpu === 0 && ram === 0 && lastCpuRef.current === 0 && lastRamRef.current === 0) {
            lastCpuRef.current = nextCpu;
            lastRamRef.current = nextRam;
          }
          const smCpu = smooth(lastCpuRef.current, nextCpu, 0.35);
          const smRam = smooth(lastRamRef.current, nextRam, 0.25);
          lastCpuRef.current = smCpu;
          lastRamRef.current = smRam;
          setCpu(smCpu);
          setRam(smRam);
          // Önce dostça ad, sonra hostname, son çare olarak id tercih et
          setHost(cur.name || cur.hostname || cur.agentId || currentId);
        }
      } catch (e) {
        // geçici hataları yok say
      } finally {
        if (mounted) timer = setTimeout(tick, 1000);
      }
    };
    tick();
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, [selectedAgent, setSelectedAgent]);

  return { cpu, ram, host, agents };
}

const GaugeRow = memo(function GaugeRow({ icon: Icon, label, value, suffix = "%" }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </div>
        <span className="text-zinc-300 font-medium">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {suffix}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${value > 80 ? "bg-red-500" : value > 60 ? "bg-amber-400" : "bg-zinc-200"}`}
          style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }}
        />
      </div>
    </div>
  );
});
//başlık stili
function SectionTitle({ children }) {
  return <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">{children}</div>;
}
//açılır kapanır başlık
const ToggleHeader = memo(function ToggleHeader({ icon: Icon, title, isOpen, onToggle, rightAction }) {
  return (
    <div className="flex items-start justify-between border-b border-zinc-800/80 pb-2">
      <button
        onClick={onToggle}
        className="group inline-flex items-center gap-2 text-sm text-zinc-200 hover:text-zinc-100"
        aria-expanded={isOpen}
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
        {Icon && <Icon className="w-4 h-4 opacity-80" />}
        <span className="font-medium">{title}</span>
      </button>
      {rightAction}
    </div>
  );
});
//-----------------command line component
const Terminal = memo(function Terminal({ onRun }) {
  const [cmd, setCmd] = useState("");
  const ref = useRef(null);

  const run = useCallback(() => {
    const val = cmd.trim();
    if (!val) return;
    onRun(val);
    setCmd("");
    ref.current?.focus();
  }, [cmd, onRun]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      run();
    }
  }, [run]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3" style={{ height: HEADER_HEIGHT }}>
      <div className="h-full w-full flex items-center gap-2">
        <TerminalSquare className="w-4 h-4 opacity-80" />
        <input
          ref={ref}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Komut yazın ve Enter'a basın"
          className="flex-1 bg-transparent outline-none text-zinc-200 placeholder:text-zinc-500"
        />
      </div>
    </div>
  );
});
//-------------------log history paneli
const HistoryPanel = memo(function HistoryPanel({ history, isOpen, onToggle, rightAction }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 h-full flex flex-col">
      <ToggleHeader
        icon={HistoryIcon}
        title="Log / History"
        isOpen={isOpen}
        onToggle={onToggle}
        rightAction={rightAction}
      />

      <motion.div
        initial={false}
        animate={{ height: isOpen ? PANEL_HEIGHT : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: "tween", duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="min-h-0 overflow-y-auto space-y-2 pr-1" style={{ height: PANEL_HEIGHT }}>
          {history.length === 0 && <div className="text-sm text-zinc-500">Henüz bir komut yok.</div>}
          {history.map((h) => (
            <div key={`${h.ts}-${h.cmd}`} className="rounded-md bg-black/50 border border-zinc-800 p-2">
              <div className="text-[11px] text-zinc-500">{new Date(h.ts).toLocaleString()}</div>
              <div className="text-zinc-200 text-sm font-mono">$ {h.cmd}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
});
//-----------------output panel
const OutputPanel = memo(function OutputPanel({ outputs, isOpen, onToggle }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
      <ToggleHeader icon={TerminalSquare} title="Komut Çıktıları" isOpen={isOpen} onToggle={onToggle} />

      <motion.div
        initial={false}
        animate={{ height: isOpen ? PANEL_HEIGHT : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: "tween", duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="overflow-auto space-y-3 pr-1 w-full" style={{ height: PANEL_HEIGHT }}>
          {outputs.length === 0 && <div className="text-sm text-zinc-500">Çıktı yok. Bir komut çalıştırın.</div>}
          {outputs.map((o) => (
            <motion.div
              key={`${o.ts}-${o.cmd}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-black/50 border border-zinc-800 p-3 w-full min-w-0"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
                <span>{new Date(o.ts).toLocaleString()}</span>
                <span className="font-mono truncate ml-2">$ {o.cmd}</span>
              </div>
              <div className="w-full overflow-auto">
                <pre className="text-zinc-200 text-sm whitespace-pre leading-relaxed min-w-0">{`${o.result}`}</pre>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
});
//ana component
export default function SysMonitorUI() {
  const [selectedAgent, setSelectedAgent] = useState("");
  const { cpu, ram, host, agents } = useLiveMetrics(selectedAgent, setSelectedAgent);
  const [history, setHistory] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [isOutputOpen, setOutputOpen] = useState(false);

  const allOpen = isHistoryOpen && isOutputOpen;

  const toggleAll = useCallback(() => {
    const next = !allOpen;
    setHistoryOpen(next);
    setOutputOpen(next);
  }, [allOpen]);

  const runCommand = useCallback(async (cmd) => {
    const ts = Date.now();
    const agentId = selectedAgent || agents[0]?.id || "";
    // Hemen logla ve Enter'da geçmiş panelini aç
    setHistory((h) => [{ ts, cmd }, ...h]);
    setHistoryOpen(true);
    if (!agentId) {
      setOutputs((o) => [{ ts, cmd, result: "Hata: aktif ajan bulunamadı" }, ...o]);
      setOutputOpen(true);
      return;
    }
    try {
      await apiRunCommand(agentId, cmd);
      await new Promise((res) => setTimeout(res, 700));
      const out = await apiGetOutput(agentId);
      setOutputs((o) => [{ ts, cmd, result: out || "(boş çıktı)" }, ...o]);
      setOutputOpen(true);
    } catch (err) {
      setOutputs((o) => [{ ts, cmd, result: `Hata: ${err}` }, ...o]);
      setOutputOpen(true);
    }
  }, [setOutputOpen, setHistoryOpen, selectedAgent, agents]);

  const clearAll = useCallback(() => {
    setHistory([]);
    setOutputs([]);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearAll();
    setHistoryOpen(false);
    setOutputOpen(false);
  }, [clearAll]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-full px-4 py-6">
        <div className="card rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          
          <div className="flex flex-wrap gap-4">
            <div className="w-full md:w-60 lg:w-72 flex flex-col gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="mb-2 text-lg font-semibold text-zinc-100">Sys Monitor</div>
                <SectionTitle>Durum</SectionTitle>
                <div className="space-y-4">
                  <div className="pt-1 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      <span>Name</span>
                      <span className="ml-auto text-zinc-200 font-medium">{host}</span>
                    </div>
                  </div>
                  <GaugeRow icon={Cpu} label="CPU Kullanımı" value={cpu} />
                  <GaugeRow icon={MemoryStick} label="RAM Kullanımı" value={ram} />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <Terminal onRun={runCommand} />
              <OutputPanel outputs={outputs} isOpen={isOutputOpen} onToggle={() => setOutputOpen((v) => !v)} />
            </div>
            <div className="w-full md:w-60 lg:w-72">
              <HistoryPanel
              history={history}
              isOpen={isHistoryOpen}
              onToggle={() => setHistoryOpen((v) => !v)}
              rightAction={
                <div className="flex flex-col gap-1 mt-0.5">
                  <button
                    onClick={toggleAll}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800"
                    aria-pressed={!allOpen}
                    title={allOpen ? "Tümünü Kapat" : "Tümünü Aç"}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allOpen ? "rotate-0" : "-rotate-90"}`} />
                    <span>{allOpen ? "Tümünü Kapat" : "Tümünü Aç"}</span>
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Temizle
                  </button>
                </div>
              }
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
