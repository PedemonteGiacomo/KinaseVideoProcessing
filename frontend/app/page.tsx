"use client";

import { useState, useEffect } from "react";
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

const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY;
const KINESIS_STREAM_NAME = process.env.NEXT_PUBLIC_KINESIS_STREAM_NAME;
const SQS_QUEUE_URL = process.env.NEXT_PUBLIC_SQS_QUEUE_URL;

// Send a video frame to Kinesis
async function sendVideoFrame(videoData: Uint8Array | Buffer | string) {
  if (typeof window === "undefined") return;
  const AWS = (await import("aws-sdk")).default;
  const kinesis = new AWS.Kinesis({
    region: AWS_REGION as string,
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
  });
  const params = {
    StreamName: KINESIS_STREAM_NAME as string,
    Data: videoData,
    PartitionKey: "video-processing",
  };
  try {
    await kinesis.putRecord(params).promise();
    return true;
  } catch (error) {
    // error handling will be in the UI
    return error;
  }
}

// Receive detection results from SQS
async function receiveLiveVideo() {
  if (typeof window === "undefined") return [];
  const AWS = (await import("aws-sdk")).default;
  const sqs = new AWS.SQS({
    region: AWS_REGION as string,
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
  });
  const params = {
    QueueUrl: SQS_QUEUE_URL as string,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 2,
  };
  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        // Delete message after processing
        await sqs
          .deleteMessage({
            QueueUrl: SQS_QUEUE_URL as string,
            ReceiptHandle: message.ReceiptHandle as string,
          })
          .promise();
      }
      return data.Messages.map((msg) => JSON.parse(msg.Body!));
    }
    return [];
  } catch (error) {
    return error;
  }
}

