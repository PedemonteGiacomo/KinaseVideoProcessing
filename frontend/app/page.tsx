"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Loader2, Radio } from "lucide-react"
import Image from "next/image"

interface DemoVideo {
  id: string
  title: string
  filename: string
  thumbnail: string
  description: string
}

const demoVideos: DemoVideo[] = [
  {
    id: "1",
    title: "Nature Scenery",
    filename: "nature.mp4",
    thumbnail: "/placeholder.svg?height=120&width=200",
    description: "Beautiful forest and mountain landscapes",
  },
  {
    id: "2",
    title: "City Streets",
    filename: "street.mp4",
    thumbnail: "/placeholder.svg?height=120&width=200",
    description: "Urban traffic and pedestrian activity",
  },
  {
    id: "3",
    title: "People & Crowds",
    filename: "people.mp4",
    thumbnail: "/placeholder.svg?height=120&width=200",
    description: "Human activity and social interactions",
  },
  {
    id: "4",
    title: "Ocean Waves",
    filename: "ocean.mp4",
    thumbnail: "/placeholder.svg?height=120&width=200",
    description: "Relaxing ocean waves and beach scenes",
  },
]

export default function VideoProcessingUI() {
  const [activeStream, setActiveStream] = useState<string | null>(null)
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null)
  const [streamStarted, setStreamStarted] = useState(false)
  const [logs, setLogs] = useState<
    Array<{ id: string; timestamp: string; message: string; type: "info" | "detection" | "error" }>
  >([])
  const [wsConnected, setWsConnected] = useState(false)

  const activeVideo = demoVideos.find((v) => v.id === activeStream)

  useEffect(() => {
    let detectionInterval: NodeJS.Timeout | null = null

    if (streamStarted && activeVideo) {
      // Simulate successful WebSocket connection
      setWsConnected(true)
      addLog("WebSocket connected successfully", "info")
      addLog(`Starting object detection for ${activeVideo.filename}`, "info")

      // Simulate receiving object detection data
      const simulateDetection = () => {
        const objects = ["person", "car", "bicycle", "dog", "cat", "bird", "traffic light", "stop sign"]
        const confidences = [0.85, 0.92, 0.78, 0.95, 0.88, 0.73, 0.91, 0.82]

        const randomObject = objects[Math.floor(Math.random() * objects.length)]
        const randomConfidence = confidences[Math.floor(Math.random() * confidences.length)]
        const x = Math.floor(Math.random() * 1920)
        const y = Math.floor(Math.random() * 1080)
        const width = Math.floor(Math.random() * 200) + 50
        const height = Math.floor(Math.random() * 200) + 50

        addLog(
          `Detected: ${randomObject} (${(randomConfidence * 100).toFixed(1)}%) at [${x}, ${y}, ${width}x${height}]`,
          "detection",
        )
      }

      // Start detection simulation after a short delay
      const startDelay = setTimeout(() => {
        detectionInterval = setInterval(simulateDetection, 2000 + Math.random() * 3000)
      }, 1000)

      return () => {
        clearTimeout(startDelay)
        if (detectionInterval) {
          clearInterval(detectionInterval)
        }
      }
    } else {
      // When stream stops, simulate WebSocket disconnection
      if (wsConnected) {
        setWsConnected(false)
        addLog("WebSocket disconnected", "info")
      }
    }

    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval)
      }
    }
  }, [streamStarted, activeVideo])

  const addLog = (message: string, type: "info" | "detection" | "error") => {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    }
    setLogs((prev) => [...prev.slice(-49), newLog]) // Keep last 50 logs
  }

  const handleStartStream = (video: DemoVideo) => {
    setActiveStream(video.id)
    setStreamStarted(true)
    setLoadingVideoId(video.id)
    // Simulate loading delay
    setTimeout(() => {
      setLoadingVideoId(null)
    }, 3000)
  }

  const handleStopStream = () => {
    setActiveStream(null)
    setStreamStarted(false)
    setLogs([])
    setWsConnected(false)
  }

  return (
    <div className="min-h-screen bg-github-bg font-aptos p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Video Processing Platform</h1>
          <p className="text-gray-300">Real-time video processing and streaming</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Producer Section */}
          <Card className="h-fit bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Play className="w-5 h-5" />
                Producer
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
                    className={`border rounded-lg p-4 transition-all hover:shadow-lg ${
                      activeStream === video.id
                        ? "border-custom-red bg-custom-red/10"
                        : "border-gray-600 bg-gray-700/50 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="relative flex-shrink-0">
                        <Image
                          src={video.thumbnail || "/placeholder.svg"}
                          alt={video.title}
                          width={120}
                          height={80}
                          className="rounded-md object-cover"
                        />
                        {activeStream === video.id && (
                          <div className="absolute inset-0 bg-black/20 rounded-md flex items-center justify-center">
                            <Radio className="w-6 h-6 text-white animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-white truncate">{video.title}</h3>
                            {activeStream === video.id && (
                              <Badge
                                variant="secondary"
                                className="ml-2 bg-green-900/50 text-green-300 border-green-700"
                              >
                                <Radio className="w-3 h-3 mr-1" />
                                Streaming
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mb-3">{video.description}</p>
                          <p className="text-xs text-gray-400 mb-3">{video.filename}</p>
                        </div>

                        <div className="flex gap-2 items-end">
                          {activeStream === video.id ? (
                            <Button
                              onClick={handleStopStream}
                              variant="outline"
                              size="sm"
                              className="text-custom-red border-custom-red hover:bg-custom-red hover:text-white bg-transparent"
                            >
                              Stop Stream
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleStartStream(video)}
                              disabled={loadingVideoId === video.id || !!activeStream}
                              size="sm"
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
          <Card className="h-fit bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Radio className="w-5 h-5" />
                Consumer
              </CardTitle>
              <CardDescription className="text-gray-300">Watch the processed video in real time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative border border-gray-700">
                {streamStarted && activeVideo ? (
                  <div className="w-full h-full flex flex-col">
                    {/* Simulated video stream */}
                    <div className="flex-1 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center relative">
                      <div className="text-center text-white">
                        <Radio className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                        <h3 className="text-lg font-semibold mb-2">Live Processing</h3>
                        <p className="text-sm opacity-80">{activeVideo.title}</p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <div className="w-2 h-2 bg-custom-red rounded-full animate-pulse"></div>
                          <span className="text-xs">LIVE</span>
                        </div>
                      </div>

                      {/* Simulated processing overlay */}
                      <div className="absolute top-4 left-4 bg-black/70 rounded px-2 py-1 text-xs text-white">
                        Processing: {activeVideo.filename}
                      </div>

                      {/* Simulated stream info */}
                      <div className="absolute bottom-4 right-4 bg-black/70 rounded px-2 py-1 text-xs text-white">
                        1080p • 30fps
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2 text-gray-300">No Active Stream</h3>
                      <p className="text-sm">Start a video stream from the Producer section to begin processing</p>
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
                  <p className="text-xs text-green-400 mt-1">
                    Receiving processed video from: https://your-backend-url/stream
                  </p>
                </div>
              )}

              {/* Processing Logs */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
                    ></div>
                    <h3 className="text-lg font-semibold text-white">Processing Logs</h3>
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

                <p className="text-sm text-gray-300 mb-3">Real-time object detection and processing information</p>

                <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto border border-gray-700">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-sm">No logs available</div>
                        <div className="text-xs mt-1">Start a stream to see processing logs</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-sm">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-3">
                          <span className="text-gray-400 flex-shrink-0">[{log.timestamp}]</span>
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
                      <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                      WebSocket: {wsConnected ? "Connected" : "Disconnected"}
                    </div>
                    <div className="text-gray-400">
                      {logs.filter((log) => log.type === "detection").length} objects detected
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
