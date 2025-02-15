import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { load, Store } from '@tauri-apps/plugin-store'
import GameEditModal from './GameEditModal'
import ConfirmationModal from './ConfirmationModal'

// Icons
import {
  PlayIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid'
import { SlGameController } from 'react-icons/sl'
import { FaCheck } from 'react-icons/fa6'

interface ProcessInfo {
  id: number
  name: string
  path: string
  time: number
  releaseDate: number
  description: string
  screenshots: string[]
  genre_names: string[]
  running: boolean
  customName?: string
  coverUrl?: string
  addedDate: string
  lastPlayedDate?: string
  fileExists: boolean
}

interface GameInfo {
  id: number
  name: string
  customName?: string
  coverUrl?: string
  time: number
  releaseDate: number
  description: string
  screenshots: string[]
  genre_names: string[]
  addedDate: string
  lastPlayedDate?: string
  path: string
  running: boolean
  fileExists: boolean
  DS4Windows?: boolean
}

interface GameDetailsProps {
  selectedGame: GameInfo | null
  setSelectedGame: (game: GameInfo | null) => void
  trackedProcesses: GameInfo[]
  setTrackedProcesses: React.Dispatch<React.SetStateAction<GameInfo[]>>
}

const GameDetails: React.FC<GameDetailsProps> = ({
  selectedGame,
  setSelectedGame,
  trackedProcesses,
  setTrackedProcesses,
}) => {
  const storeRef = useRef<Store | null>(null)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [gameToDelete, setGameToDelete] = useState<GameInfo | null>(null)
  const [currentProcess, setCurrentProcess] = useState<ProcessInfo | null>(null)
  const [isDS4Enabled, setIsDS4Enabled] = useState<boolean>(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (descriptionRef.current) {
      setIsOverflowing(
        descriptionRef.current.scrollHeight >
          descriptionRef.current.clientHeight,
      )
    }
  }, [selectedGame?.description])

  const toggleDescription = () => {
    setShowFullDescription((prev) => !prev)
  }

  useEffect(() => {
    const initializeStore = async () => {
      try {
        const store = await load('D:\\storageGames\\store.json', {
          autoSave: true,
        })
        storeRef.current = store

        if (selectedGame) {
          const savedProcesses = await store.get<GameInfo[]>('processes')
          const gameData = savedProcesses?.find(
            (game) => game.id === selectedGame.id,
          )
          setIsDS4Enabled(gameData?.DS4Windows ?? false)
        }
      } catch (error) {
        console.error('Erro ao carregar o estado do DS4Windows:', error)
      }
    }

    initializeStore()
  }, [selectedGame])

  const toggleDS4Windows = async () => {
    if (!selectedGame || !storeRef.current) return

    const newState = !isDS4Enabled
    setIsDS4Enabled(newState)

    // Atualizar apenas o jogo selecionado no estado global
    const updatedProcesses = trackedProcesses.map((game) =>
      game.id === selectedGame.id ? { ...game, DS4Windows: newState } : game,
    )

    setTrackedProcesses(updatedProcesses)

    try {
      // Salvar apenas o jogo atualizado no JSON
      await storeRef.current.set('processes', updatedProcesses)
      await storeRef.current.save()
      console.log(
        `DS4Windows atualizado para ${newState} no jogo ${selectedGame.name}`,
      )
    } catch (error) {
      console.error('Erro ao salvar o estado do DS4Windows:', error)
    }
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

    if (selectedGame && selectedGame.name === name) {
      setSelectedGame({
        ...selectedGame,
        running: isRunning,
        time: newTime,
        lastPlayedDate: !isRunning
          ? new Date().toISOString()
          : selectedGame.lastPlayedDate,
      })
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

  const handlePlayProcess = async (processPath: string) => {
    try {
      const result = await invoke('execute_process', { processPath })

      if (isDS4Enabled) {
        try {
          await invoke('execute_process', {
            processPath:
              'C:\\Users\\gabri\\Downloads\\DS4Windows\\DS4Windows.exe',
          })
          console.log('DS4Windows iniciado.')
        } catch (error) {
          console.error('Erro ao iniciar DS4Windows:', error)
        }
      }
      console.log('Processo iniciado com sucesso:', result)
    } catch (error) {
      console.error('Erro ao tentar executar o processo:', error)
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
      return `${days} days(s) ago`
    } else if (hours > 0) {
      return `${hours} hours(s) ago`
    } else if (minutes > 0) {
      return `${minutes} minute(s) ago`
    } else {
      return 'recently'
    }
  }

  const handleOpenModal = (process: ProcessInfo) => {
    setCurrentProcess(process)
    setShowModal(true)
  }

  const handleSaveChanges = async (customName: string, coverUrl: string) => {
    if (!storeRef.current || !selectedGame) return

    const updatedGame: GameInfo = {
      ...selectedGame,
      customName,
      coverUrl,
    }

    // Update the game info in the tracked processes
    const updatedProcesses = trackedProcesses.map((game) =>
      game.id === updatedGame.id ? updatedGame : game,
    )
    setTrackedProcesses(updatedProcesses)

    // Save the updated processes to the store
    await storeRef.current.set('processes', updatedProcesses)
    await storeRef.current.save()

    // Update the selected game
    setSelectedGame(updatedGame)

    // Close the modal after saving
    setShowModal(false)
  }

  const removeGame = async () => {
    if (!gameToDelete || !storeRef.current) return

    const updatedProcesses = trackedProcesses.filter(
      (p) => p.name !== gameToDelete.name,
    )
    setTrackedProcesses(updatedProcesses)

    await storeRef.current.set('processes', updatedProcesses)
    await storeRef.current.save()

    setGameToDelete(null)
    setSelectedGame(null)
  }

  if (!selectedGame) {
    return <span>Select a game to view details</span>
  }

  return (
    <div>
      <div className="relative flex items-end justify-between gap-6 xl:gap-10">
        <div className="relative flex-shrink-0 w-1/3 overflow-clip rounded-xl group shadow-xl shadow-[#08080a]">
          <img
            src={
              selectedGame.coverUrl ||
              'https://i.pinimg.com/736x/34/8d/53/348d53c456c2826821d17f421996031b.jpg'
            }
            alt={selectedGame.customName || selectedGame.name}
            className="w-full h-full object-cover z-20"
          />
          <div className="absolute top-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out z-10">
            <button
              className="px-2 py-2 bg-background rounded-full border border-textGray hover:bg-secondary"
              onClick={() => handleOpenModal(selectedGame)}
            >
              <PencilIcon className="size-4 text-white" />
            </button>
            <button
              className="px-2 py-2 bg-background rounded-full border border-textGray hover:bg-secondary"
              onClick={() => setGameToDelete(selectedGame)}
            >
              <TrashIcon className="size-4 text-white" />
            </button>
          </div>
          <div className="absolute top-0 right-0 bg-gradient-to-b from-black to-transparent w-full h-1/3 opacity-0 group-hover:opacity-70 transition-all duration-300 ease-in-out" />
        </div>
        <div className="max-w-[500px] mb-6 xl:mb-10">
          <span className="text-3xl uppercase font-black line-clamp-2">
            {selectedGame.customName || selectedGame.name}
          </span>
          <div className="w-fit pt-6 pb-8 xl:pt-8 xl:pb-10 flex flex-wrap gap-x-6 gap-y-2">
            <p>
              <span className="text-base text-textGray">Released on: </span>
              {new Date(selectedGame.releaseDate * 1000).toLocaleDateString()}
            </p>
            <p>
              <span className="text-base text-textGray">Time played:</span>{' '}
              {Math.floor(selectedGame.time / 3600)}h{' '}
              {Math.floor((selectedGame.time % 3600) / 60)}m{' '}
              {selectedGame.time % 60}s
            </p>
            <p>
              <span className="text-base text-textGray">Added on: </span>
              {new Date(selectedGame.addedDate).toLocaleDateString()}
            </p>
            <p>
              <span className="text-base text-textGray">Last played:</span>{' '}
              {selectedGame.lastPlayedDate
                ? getLastPlayedTime(selectedGame.lastPlayedDate)
                : '-'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedGame.fileExists ? (
              selectedGame.running ? (
                <button className="flex items-center gap-1 bg-foreground px-8 py-1 border-2 border-foreground text-textGray rounded-md cursor-default">
                  Running
                </button>
              ) : (
                <button
                  onClick={() => handlePlayProcess(selectedGame.path)}
                  className="flex items-center gap-1 text-secondary font-semibold bg-white px-8 py-1 border-2 border-white rounded-md"
                >
                  <PlayIcon className="size-4" /> Play
                </button>
              )
            ) : (
              <div className="px-8 py-1 bg-foreground border-2 border-foreground text-textGray font-medium rounded-md cursor-not-allowed">
                Uninstalled
              </div>
            )}
            <button
              onClick={toggleDS4Windows}
              className="relative bg-secondary border-2 border-secondary rounded-md p-[5px]"
            >
              <SlGameController
                className={`text-2xl ${isDS4Enabled ? 'text-white' : 'text-textGray'}`}
              />
              {isDS4Enabled ? (
                <FaCheck className="absolute -right-2 -top-2 text-secondary bg-white rounded-full p-[3px]" />
              ) : null}
            </button>
          </div>
          <div className="w-full h-[1px] bg-secondary my-6" />
          <div className="flex items-center gap-2">
            {selectedGame.genre_names && selectedGame.genre_names.length > 0 ? (
              selectedGame.genre_names.map((genre, index) => (
                <div
                  key={index}
                  className="w-fit font-semibold text-sm text-textGray bg-secondary px-3 py-1 rounded-md"
                >
                  {genre}
                </div>
              ))
            ) : (
              <div className="w-fit font-semibold text-sm text-textGray bg-secondary px-3 py-1 rounded-md">
                No genres available
              </div>
            )}
          </div>
        </div>

        {showModal && currentProcess && selectedGame && (
          <GameEditModal
            currentProcess={currentProcess}
            gameId={selectedGame.id}
            gameName={selectedGame.name}
            storeRef={storeRef}
            onSave={handleSaveChanges}
            onClose={() => setShowModal(false)}
          />
        )}

        {gameToDelete && (
          <ConfirmationModal
            title="Confirm Deletion"
            message={`Are you sure you want to remove ${gameToDelete.customName || gameToDelete.name}?`}
            onConfirm={removeGame}
            onCancel={() => setGameToDelete(null)}
          />
        )}
      </div>

      <div className="p-6 bg-secondary rounded-xl mt-10 xl:mt-20">
        <p
          ref={descriptionRef}
          className={`relative text-textGray transition-all duration-300 ${
            showFullDescription ? '' : 'line-clamp-4'
          }`}
        >
          {selectedGame.description}

          {isOverflowing && !showFullDescription && (
            <span className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-secondary to-transparent pointer-events-none" />
          )}
        </p>

        {isOverflowing && (
          <button
            onClick={toggleDescription}
            className="flex items-center gap-2 text-white font-medium mt-4"
          >
            {showFullDescription ? (
              <>
                See Less <ChevronUpIcon className="size-4 text-white" />
              </>
            ) : (
              <>
                See More <ChevronDownIcon className="size-4 text-white" />
              </>
            )}
          </button>
        )}
      </div>
      <div className={`grid grid-cols-3 gap-4 mt-6 mb-20`}>
        {selectedGame.screenshots?.map((s, index) => (
          <img
            key={index}
            src={s}
            alt={selectedGame.customName}
            className="aspect-[16/10] object-cover rounded-xl"
          />
        )) || []}
      </div>
    </div>
  )
}

export default GameDetails
