import React, { useState } from 'react'
import { Store } from '@tauri-apps/plugin-store'

interface ProcessInfo {
  name: string
  path: string
  customName?: string
  coverUrl?: string
  // Other properties of a process can go here
}

interface GameEditModalProps {
  currentProcess: ProcessInfo
  storeRef: React.RefObject<Store | null>
  onSave: (customName: string, coverUrl: string) => void
  onClose: () => void
}

const GameEditModal: React.FC<GameEditModalProps> = ({
  currentProcess,
  storeRef,
  onSave,
  onClose,
}) => {
  const [customName, setCustomName] = useState(currentProcess.customName || '')
  const [coverUrl, setCoverUrl] = useState(currentProcess.coverUrl || '')

  const handleSave = () => {
    if (storeRef.current) {
      onSave(customName, coverUrl)
    } else {
      console.error('Store ainda não está disponível.')
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="w-full h-screen fixed top-0 left-0 z-40 bg-black opacity-50"
      ></div>
      <div className="fixed top-2/4 left-2/4 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-4 bg-[#1a1c2c] p-[20px] rounded-[8px] [box-shadow:0_4px_10px_rgba(0,_0,_0,_0.1)] w-[400px] text-center z-50">
        <h2 className="text-[18px] font-medium">Editar Jogo</h2>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Nome Personalizado"
          className="py-2 px-3 bg-transparent border-2 border-secondary rounded-md"
        />
        <input
          type="text"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="URL da Capa"
          className="py-2 px-3 bg-transparent border-2 border-secondary rounded-md"
        />
        <button onClick={handleSave}>Salvar</button>
      </div>
    </>
  )
}

export default GameEditModal
