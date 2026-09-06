import React, { useState, useEffect, useRef } from 'react';

export interface LogLine {
  phase: string;
  line: string;
  timestamp: string;
}

export interface DarkTerminalProps {
  repoName: string;
  streamUrl?: string;
  initialLines?: LogLine[];
}

export const DarkTerminal: React.FC<DarkTerminalProps> = ({
  repoName,
  streamUrl,
  initialLines = [],
}) => {
  const [logs, setLogs] = useState<LogLine[]>(initialLines);
  const [currentPhase, setCurrentPhase] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const currentPhaseRef = useRef<string>('idle');

  const updatePhase = (phase: string) => {
    currentPhaseRef.current = phase;
    setCurrentPhase(phase);
  };

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (!streamUrl) return;

    const eventSource = new EventSource(streamUrl);
    setIsConnected(true);

    eventSource.addEventListener('start', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        updatePhase('detect');
        setLogs((prev) => [
          ...prev,
          { phase: 'system', line: `[SYSTEM] Connected to build pod: ${data.podName}`, timestamp: new Date().toISOString() },
        ].slice(-2000));
      } catch {
        updatePhase('detect');
      }
    });

    eventSource.addEventListener('phase', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        updatePhase(data.phase);
        setLogs((prev) => [
          ...prev,
          { phase: data.phase, line: `--- PHASE: ${data.phase.toUpperCase()} ---`, timestamp: new Date().toISOString() },
        ].slice(-2000));
      } catch {}
    });

    eventSource.onmessage = (e) => {
      try {
        const item = JSON.parse(e.data);
        setLogs((prev) => [...prev, item].slice(-2000));
      } catch {
        setLogs((prev) => [
          ...prev,
          { phase: currentPhaseRef.current, line: e.data, timestamp: new Date().toISOString() },
        ].slice(-2000));
      }
    };

    eventSource.addEventListener('complete', () => {
      updatePhase('complete');
      setIsConnected(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e: any) => {
      if (e?.data) {
        try {
          const errData = JSON.parse(e.data);
          const msg = errData.error || errData.message || e.data;
          setLogs((prev) => [
            ...prev,
            { phase: 'system', line: `[ERROR] ${msg}`, timestamp: new Date().toISOString() },
          ].slice(-2000));
        } catch {
          setLogs((prev) => [
            ...prev,
            { phase: 'system', line: `[ERROR] ${e.data}`, timestamp: new Date().toISOString() },
          ].slice(-2000));
        }
      }
      setIsConnected(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [streamUrl]);

  const copyToClipboard = () => {
    const text = logs.map((l) => `[${l.phase}] ${l.line}`).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {
      // Gracefully ignore clipboard rejection in restricted contexts
    });
  };

  const getPhaseColor = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'detect':
        return 'text-amber-400';
      case 'build':
        return 'text-indigo-400';
      case 'export':
        return 'text-emerald-400';
      case 'system':
        return 'text-cyan-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="w-full max-w-5xl rounded-xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden font-mono text-xs">
      {/* Terminal Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-slate-300 font-semibold truncate">
            {repoName} — Kpack Live Build Output
          </span>
        </div>

        {/* Status and Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px]">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 uppercase tracking-wide">
              {isConnected ? `Phase: ${currentPhase}` : currentPhase === 'complete' ? 'Finished' : 'Disconnected'}
            </span>
          </div>

          <button
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`px-2 py-1 rounded text-[11px] border transition-colors ${
              autoScroll
                ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            AutoScroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={copyToClipboard}
            className="px-2 py-1 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            Copy Logs
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 h-96 overflow-y-auto space-y-1 bg-black/60 text-slate-200">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic py-8 text-center">Waiting for build stream...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2.5 leading-relaxed hover:bg-white/[0.02] px-1 rounded">
              <span className="text-slate-600 select-none shrink-0 text-[10px]">
                {log.timestamp ? log.timestamp.substring(11, 19) : '00:00:00'}
              </span>
              <span className={`shrink-0 uppercase font-semibold text-[10px] w-14 ${getPhaseColor(log.phase)}`}>
                [{log.phase.substring(0, 6)}]
              </span>
              <span className="text-slate-200 whitespace-pre-wrap break-all flex-1">{log.line}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