// Cleanup ottimizzato per SQS FIFO - svuota completamente la coda
async function cleanupOldMessages() {
  if (typeof window === "undefined") return 0;
  const AWS = (await import("aws-sdk")).default;
  const sqs = new AWS.SQS({
    region: AWS_REGION as string,
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
  });
  
  let cleanedCount = 0;
  let consecutiveEmptyAttempts = 0;
  const maxEmptyAttempts = 3; // Ferma dopo 3 tentativi consecutivi senza messaggi
  const maxTotalAttempts = 30; // Limite massimo per evitare loop infiniti
  let totalAttempts = 0;
  
  console.log("🧹 Inizio cleanup coda SQS FIFO...");
  
  while (consecutiveEmptyAttempts < maxEmptyAttempts && totalAttempts < maxTotalAttempts) {
    try {
      const params = {
        QueueUrl: SQS_QUEUE_URL as string,
        MaxNumberOfMessages: 10, // Massimo per SQS
        WaitTimeSeconds: 0, // Polling immediato per cleanup veloce
        VisibilityTimeout: 1, // Timeout breve per cleanup aggressivo
      };
      
      const data = await sqs.receiveMessage(params).promise();
      
      if (!data.Messages || data.Messages.length === 0) {
        consecutiveEmptyAttempts++;
        totalAttempts++;
        // Breve pausa prima del prossimo tentativo
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Reset counter se troviamo messaggi
      consecutiveEmptyAttempts = 0;
      totalAttempts++;
      
      // Elimina tutti i messaggi trovati in parallelo
      const deletePromises = data.Messages.map(message => 
        sqs.deleteMessage({
          QueueUrl: SQS_QUEUE_URL as string,
          ReceiptHandle: message.ReceiptHandle as string,
        }).promise().catch(err => {
          // Log dell'errore ma continua con gli altri
          console.warn("Errore eliminazione singolo messaggio:", err);
          return null;
        })
      );
      
      const results = await Promise.allSettled(deletePromises);
      const successfulDeletes = results.filter(r => r.status === 'fulfilled').length;
      cleanedCount += successfulDeletes;
      
      console.log(`🗑️ Eliminati ${successfulDeletes}/${data.Messages.length} messaggi (totale: ${cleanedCount})`);
      
      // Pausa più breve tra i batch per essere più aggressivi
      await new Promise(resolve => setTimeout(resolve, 25));
      
    } catch (error) {
      console.error("❌ Errore durante cleanup coda:", error);
      // Su errore, aumenta il counter per evitare loop infiniti
      consecutiveEmptyAttempts++;
      totalAttempts++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`✅ Cleanup completato: ${cleanedCount} messaggi rimossi dalla coda FIFO`);
  } else {
    console.log("✅ Coda già vuota");
  }
  
  return cleanedCount;
}

interface DemoVideo {
  id: string;
  title: string;
  filename: string;
  thumbnail: string;
  description: string;
}

const demoVideos: DemoVideo[] = [
  {
    id: "1",
    title: "Cafe Table",
    filename: "cafe.mp4",
    thumbnail: "/videos/thumbnails/cafe.png?height=120&width=200",
    description:
      "Close-up table scene with a cup, bottle, phone and book in a cozy cafe.",
  },
  {
    id: "2",
    title: "Office Desk",
    filename: "office.mp4",
    thumbnail: "/videos/thumbnails/office.png?height=120&width=200",
    description:
      "Person working at a laptop with a cup, phone, bottle and books visible on the desk.",
  },
  {
    id: "3",
    title: "Reading Corner",
    filename: "reading.mp4",
    thumbnail: "/videos/thumbnails/reading.png?height=120&width=200",
    description:
      "Person sitting on a chair reading a book near a table with cup, bottle and phone.",
  },
  {
    id: "4",
    title: "Waiting Room",
    filename: "waiting-room.mp4",
    thumbnail: "/videos/thumbnails/waiting-room.png?height=120&width=200",
    description:
      "Chairs in a waiting area, with people reading, on phones, and a bottle on the floor.",
  },
];

export default function VideoProcessingUI() {
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [logs, setLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      message: string;
      type: "info" | "detection" | "error";
    }>
  >([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastProcessedFrame, setLastProcessedFrame] = useState<string | null>(
    null
  ); // s3_url
  const [lastDetections, setLastDetections] = useState<number>(0);
  const [streamEnded, setStreamEnded] = useState(false);
  const [consecutiveEmptyPolls, setConsecutiveEmptyPolls] = useState(0);

  const activeVideo = demoVideos.find((v) => v.id === activeStream);

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;

    async function pollSQS() {
      const results = await receiveLiveVideo();
      if (Array.isArray(results)) {
        if (results.length === 0) {
          // Nessun messaggio ricevuto - incrementa contatore
          setConsecutiveEmptyPolls(prev => {
            const newCount = prev + 1;
            // Se abbiamo 5 polling consecutivi vuoti (7.5 secondi), consideriamo lo stream terminato
            if (newCount >= 5) {
              setStreamEnded(true);
              addLog("Stream terminato - nessun frame in processamento", "info");
            }
            return newCount;
          });
        } else {
          // Reset contatore se riceviamo messaggi
          setConsecutiveEmptyPolls(0);
          setStreamEnded(false);
          
          results.forEach((r) => {
            // 3.1 URL S3
            const url = `https://${r.bucket}.s3.${AWS_REGION}.amazonaws.com/${r.key}`;
            setLastProcessedFrame(url);

            // 3.2 numero oggetti
            setLastDetections(r.detections_count);

            // 3.3 log sintetico
            addLog(`Frame #${r.frame_index} → ${r.detections_count} objects`, "info");

            // 3.4 log dettaglio per oggetto
            r.summary?.forEach((d: any) =>
              addLog(`${d.class} ${(d.conf * 100).toFixed(0)}%`, "detection")
            );
          });
        }
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
      pollingInterval = setInterval(pollSQS, 1500);
    } else {
      if (wsConnected) {
        setWsConnected(false);
        addLog("WebSocket disconnected", "info");
      }
      setLastProcessedFrame(null);
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [streamStarted, activeVideo, wsConnected]);

  const addLog = (message: string, type: "info" | "detection" | "error") => {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [...prev.slice(-49), newLog]); // Keep last 50 logs
  };

  // --- Video frame extraction and Kinesis integration ---
  let videoElement: HTMLVideoElement | null = null;
  let frameInterval: NodeJS.Timeout | null = null;
  let frameCount = 0;

  // Helper: cattura un frame dal <video> e lo invia a Kinesis come bytes JPEG
  const captureAndSendFrame = async (video: HTMLVideoElement) => {
    if (video.readyState < 2) return;           // il video non è ancora pronto

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
        const frameBytes = new Uint8Array(arrayBuffer);   // <-- bytes grezzi

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
      0.8        // qualità/compressione JPEG (0-1)
    );
  };


  // Start streaming: play video, extract frames, send to Kinesis
  const handleStartStream = async (video: DemoVideo) => {
    // SEMPRE: Mostra loading e resetta stati
    setLoadingVideoId(video.id);
    setActiveStream(video.id);
    setStreamStarted(false);
    setStreamEnded(false);
    setConsecutiveEmptyPolls(0);
    setLastProcessedFrame(null);
    setLastDetections(0);
    setLogs([]); // Pulisci SEMPRE i log precedenti
    
    // 🧹 CLEANUP: Svuota SEMPRE la coda prima di iniziare nuovo stream
    addLog("🧹 Pulizia coda in corso...", "info");
    try {
      const cleanedCount = await cleanupOldMessages();
      if (cleanedCount && cleanedCount > 0) {
        addLog(`✅ Rimossi ${cleanedCount} messaggi vecchi dalla coda`, "info");
      } else {
        addLog("✅ Coda già vuota, pronto per nuovo stream", "info");
      }
    } catch (error) {
      addLog("❌ Errore durante cleanup coda: " + String(error), "error");
    }
    
    // Ora avvia effettivamente lo stream
    addLog(`🎬 Avvio stream: ${video.title}`, "info");
    
    setTimeout(() => {
      setStreamStarted(true); // Ora è veramente started
      setLoadingVideoId(null);
      
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
        } else {
          // Se esiste già, aggiorna solo il src
          videoElement.src = `/videos/${video.filename}`;
        }
        
        videoElement.currentTime = 0;
        videoElement.play();
        
        // Start frame extraction loop (10 FPS)
        frameInterval = setInterval(() => {
          if (videoElement && !videoElement.paused && !videoElement.ended) {
            captureAndSendFrame(videoElement);
          } else if (videoElement && videoElement.ended) {
            // Video terminato, ferma l'invio frame
            addLog("🎬 Video terminato, stop invio frame", "info");
            if (frameInterval) clearInterval(frameInterval);
          }
        }, 100);
      }, 500);
    }, 800); // Riduciamo ulteriormente il timeout
  };

  const handleStopStream = () => {
    addLog("⏹️ Stop stream richiesto dall'utente", "info");
    
    setActiveStream(null);
    setStreamStarted(false);
    setStreamEnded(false);
    setConsecutiveEmptyPolls(0);
    setWsConnected(false);
    setLastProcessedFrame(null);
    setLastDetections(0);
    
    // Stop frame extraction
    if (frameInterval) {
      clearInterval(frameInterval);
      frameInterval = null;
    }
    if (videoElement) {
      videoElement.pause();
      videoElement.remove();
      videoElement = null;
    }
    
    addLog("✅ Stream stoppato completamente", "info");
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
                    className={`border rounded-lg p-5 transition-all hover:shadow-lg ${activeStream === video.id
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
                        <img
                          src={lastProcessedFrame}
                          alt="Processed frame"
                          className="w-full h-full object-contain bg-black"
                        />
                        {/* ✓ contatore oggetti */}
                        <div className="absolute bottom-4 left-4 bg-black/70 text-xs text-white px-2 py-1 rounded">
                          {lastDetections} objects
                        </div>
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
                    <div className="absolute bottom-4 right-4 bg-black/70 rounded px-2 py-1 text-xs text-white">
                      1080p • 30fps
                    </div>
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
                <div className={`mt-4 p-3 border rounded-lg ${streamEnded 
                  ? "bg-orange-900/20 border-orange-700" 
                  : "bg-green-900/20 border-green-700"
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${streamEnded 
                      ? "bg-orange-500" 
                      : "bg-green-500 animate-pulse"
                    }`}></div>
                    <span className={`text-sm font-medium ${streamEnded 
                      ? "text-orange-300" 
                      : "text-green-300"
                    }`}>
                      {streamEnded ? "Stream Terminato" : "Stream Active"}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${streamEnded 
                    ? "text-orange-400" 
                    : "text-green-400"
                  }`}>
                    {streamEnded 
                      ? "Il video è terminato, nessun frame in processamento"
                      : "Receiving processed video from AWS pipeline"
                    }
                  </p>
                </div>
              )}

              {/* Processing Logs */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${wsConnected
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
                      onClick={() => setLogs([])}
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
                            className={`flex-1 ${log.type === "detection"
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
                        className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-500" : "bg-red-500"
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
