"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, Radio } from "lucide-react";
import Image from "next/image";
import { sendVideoFrame, receiveLiveVideo } from "./lib/aws";
import { demoVideos } from "./lib/demoVideos";
import { DemoVideo } from "./types/video";
import { useLogs } from "./hooks/useLogs";

export default function VideoProcessingUI() {
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const { logs, addLog, clearLogs } = useLogs([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastProcessedFrame, setLastProcessedFrame] = useState<string | null>(
    null
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef(false);
  const [lastDetections, setLastDetections] = useState<number>(0);
  const [frameResolution, setFrameResolution] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const streamStartTimeRef = useRef<number | null>(null);
  const lastFrameIndexRef = useRef<number>(-1);
  const FRAME_SHOW_DELAY = 1500; // ms

  const activeVideo = demoVideos.find((v) => v.id === activeStream);

  useEffect(() => {
    streamStartTimeRef.current = null;
    lastFrameIndexRef.current = -1;
    isPollingActive.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    async function pollSQS() {
      if (!isPollingActive.current) return;
      const results = await receiveLiveVideo();
      if (!isPollingActive.current) return;
      if (Array.isArray(results)) {
        // Ritardo iniziale: ignora i frame per i primi FRAME_SHOW_DELAY ms
        if (
          streamStartTimeRef.current &&
          Date.now() - streamStartTimeRef.current < FRAME_SHOW_DELAY
        ) {
          return;
        }
        // Filtro solo i frame del video attivo (usando filename)
        const currentFilename = activeVideo?.filename;
        results.forEach((r) => {
          if (currentFilename && r.filename && r.filename !== currentFilename) {
            return; // ignora frame di altri video
          }
          // Mostra solo frame con frame_index maggiore di quello già visualizzato
          if (
            typeof r.frame_index === "number" &&
            r.frame_index <= lastFrameIndexRef.current
          ) {
            return;
          }
          lastFrameIndexRef.current =
            r.frame_index ?? lastFrameIndexRef.current;
          const url = `https://${r.bucket}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${r.key}`;
          setLastProcessedFrame(url);
          setLastDetections(r.detections_count);
          addLog(
            `Frame #${r.frame_index} → ${r.detections_count} objects`,
            "info"
          );
          r.summary?.forEach((d: any) =>
            addLog(`${d.class} ${(d.conf * 100).toFixed(0)}%`, "detection")
          );
        });
      } else if (results) {
        const errMsg =
          typeof results === "object" && results && "message" in results
            ? (results as any).message
            : String(results);
        addLog("Errore ricezione risultati: " + errMsg, "error");
      }
    }

    if (streamStarted && activeVideo) {
      setWsConnected(true);
      addLog("WebSocket connected (simulato)", "info");
      addLog(`Starting object detection for ${activeVideo.filename}`, "info");
      isPollingActive.current = true;
      pollingIntervalRef.current = setInterval(pollSQS, 100); // 10 FPS polling
    } else {
      if (wsConnected) {
        setWsConnected(false);
        addLog("WebSocket disconnected", "info");
      }
      setLastProcessedFrame(null);
      isPollingActive.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      isPollingActive.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [streamStarted, activeVideo]);

  // addLog e clearLogs ora vengono da useLogs

  // --- Video frame extraction and Kinesis integration ---
  let videoElement: HTMLVideoElement | null = null;
  let frameInterval: NodeJS.Timeout | null = null;

  // Draw the latest frame on canvas when it changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!lastProcessedFrame) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setFrameResolution(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Adatta il canvas alla dimensione del frame la prima volta
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      setFrameResolution({ w: img.width, h: img.height });
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "20px sans-serif";
      ctx.fillText("Frame non disponibile", 20, 40);
      setFrameResolution(null);
    };
    img.src = lastProcessedFrame;
  }, [lastProcessedFrame]);

  // Helper: cattura un frame dal <video> e lo invia a Kinesis come bytes JPEG
  const captureAndSendFrame = async (video: HTMLVideoElement) => {
    if (video.readyState < 2) return; // il video non è ancora pronto

    // — opzionale: ridimensiona per stare sotto 1 MB —
    const MAX_W = 640;
    const scale = MAX_W / video.videoWidth;
    const w = Math.min(MAX_W, video.videoWidth);
    const h = video.videoHeight * scale;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const arrayBuffer = await blob.arrayBuffer();
        const frameBytes = new Uint8Array(arrayBuffer); // <-- bytes grezzi

        const res = await sendVideoFrame(frameBytes);
        if (res !== true) {
          const errMsg =
            typeof res === "object" && res && "message" in res
              ? (res as any).message
              : String(res);
          addLog("Errore invio frame: " + errMsg, "error");
        }
      },
      "image/jpeg",
      0.8 // qualità/compressione JPEG (0-1)
    );
  };

  const handleStopStream = () => {
    setActiveStream(null);
    setStreamStarted(false);
    clearLogs();
    setWsConnected(false);
    setLastProcessedFrame(null);
    setLastDetections(0);
    setFrameResolution(null);
    lastFrameIndexRef.current = -1;
    // Stop polling
    isPollingActive.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    // Stop frame extraction
    if (frameInterval) clearInterval(frameInterval);
    if (videoElement) {
      videoElement.pause();
      videoElement.remove();
      videoElement = null;
    }
  };

  const handleStartStream = async (video: DemoVideo) => {
    // Pulizia stato prima di partire con nuovo video
    setLastProcessedFrame(null);
    setLastDetections(0);
    setFrameResolution(null);
    lastFrameIndexRef.current = -1;
    clearLogs();
    setLoadingVideoId(video.id);
    setTimeout(() => {
      setActiveStream(video.id);
      setStreamStarted(true);
      setLoadingVideoId(null);
      // Salva il timestamp di inizio stream
      streamStartTimeRef.current = Date.now();
      setTimeout(() => {
        // Create hidden video element for frame extraction
        if (!videoElement) {
          videoElement = document.createElement("video");
          videoElement.src = `/videos/${video.filename}`;
          videoElement.crossOrigin = "anonymous";
          videoElement.muted = true;
          videoElement.playsInline = true;
          videoElement.style.display = "none";
          document.body.appendChild(videoElement);
        }
        videoElement.currentTime = 0;
        videoElement.play();
        // Start frame extraction loop (10 FPS)
        frameInterval = setInterval(() => {
          if (videoElement && !videoElement.paused && !videoElement.ended) {
            captureAndSendFrame(videoElement);
          }
        }, 100);
      }, 500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-github-bg font-aptos p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Video Processing Platform
          </h1>
          <p className="text-gray-300">
            Real-time video processing and streaming
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:items-start">
          {/* Producer Section */}
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Play className="w-5 h-5" />
                Scenarios
              </CardTitle>
              <CardDescription className="text-gray-300">
                Choose a demo video and start live processing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {demoVideos.map((video) => (
                  <div
                    key={video.id}
                    className={`border rounded-lg p-5 transition-all hover:shadow-lg ${
                      activeStream === video.id
                        ? "border-custom-red bg-custom-red/10"
                        : "border-gray-600 bg-gray-700/50 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex gap-5 items-center">
                      <div className="relative flex-shrink-0 w-[140px] h-[140px]">
                        <Image
                          src={video.thumbnail || "/placeholder.svg"}
                          alt={video.title}
                          fill
                          className="rounded-lg object-cover"
                        />
                        {activeStream === video.id && (
                          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                            <Radio className="w-8 h-8 text-white animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between h-[140px] max-h-[140px] overflow-hidden">
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-xl font-semibold text-white truncate pr-2">
                              {video.title}
                            </h3>
                            {activeStream === video.id && (
                              <Badge
                                variant="secondary"
                                className="ml-2 bg-green-900/50 text-green-300 border-green-700 flex-shrink-0"
                              >
                                <Radio className="w-3 h-3 mr-1" />
                                Streaming
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                            {video.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {activeStream === video.id ? (
                            <Button
                              onClick={handleStopStream}
                              variant="outline"
                              size="default"
                              className="text-custom-red border-custom-red hover:bg-custom-red hover:text-white bg-transparent"
                            >
                              Stop Stream
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleStartStream(video)}
                              disabled={
                                loadingVideoId === video.id || !!activeStream
                              }
                              size="default"
                              className="bg-custom-red hover:bg-custom-red/90 border-custom-red text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingVideoId === video.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Start Live Stream
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Consumer Section */}
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Radio className="w-5 h-5" />
                Stream
              </CardTitle>
              <CardDescription className="text-gray-300">
                Watch the processed video in real time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative border border-gray-700">
                {streamStarted && activeVideo ? (
                  <div className="w-full h-full flex flex-col relative">
                    {/* Mostra il frame processato da AWS (s3_url) */}
                    {streamStarted && lastProcessedFrame ? (
                      <>
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full object-contain bg-black rounded-lg"
                          style={{ display: "block" }}
                        />
                        {/* ✓ contatore oggetti */}
                        <div className="absolute bottom-4 left-4 bg-black/70 text-xs text-white px-2 py-1 rounded">
                          {lastDetections} objects
                        </div>
                        {/* Overlay risoluzione frame */}
                        {frameResolution && (
                          <div className="absolute bottom-4 right-4 bg-black/70 text-xs text-white px-2 py-1 rounded">
                            {frameResolution.w}x{frameResolution.h}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 bg-black rounded-lg">
                        <span>Nessun frame processato ancora</span>
                      </div>
                    )}
                    {/* Overlay info */}
                    <div className="absolute top-4 left-4 bg-black/70 rounded px-2 py-1 text-xs text-white">
                      Processing: {activeVideo.filename}
                    </div>
                    {/* <div className="absolute bottom-4 right-4 bg-black/70 rounded px-2 py-1 text-xs text-white">
                      1080p • 30fps
                    </div> */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <div className="flex flex-col items-center">
                        <Radio className="w-12 h-12 mx-auto mb-4 animate-pulse text-white" />
                        <h3 className="text-lg font-semibold mb-2 text-white">
                          Live Processing
                        </h3>
                        <p className="text-sm opacity-80 text-white">
                          {activeVideo.title}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <div className="w-2 h-2 bg-custom-red rounded-full animate-pulse"></div>
                          <span className="text-xs text-white">LIVE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2 text-gray-300">
                        No Active Stream
                      </h3>
                      <p className="text-sm">
                        Start a video stream from the Producer section to begin
                        processing
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {streamStarted && (
                <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                  <div className="flex items-center gap-2 text-green-300">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Stream Active</span>
                  </div>
                </div>
              )}

              {/* Processing Logs */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        wsConnected
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-500"
                      }`}
                    ></div>
                    <h3 className="text-lg font-semibold text-white">
                      Processing Logs
                    </h3>
                  </div>
                  {logs.length > 0 && (
                    <Button
                      onClick={clearLogs}
                      variant="outline"
                      size="sm"
                      className="text-gray-300 border-gray-600 hover:bg-gray-700"
                    >
                      Clear Logs
                    </Button>
                  )}
                </div>

                <p className="text-sm text-gray-300 mb-3">
                  Real-time object detection and processing information
                </p>

                <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto border border-gray-700">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-sm">No logs available</div>
                        <div className="text-xs mt-1">
                          Start a stream to see processing logs
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-sm">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-3">
                          <span className="text-gray-400 flex-shrink-0">
                            [{log.timestamp}]
                          </span>
                          <span
                            className={`flex-1 ${
                              log.type === "detection"
                                ? "text-green-400"
                                : log.type === "error"
                                ? "text-red-400"
                                : "text-gray-300"
                            }`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {streamStarted && (
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-400">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          wsConnected ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></div>
                      WebSocket: {wsConnected ? "Connected" : "Disconnected"}
                    </div>
                    <div className="text-gray-400">
                      {logs.filter((log) => log.type === "detection").length}{" "}
                      objects detected
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
