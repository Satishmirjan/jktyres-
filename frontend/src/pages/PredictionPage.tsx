import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Upload, Download, TrendingUp, Play, SkipForward, RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000'

interface PredictionResult {
  rawReportText: string
  predictedTemperature?: number
  confidence?: number
  recommendations?: string[]
  reportUrl?: string
}

interface Iteration {
  id: number
  timestamp: string
  results: PredictionResult
  parameters: any
}

const ALL_TIRE_PARAMETERS = [
  { key: 'tirePressure', label: 'Tire Pressure', value: 32, min: 20, max: 50, step: 1, unit: 'PSI' },
  { key: 'treadDepth', label: 'Tread Depth', value: 8, min: 0, max: 12, step: 0.5, unit: 'mm' },
  { key: 'loadIndex', label: 'Load Index', value: 91, min: 50, max: 120, step: 1, unit: '' },
  { key: 'speedRating', label: 'Speed Rating', value: 120, min: 80, max: 250, step: 5, unit: 'km/h' },
  { key: 'tireWidth', label: 'Tire Width', value: 205, min: 150, max: 300, step: 5, unit: 'mm' },
  { key: 'aspectRatio', label: 'Aspect Ratio', value: 55, min: 30, max: 80, step: 1, unit: '%' },
  { key: 'rimDiameter', label: 'Rim Diameter', value: 16, min: 12, max: 22, step: 1, unit: 'inch' },
  { key: 'tireAge', label: 'Tire Age', value: 2, min: 0, max: 10, step: 1, unit: 'years' },
]

