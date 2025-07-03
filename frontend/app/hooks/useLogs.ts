import { useState } from "react";

export type LogType = "info" | "detection" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
}

export function useLogs(initialLogs: LogEntry[] = []) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  const addLog = (message: string, type: LogType) => {
    const uniqueId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newLog: LogEntry = {
      id: uniqueId,
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [...prev.slice(-49), newLog]);
  };

  const clearLogs = () => setLogs([]);

  return { logs, addLog, clearLogs };
}
