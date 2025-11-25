import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, FileText, X, CheckCircle2, Sparkles, Zap, FileSpreadsheet, ArrowRight, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000'

interface ConversionResult {
  filename: string
  filepath: string
  downloadUrl: string
}

export function ConvertPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [showFileList, setShowFileList] = useState(false)
  const [conversionApproach, setConversionApproach] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string>('')
  const [fileContents, setFileContents] = useState<{ name: string; content: string }[]>([])
  const [progress, setProgress] = useState(0)
  const [outputDir, setOutputDir] = useState<string>('')
  const [outputFilename, setOutputFilename] = useState<string>('')
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [excelRows, setExcelRows] = useState<any[][]>([])

  const mockExcelPreview = [
    { name: 'FL Tyre - Test A', temperature: '85°C', pressure: '32 PSI', wear: '15%', grip: '8.5/10' },
    { name: 'FR Tyre - Test A', temperature: '78°C', pressure: '30 PSI', wear: '12%', grip: '8.8/10' },
    { name: 'RL Tyre - Test B', temperature: '92°C', pressure: '34 PSI', wear: '18%', grip: '7.9/10' },
    { name: 'RR Tyre - Test B', temperature: '88°C', pressure: '33 PSI', wear: '16%', grip: '8.2/10' },
  ]

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length === 0) return

    setSelectedFiles(files)
    setShowFileList(false)
    setError('')
    setResult(null)
    setFileContents([])

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))

      const { data } = await axios.post(`${API_BASE_URL}/api/extract-content`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data && Array.isArray(data.files)) {
        const contents = data.files.map((f: { name: string; content: string }) => ({
          name: f.name,
          content: f.content
        }))
        setFileContents(contents)
      } else {
        setError('Failed to extract content from files')
      }
    } catch (e: any) {
      if (e.response?.data?.message) setError(e.response.data.message)
      else setError('Could not extract file contents. Ensure backend is running.')
      console.error('extract-content error:', e)
    }
  }

  const handleConvert = async () => {
    if (selectedFiles.length === 0 || !conversionApproach) {
      setError('Please select at least one file and choose a conversion method')
      return
    }
    setIsConverting(true)
    setError('')
    setProgress(0)
    
    try {
      // Create FormData for file upload
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })
      formData.append('conversionMethod', conversionApproach)
      if (outputDir) formData.append('outputDir', outputDir)
      if (outputFilename) formData.append('outputFilename', outputFilename)

      // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          return 90
        }
        return prev + 10
      })
      }, 300)

      // Call backend API
      const response = await axios.post(`${API_BASE_URL}/api/convert`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'blob',
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const uploadProgress = Math.round((progressEvent.loaded * 90) / progressEvent.total)
            setProgress(uploadProgress)
          }
        }
      })

      clearInterval(progressInterval)
      setProgress(100)

      // Create download URL from blob
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const downloadUrl = window.URL.createObjectURL(blob)
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = 'converted_files.xlsx'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Parse Excel for preview (first sheet)
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (firstSheetName) {
          const worksheet = workbook.Sheets[firstSheetName]
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          if (rows && rows.length > 0) {
            const headers = (rows[0] as any[]).map((h) => String(h))
            const dataRows = rows.slice(1)
            setExcelHeaders(headers)
            setExcelRows(dataRows)
          } else {
            setExcelHeaders([])
            setExcelRows([])
          }
        }
      } catch (e) {
        console.warn('Excel preview parse failed:', e)
        setExcelHeaders([])
        setExcelRows([])
      }

      setResult({
        filename: filename,
        filepath: downloadUrl,
        downloadUrl: downloadUrl
      })
      
      setIsConverting(false)
    } catch (error: any) {
      setProgress(0)
      setIsConverting(false)
      
      if (error.response) {
        // Backend returned an error
        if (error.response.data instanceof Blob) {
          // Try to parse error message from blob
          const errorText = await error.response.data.text()
          try {
            const errorJson = JSON.parse(errorText)
            setError(errorJson.message || errorJson.error || 'Conversion failed')
          } catch {
            setError('Conversion failed. Please check your files and try again.')
          }
        } else {
          setError(error.response.data?.message || error.response.data?.error || 'Conversion failed')
        }
      } else if (error.request) {
        setError('Cannot connect to server. Please make sure the backend is running.')
      } else {
        setError(error.message || 'An unexpected error occurred')
      }
      console.error('Conversion error:', error)
    }
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    const newContents = fileContents.filter((_, i) => i !== index)
    setFileContents(newContents)
    if (newFiles.length === 0) {
      setResult(null)
      setError('')
    }
  }

  const clearAll = () => {
    setSelectedFiles([])
    setFileContents([])
    setResult(null)
    setError('')
    setConversionApproach('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 dark:from-gray-900 dark:via-orange-950 dark:to-gray-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <motion.div
          className="absolute top-10 right-10 w-96 h-96"
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full text-orange-300 dark:text-orange-900">
            <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="20" strokeDasharray="10 5" />
            <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="15" strokeDasharray="8 4" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray="6 3" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute bottom-10 left-10 w-80 h-80"
          animate={{
            rotate: -360,
            scale: [1, 1.15, 1],
          }}
          transition={{
            rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            scale: { duration: 7, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full text-amber-300 dark:text-amber-900">
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="15" strokeDasharray="12 6" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="8 4" />
          </svg>
        </motion.div>
      </div>

      <div className="relative container mx-auto px-4 py-3 h-screen flex flex-col">
        {/* Header */}
        <motion.div
          className="mb-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
                <Sparkles className="w-7 h-7 text-orange-500" />
                Tyre Test Converter
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Convert test reports to Excel format</p>
            </div>
            {selectedFiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </motion.div>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-3"
        >
          <Card className="shadow-xl border-2 border-orange-200 dark:border-orange-800 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3 items-end">
                {/* File Upload */}
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    Select Files
                  </label>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.docx,.csv,.txt"
                      multiple
                      onChange={handleFileSelect}
                      id="file-upload"
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all group"
                    >
                      <Upload className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      <span className="text-sm">Browse Files</span>
                    </label>

                    {selectedFiles.length > 0 && (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={() => setShowFileList((prev) => !prev)}
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold hover:underline"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Conversion Method */}
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    Conversion Method
                  </label>
                  <Select value={conversionApproach} onValueChange={setConversionApproach}>
                    <SelectTrigger className="w-full h-10 border-2 border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 transition-colors">
                      <SelectValue placeholder="Choose method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text-extraction">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Text Extraction
                        </div>
                      </SelectItem>
                      <SelectItem value="table-parsing">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" />
                          Table Parsing
                        </div>
                      </SelectItem>
                      <SelectItem value="ocr">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          OCR Processing
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              {/* Output Options */}
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Output Folder (server)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. D:/exports/reports or ./output"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="h-10 border-2 border-gray-300 dark:border-gray-600 focus:border-orange-400"
                />
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Output Filename (without .xlsx)
                </label>
                <Input
                  type="text"
                  placeholder="my_converted_output"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  className="h-10 border-2 border-gray-300 dark:border-gray-600 focus:border-orange-400"
                />
              </div>

                {/* Convert Button */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleConvert}
                    disabled={!conversionApproach || selectedFiles.length === 0 || isConverting}
                    size="lg"
                    className="h-10 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Convert
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {isConverting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3"
                >
                  <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">{progress}% Complete</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* File List Modal */}
        <AnimatePresence>
          {showFileList && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFileList(false)}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-amber-500">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Selected Files ({selectedFiles.length})
                  </h3>
                  <button
                    onClick={() => setShowFileList(false)}
                    className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <ul className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-orange-50 dark:from-gray-700 dark:to-orange-900/20 rounded-xl hover:shadow-md transition-all group border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
                            <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="ml-3 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Grid */}
        <motion.div
          className="grid lg:grid-cols-2 gap-3 flex-1 min-h-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Input Preview */}
          <Card className="shadow-2xl border-2 border-blue-200 dark:border-blue-800 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Input Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1">
              {fileContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <motion.div
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <FileText className="w-28 h-28 text-gray-300 dark:text-gray-600 mb-4" />
                  </motion.div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold mb-2">No files selected</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">Upload files to see preview</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fileContents.map((file, index) => (
                    <motion.div
                      key={file.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-blue-500 p-1.5 rounded-lg">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-100 text-sm truncate flex-1">
                          {file.name}
                        </h4>
                      </div>
                      <pre className="bg-white dark:bg-gray-800 p-3 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap border border-blue-100 dark:border-blue-900 font-mono leading-relaxed">
                        {file.content}
                      </pre>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output Result */}
          <Card className="shadow-2xl border-2 border-green-200 dark:border-green-800 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileSpreadsheet className="w-5 h-5" />
                Excel Output
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1 flex flex-col">
              {isConverting ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-20 h-20 text-green-500 mb-4" />
                  </motion.div>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Processing files...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                    Extracting data and generating Excel spreadsheet
                  </p>
                  <motion.div
                    className="mt-6 flex gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-3 h-3 bg-green-500 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </motion.div>
                </div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col"
                >
                  <div className="mb-3 flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span className="font-semibold text-sm">Conversion Successful!</span>
                  </div>

                  <div className="flex-1 overflow-auto border-2 border-green-200 dark:border-green-800 rounded-lg mb-3 bg-white dark:bg-gray-900">
                    {excelHeaders.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No preview available</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 sticky top-0">
                          <tr>
                            {excelHeaders.map((h) => (
                              <th key={h} className="p-2.5 text-left font-bold text-green-900 dark:text-green-100 border-b-2 border-green-300 dark:border-green-700 text-xs">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {excelRows.slice(0, 200).map((row, idx) => (
                            <motion.tr
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                              className="hover:bg-green-50 dark:hover:bg-green-900/20 border-b border-green-100 dark:border-green-900/50"
                            >
                              {excelHeaders.map((_, colIdx) => (
                                <td key={colIdx} className="p-2.5 text-gray-700 dark:text-gray-300 text-xs">
                                  {row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : ''}
                                </td>
                              ))}
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg py-5"
                      onClick={() => {
                        if (result?.downloadUrl) {
                          const link = document.createElement('a')
                          link.href = result.downloadUrl
                          link.download = result.filename
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          // Clean up the blob URL
                          setTimeout(() => {
                            window.URL.revokeObjectURL(result.downloadUrl)
                          }, 100)
                        }
                      }}
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Download Excel File
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <FileSpreadsheet className="w-28 h-28 text-gray-300 dark:text-gray-600 mb-4" />
                  </motion.div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold mb-2">Ready to convert</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Excel output will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}