const FilterPanel = ({ filters, onChange }: any) => (
  <div className="space-y-2">
    {filters.map((f: any) => (
      <div key={f.key} className="space-y-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
        {typeof f.value === 'number' ? (
          <input
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            value={f.value}
            onChange={e => onChange(f.key, parseFloat(e.target.value))}
            className="border-2 border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 w-full text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        ) : (
          <input
            type="text"
            value={f.value}
            onChange={e => onChange(f.key, e.target.value)}
            className="border-2 border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 w-full text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        )}
        {f.unit && <span className="text-xs text-gray-500 dark:text-gray-400">{f.unit}</span>}
      </div>
    ))}
  </div>
)

export function PredictionPage() {
  const [mode, setMode] = useState<'upload' | 'manual' | 'existing'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [existingFile, setExistingFile] = useState<string | null>(null)
  const [filterValues, setFilterValues] = useState<any>(
    ALL_TIRE_PARAMETERS.reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {})
  )
  const [selectedParams, setSelectedParams] = useState<string[]>(['tirePressure', 'treadDepth', 'loadIndex'])
  const [isPredicting, setIsPredicting] = useState(false)
  const [error, setError] = useState<string>('')
  const [iterations, setIterations] = useState<Iteration[]>([])
  const [currentIterationIndex, setCurrentIterationIndex] = useState<number>(-1)
  const [outputDir, setOutputDir] = useState<string>('')
  const [outputFilename, setOutputFilename] = useState<string>('')

  const mockExistingFiles = ['previous_run_2025-10-20.csv', 'sample_dataset.xlsx']

  const handleStartIterations = async () => {
    if (!selectedParams.length) return setError('Select at least one parameter.')
    if (mode === 'upload' && !selectedFile) return setError('Upload a file first.')
    if (mode === 'existing' && !existingFile) return setError('Choose an existing file.')

    setError('')
    setIsPredicting(true)

    try {
      const iterationNum = iterations.length + 1
      const requestData = {
        parameters: filterValues,
        selectedParams,
        iterationNum,
        mode,
        fileName: mode === 'upload' ? selectedFile?.name : existingFile,
      }

      const response = await axios.post(`${API_BASE_URL}/api/predict`, requestData)
      const result = response.data.result

      const newIteration: Iteration = {
        id: iterationNum,
        timestamp: response.data.timestamp,
        results: {
          rawReportText: result.rawReportText,
          predictedTemperature: result.predictedTemperature,
          confidence: result.confidence,
          recommendations: result.recommendations,
        },
        parameters: requestData.parameters,
      }

      setIterations([...iterations, newIteration])
      setCurrentIterationIndex(iterations.length)
    } catch (err) {
      setError('Prediction failed.')
    } finally {
      setIsPredicting(false)
    }
  }

  const handleDownloadReport = async () => {
    if (currentIterationIndex === -1 || !iterations[currentIterationIndex]) return
    const result = iterations[currentIterationIndex].results
    
    // Use custom filename if provided, otherwise use default
    let filename = outputFilename.trim()
    if (!filename) {
      filename = `iteration_${iterations[currentIterationIndex].id}_report.txt`
    } else {
      // Ensure it has .txt extension
      if (!filename.toLowerCase().endsWith('.txt')) {
        filename = `${filename}.txt`
      }
    }
    
    // If output directory is specified, send to backend to save there
    if (outputDir.trim()) {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/save-prediction-report`, {
          content: result.rawReportText,
          filename: filename,
          outputDir: outputDir.trim()
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.data.success) {
          // Also trigger browser download
          const blob = new Blob([result.rawReportText], { type: 'text/plain;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          setError('')
        } else {
          setError('Failed to save report to server directory')
        }
      } catch (error: any) {
        console.error('Save error:', error)
        // Fallback to browser download only
        const blob = new Blob([result.rawReportText], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setError('Saved to browser download folder (server save failed)')
      }
    } else {
      // Browser download only
      const blob = new Blob([result.rawReportText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setError('')
    }
  }

  const currentResult = currentIterationIndex >= 0 ? iterations[currentIterationIndex] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-y-auto flex flex-col">
      
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
        <motion.div
          className="absolute top-20 right-20 w-64 h-64"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full text-purple-300 dark:text-purple-900">
            <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="20" strokeDasharray="10 5" />
          </svg>
        </motion.div>
      </div>

      {/* Scrollable Content */}
      <div className="relative flex-1 flex flex-col overflow-y-auto">

        {/* Header */}
        <motion.div className="px-4 py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full shadow">
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium">AI Prediction Engine</span>
            </div>

            {iterations.length > 0 && (
              <div className="px-4 py-1 bg-white/70 rounded-full shadow">
                <span className="text-xs font-semibold">Iterations: {iterations.length}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* MAIN GRID */}
        <div className="flex-1 px-4 pb-6 grid lg:grid-cols-2 gap-3">

          {/* CONFIG PANEL */}
          <Card className="shadow-xl border bg-white/80">
            <CardHeader className="py-2 bg-purple-600 text-white">
              <CardTitle className="text-sm flex items-center gap-1">
                <Upload className="w-4 h-4" />
                Configuration
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 space-y-2 overflow-y-auto">

              {/* Mode Selection */}
              <div className="flex gap-2">
                {['upload', 'manual', 'existing'].map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setMode(m as any)}
                  >
                    {m.toUpperCase()}
                  </Button>
                ))}
              </div>

              {/* Upload Mode */}
              {mode === 'upload' && (
                <div>
                  <label className="text-xs">Upload Dataset</label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* Existing Mode */}
              {mode === 'existing' && (
                <div>
                  <label className="text-xs">Select Saved File</label>
                  <select
                    className="border rounded px-2 py-1 text-xs w-full"
                    value={existingFile || ''}
                    onChange={e => setExistingFile(e.target.value)}
                  >
                    <option value="">-- Select File --</option>
                    {mockExistingFiles.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              )}

              {/* Parameters */}
              <div>
                <label className="text-xs font-semibold">Parameters</label>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_TIRE_PARAMETERS.map(p => (
                    <label key={p.key} className="text-[10px] flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedParams.includes(p.key)}
                        onChange={() =>
                          setSelectedParams((prev: string[]) =>
                            prev.includes(p.key)
                              ? prev.filter(k => k !== p.key)
                              : [...prev, p.key]
                          )
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-2">
                {ALL_TIRE_PARAMETERS.filter(p => selectedParams.includes(p.key)).map(p => (
                  <FilterPanel
                    key={p.key}
                    filters={[{ ...p, value: filterValues[p.key] }]}
                    onChange={(key: string, val: any) =>
                      setFilterValues((prev: any) => ({ ...prev, [key]: val }))
                    }
                  />
                ))}
              </div>

              {/* Errors */}
              {error && (
                <div className="text-xs text-red-600 bg-red-100 p-2 rounded">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 text-xs"
                  disabled={isPredicting || iterations.length > 0}
                  onClick={handleStartIterations}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start Iterations
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setIterations([])
                    setCurrentIterationIndex(-1)
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {iterations.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleStartIterations}
                  className="w-full text-xs"
                >
                  <SkipForward className="w-3 h-3 mr-1" />
                  Next Iteration
                </Button>
              )}

            </CardContent>
          </Card>

          {/* RESULT PANEL */}
          <Card className="shadow-xl border bg-white/80 flex flex-col overflow-hidden">
            <CardHeader className="py-2 bg-indigo-600 text-white">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                {currentResult ? `Iteration ${currentResult.id}` : 'Prediction Results'}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {isPredicting ? (
                  <motion.div
                    key="loading"
                    className="h-full flex items-center justify-center flex-col text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Brain className="w-14 h-14 text-purple-500 animate-pulse" />
                    <p className="text-sm mt-2">Running AI Analysis…</p>
                  </motion.div>
                ) : currentResult ? (
                  <motion.div
                    key={currentResult.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="bg-indigo-50 p-3 rounded-lg mb-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded shadow">
                          <div className="text-xs text-gray-500">Temperature</div>
                          <div className="text-lg font-bold text-orange-600">
                            {currentResult.results.predictedTemperature}°C
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded shadow">
                          <div className="text-xs text-gray-500">Confidence</div>
                          <div className="text-lg font-bold text-green-600">
                            {currentResult.results.confidence}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <pre className="text-[10px] bg-gray-100 p-3 rounded-lg border max-h-72 overflow-y-auto whitespace-pre-wrap">
                      {currentResult.results.rawReportText}
                    </pre>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500 h-full">
                    <Brain className="w-16 h-16 opacity-40 mb-2" />
                    <p className="text-xs">Start iterations to generate predictions</p>
                  </div>
                )}
              </AnimatePresence>
            </CardContent>

            {/* DOWNLOAD SECTION */}
            {currentResult && (
              <div className="p-3 border-t bg-white/60 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Output folder"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Filename"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 text-xs"
                    onClick={handleDownloadReport}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download Report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentResult) {
                        navigator.clipboard.writeText(currentResult.results.rawReportText)
                        setError('')
                      }
                    }}
                    className="text-xs"
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}
