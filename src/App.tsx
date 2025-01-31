import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { load, Store } from '@tauri-apps/plugin-store'
import '@fontsource-variable/inter'
import './App.css'

import Header from './components/Header'
import GameEditModal from './components/GameEditModal'
import GameList from './components/GameList'
import GameDetails from './components/GameDetails'
import RawgModal from './components/RawgModal'
import ConfirmationModal from './components/ConfirmationModal'

interface ProcessInfo {
  id: number
  name: string
  path: string
  time: number
  running: boolean
  customName?: string
  coverUrl?: string
  addedDate: string
  lastPlayedDate?: string
}

interface SelectedGame extends ProcessInfo {
  fileExists: boolean
  id: number
}

function App() {
  const [trackedProcesses, setTrackedProcesses] = useState<ProcessInfo[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [showRawgModal, setShowRawgModal] = useState<boolean>(false)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [currentProcess, setCurrentProcess] = useState<ProcessInfo | null>(null)
  const [visibleProcesses, setVisibleProcesses] = useState<number>(15)
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null)
  const [gameToDelete, setGameToDelete] = useState<ProcessInfo | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeRef = useRef<Store | null>(null)

  const handleGameSelect = (name: string, id: number) => {
    setSelectedGame({
      name,
      id,
      fileExists: false,
      path: '',
      time: 0,
      running: false,
      addedDate: '',
      customName: '',
      coverUrl: '',
    })
    setShowRawgModal(false)
    setShowModal(true)
  }

  const handleGameClick = async (process: ProcessInfo) => {
    try {
      const fileExists = await invoke('check_if_file_exists', {
        path: process.path,
      })

      if (process.customName && fileExists) {
        fetch(
          `https://api.rawg.io/api/games?key=${import.meta.env.VITE_RAWG_API_KEY}&search=${process.customName}`,
        ).then((response) => response.json())
      }

      setSelectedGame({
        ...process,
        fileExists: fileExists as boolean,
      })
    } catch (error) {
      console.error('Error checking file existence:', error)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      if (scrollTop + clientHeight >= scrollHeight - 5) {
        setVisibleProcesses((prev) => prev + 15)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const initializeStore = async () => {
      storeRef.current = await load('D:\\storageGames\\store.json', {
        autoSave: true,
      })

      const storedProcesses = (await storeRef.current.get('processes')) || []
      if (Array.isArray(storedProcesses)) {
        setTrackedProcesses(storedProcesses)
      } else {
        setTrackedProcesses([])
      }
    }

    initializeStore()
  }, [])

  const availableYears = Array.from(
    new Set(trackedProcesses.map((p) => new Date(p.addedDate).getFullYear())),
  ).map(String)

  const filteredProcesses = trackedProcesses.filter((process) => {
    const matchesSearch =
      process.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (process.customName?.toLowerCase() || '').includes(
        searchQuery.toLowerCase(),
      )
    const matchesYear =
      !selectedYear ||
      new Date(process.addedDate).getFullYear().toString() === selectedYear
    return matchesSearch && matchesYear
  })

  const processesToShow = filteredProcesses.slice(0, visibleProcesses)

  const handleAddProcess = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Executables', extensions: ['exe'] }],
      })

      if (file && typeof file === 'string') {
        const processPath = file
        const processName = file.split('\\').pop() || file
        const alreadyTracked = trackedProcesses.some(
          (p) => p.name === processName,
        )

        if (!alreadyTracked) {
          const newProcess = {
            id: Date.now(), // Generate a unique id based on current timestamp
            name: processName,
            path: processPath,
            time: 0,
            running: false,
            addedDate: new Date().toISOString(),
          }
          setTrackedProcesses((prev) => [...prev, newProcess])
          localStorage.setItem(processName, JSON.stringify(newProcess))
          setCurrentProcess(newProcess)
          setShowRawgModal(true)
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    }
  }

  const handleRemoveProcess = async () => {
    console.log(gameToDelete)
    if (!gameToDelete) return

    const updatedProcesses = trackedProcesses.filter(
      (p) => p.name !== gameToDelete.name,
    )
    setTrackedProcesses(updatedProcesses)
    setSelectedGame(null)

    if (storeRef.current) {
      await storeRef.current.set('processes', updatedProcesses)
      await storeRef.current.save()
    } else {
      console.error('Store not initialized.')
    }

    setGameToDelete(null) // Close the modal
  }

  const updateProcessTime = async (
    name: string,
    newTime: number,
    isRunning: boolean,
  ) => {
    setTrackedProcesses((prevProcesses) =>
      prevProcesses.map((process) =>
        process.name === name
          ? {
              ...process,
              time: newTime,
              running: isRunning,
              lastPlayedDate: !isRunning
                ? new Date().toISOString()
                : process.lastPlayedDate,
            }
          : process,
      ),
    )

    const updatedProcesses = trackedProcesses.map((process) =>
      process.name === name
        ? {
            ...process,
            time: newTime,
            running: isRunning,
            lastPlayedDate: !isRunning
              ? new Date().toISOString()
              : process.lastPlayedDate,
          }
        : process,
    )

    setTrackedProcesses(updatedProcesses)

    if (storeRef.current) {
      await storeRef.current.set('processes', updatedProcesses)
      await storeRef.current.save()
    } else {
      console.error('Store não inicializado.')
    }

    if (selectedGame?.name === name) {
      setSelectedGame((prevSelectedGame) => ({
        ...prevSelectedGame!,
        running: isRunning,
        time: newTime,
        lastPlayedDate: !isRunning
          ? new Date().toISOString()
          : prevSelectedGame?.lastPlayedDate,
      }))
    }
  }

  const getLastPlayedTime = (lastPlayedDate: Date | string) => {
    const now = new Date()

    const lastPlayed = new Date(lastPlayedDate)

    const diffInSeconds = Math.floor(
      (now.getTime() - lastPlayed.getTime()) / 1000,
    )

    const days = Math.floor(diffInSeconds / (3600 * 24))
    const hours = Math.floor((diffInSeconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((diffInSeconds % 3600) / 60)

    if (days > 0) {
      return `${days} dia(s) atrás`
    } else if (hours > 0) {
      return `${hours} hora(s) atrás`
    } else if (minutes > 0) {
      return `${minutes} minuto(s) atrás`
    } else {
      return 'Recentemente'
    }
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const activeProcesses: { name: string; running: boolean }[] =
          await invoke('list_app_processes')

        trackedProcesses.forEach((process) => {
          const isRunning = activeProcesses.some(
            (active) => active.name === process.name,
          )

          if (isRunning) {
            const updatedTime = process.time + 1
            updateProcessTime(process.name, updatedTime, true)
          } else if (process.running) {
            updateProcessTime(process.name, process.time, false)
          }
        })
      } catch (error) {
        console.error('Error fetching active processes:', error)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [trackedProcesses])

  const handleOpenModal = (process: ProcessInfo) => {
    setCurrentProcess(process)
    setShowModal(true)
  }

  const handleSaveChanges = async (customName: string, coverUrl: string) => {
    if (!storeRef.current) {
      console.error('Store não inicializado.')
      return
    }

    if (currentProcess) {
      // Verifica novamente se o arquivo existe antes de salvar
      let fileExists = false
      try {
        fileExists = await invoke<boolean>('check_if_file_exists', {
          path: currentProcess.path,
        })
      } catch (error) {
        console.error('Erro ao verificar se o arquivo existe:', error)
      }

      const updatedProcess = {
        ...currentProcess,
        customName,
        coverUrl,
        fileExists, // Atualiza o fileExists corretamente
      }

      const updatedProcesses = trackedProcesses.map((p) =>
        p.name === currentProcess.name ? updatedProcess : p,
      )

      setTrackedProcesses(updatedProcesses)

      await storeRef.current.set('processes', updatedProcesses)
      await storeRef.current.save()

      // Atualiza também o jogo selecionado com o estado correto
      setSelectedGame({
        ...updatedProcess,
        fileExists, // Atualiza corretamente
      })

      setShowModal(false)
    }
  }

  const handlePlayProcess = async (processPath: string) => {
    try {
      const result = await invoke('execute_process', { processPath })
      console.log('Processo iniciado com sucesso:', result)
    } catch (error) {
      console.error('Erro ao tentar executar o processo:', error)
    }
  }

  return (
    <main className="w-full min-h-screen bg-background p-4">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        handleAddProcess={handleAddProcess}
      />

      <div className="flex gap-4">
        <GameList
          processesToShow={processesToShow}
          selectedGame={selectedGame}
          handleGameClick={(process: ProcessInfo) => handleGameClick(process)}
        />

        <div
          className="flex flex-col sticky top-14 max-w-[900px] mx-auto z-10"
          style={{
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto',
          }}
        >
          {selectedGame ? (
            <GameDetails
              selectedGame={selectedGame}
              handlePlayProcess={handlePlayProcess}
              handleOpenModal={handleOpenModal}
              handleRemoveProcess={() => setGameToDelete(selectedGame)}
              getLastPlayedTime={getLastPlayedTime}
            />
          ) : (
            <span className="text-lg">Selecione um jogo</span>
          )}
        </div>
      </div>

      {showRawgModal && (
        <RawgModal
          onSelectGame={handleGameSelect}
          onClose={() => setShowRawgModal(false)}
        />
      )}

      {showModal && selectedGame && (
        <GameEditModal
          gameId={selectedGame.id} // Pass the selected game's ID
          gameName={selectedGame.name} // Pass the selected game's name
          storeRef={storeRef}
          onSave={handleSaveChanges}
          onClose={() => {
            setShowModal(false)
            setSelectedGame(null)
          }}
        />
      )}

      {gameToDelete && (
        <ConfirmationModal
          title="Confirm Deletion"
          message={`Are you sure you want to remove ${gameToDelete.customName}?`}
          onConfirm={handleRemoveProcess}
          onCancel={() => setGameToDelete(null)}
        />
      )}
    </main>
  )
}

export default App
