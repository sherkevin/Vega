"use client"

import { useState, useEffect, useRef } from "react"
import { IconX, IconPlus, IconTrash, IconMessage, IconEdit, IconCheck, IconX as IconCancel } from "@tabler/icons-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function Sidebar({ isOpen, onClose, currentConversationId, onSelectConversation, onNewConversation }) {
	const [conversations, setConversations] = useState([])
	const [loading, setLoading] = useState(true)
	const [editingId, setEditingId] = useState(null)
	const [editTitle, setEditTitle] = useState("")
	const editInputRef = useRef(null)

	const loadConversations = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/api/chat/conversations`)
			if (response.ok) {
				const data = await response.json()
				setConversations(data.conversations || [])
			}
		} catch (err) {
			console.error("Failed to load conversations:", err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (isOpen) {
			loadConversations()
		}
	}, [isOpen])

	const handleDeleteConversation = async (conversationId, e) => {
		e.stopPropagation()
		if (!confirm("Are you sure you want to delete this conversation?")) {
			return
		}

		try {
			const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}`, {
				method: "DELETE"
			})
			if (response.ok) {
				setConversations(prev => prev.filter(c => c.conversation_id !== conversationId))
				if (conversationId === currentConversationId) {
					onNewConversation()
				}
			}
		} catch (err) {
			console.error("Failed to delete conversation:", err)
		}
	}

	const handleStartEdit = (conversationId, currentTitle, e) => {
		e.stopPropagation()
		setEditingId(conversationId)
		setEditTitle(currentTitle || "New Chat")
		setTimeout(() => {
			editInputRef.current?.focus()
			editInputRef.current?.select()
		}, 0)
	}

	const handleCancelEdit = () => {
		setEditingId(null)
		setEditTitle("")
	}

	const handleSaveEdit = async (conversationId, e) => {
		e.stopPropagation()
		const newTitle = editTitle.trim() || "New Chat"
		
		try {
			const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ title: newTitle })
			})
			if (response.ok) {
				setConversations(prev => 
					prev.map(c => 
						c.conversation_id === conversationId 
							? { ...c, title: newTitle }
							: c
					)
				)
				setEditingId(null)
				setEditTitle("")
			} else {
				console.error("Failed to update conversation title")
			}
		} catch (err) {
			console.error("Failed to update conversation:", err)
		}
	}

	const handleKeyDown = (e, conversationId) => {
		if (e.key === "Enter") {
			handleSaveEdit(conversationId, e)
		} else if (e.key === "Escape") {
			handleCancelEdit()
		}
	}

	const formatDate = (dateString) => {
		const date = new Date(dateString)
		const now = new Date()
		const diffMs = now - date
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMs / 3600000)
		const diffDays = Math.floor(diffMs / 86400000)

		if (diffMins < 1) return "Just now"
		if (diffMins < 60) return `${diffMins}m ago`
		if (diffHours < 24) return `${diffHours}h ago`
		if (diffDays < 7) return `${diffDays}d ago`
		return date.toLocaleDateString()
	}

	return (
		<>
			{/* Overlay */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-40 md:hidden"
					onClick={onClose}
				/>
			)}

			{/* Sidebar */}
			<div
				className={`fixed top-0 left-0 h-full w-80 glass border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-neutral-800">
					<h2 className="text-lg font-semibold text-white">Conversations</h2>
					<div className="flex items-center gap-2">
						<button
							onClick={onNewConversation}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
							title="New Chat"
						>
							<IconPlus size={20} className="text-neutral-400" />
						</button>
						<button
							onClick={onClose}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
						>
							<IconX size={20} className="text-neutral-400" />
						</button>
					</div>
				</div>

				{/* Conversations List */}
				<div className="flex-1 overflow-y-auto h-[calc(100vh-73px)]">
					{loading ? (
						<div className="p-4 text-center text-neutral-400">Loading...</div>
					) : conversations.length === 0 ? (
						<div className="p-4 text-center text-neutral-500">
							<p className="mb-2">No conversations yet</p>
							<button
								onClick={onNewConversation}
								className="text-blue-500 hover:text-blue-400"
							>
								Start a new chat
							</button>
						</div>
					) : (
						<div className="p-2">
							{conversations.map((conv) => (
								<div
									key={conv.conversation_id}
									onClick={() => {
										if (editingId !== conv.conversation_id) {
											onSelectConversation(conv.conversation_id)
											onClose()
										}
									}}
									className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
										currentConversationId === conv.conversation_id
											? "bg-blue-600/20 border border-blue-600/50"
											: "hover:bg-neutral-800"
									}`}
								>
									<IconMessage size={18} className="text-neutral-400 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										{editingId === conv.conversation_id ? (
											<input
												ref={editInputRef}
												value={editTitle}
												onChange={(e) => setEditTitle(e.target.value)}
												onKeyDown={(e) => handleKeyDown(e, conv.conversation_id)}
												onClick={(e) => e.stopPropagation()}
												className="w-full bg-neutral-700 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
											/>
										) : (
											<>
												<div className="text-sm text-white truncate">
													{conv.title || "New Chat"}
												</div>
												<div className="text-xs text-neutral-500">
													{formatDate(conv.last_updated || conv.updated_at)}
												</div>
											</>
										)}
									</div>
									{editingId === conv.conversation_id ? (
										<div className="flex items-center gap-1">
											<button
												onClick={(e) => handleSaveEdit(conv.conversation_id, e)}
												className="p-1 hover:bg-neutral-700 rounded transition-all"
												title="Save"
											>
												<IconCheck size={16} className="text-green-400" />
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation()
													handleCancelEdit()
												}}
												className="p-1 hover:bg-neutral-700 rounded transition-all"
												title="Cancel"
											>
												<IconCancel size={16} className="text-neutral-400" />
											</button>
										</div>
									) : (
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												onClick={(e) => handleStartEdit(conv.conversation_id, conv.title, e)}
												className="p-1 hover:bg-neutral-700 rounded transition-all"
												title="Rename"
											>
												<IconEdit size={16} className="text-neutral-400" />
											</button>
											<button
												onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
												className="p-1 hover:bg-neutral-700 rounded transition-all"
												title="Delete"
											>
												<IconTrash size={16} className="text-red-400" />
											</button>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	)
}

