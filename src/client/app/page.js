"use client"

import { useState, useRef, useEffect } from "react"
import InteractiveNetworkBackground from "@components/ui/InteractiveNetworkBackground"
import Sidebar from "@components/Sidebar"
import { IconSend, IconLoader, IconMenu2, IconPlus } from "@tabler/icons-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function ChatPage() {
	const [messages, setMessages] = useState([])
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState(null)
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [conversationId, setConversationId] = useState(null)
	const [swipeStartX, setSwipeStartX] = useState(null)
	const messagesEndRef = useRef(null)
	const abortControllerRef = useRef(null)
	const containerRef = useRef(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// Create new conversation
	const createNewConversation = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})
			if (response.ok) {
				const data = await response.json()
				setConversationId(data.conversation_id)
				setMessages([])
				setSidebarOpen(false)
			}
		} catch (err) {
			console.error("Failed to create conversation:", err)
		}
	}

	// Initialize with new conversation if none exists
	useEffect(() => {
		if (!conversationId) {
			createNewConversation()
		}
	}, [])

	const loadHistory = async (convId) => {
		if (!convId) return
		try {
			const apiUrl = `${API_BASE_URL}/api/chat/history?conversation_id=${convId}&limit=30`
			console.log("Loading history from:", apiUrl)
			const response = await fetch(apiUrl)
			if (response.ok) {
				const data = await response.json()
				setMessages(data.messages || [])
			} else {
				console.warn("Failed to load history:", response.status, response.statusText)
			}
		} catch (err) {
			console.error("Failed to load history:", err)
		}
	}

	useEffect(() => {
		if (conversationId) {
			loadHistory(conversationId)
		}
	}, [conversationId])

	const handleSelectConversation = (convId) => {
		setConversationId(convId)
		setMessages([])
	}

	// Swipe gesture handlers
	const handleTouchStart = (e) => {
		setSwipeStartX(e.touches[0].clientX)
	}

	const handleTouchMove = (e) => {
		if (swipeStartX === null) return
		const currentX = e.touches[0].clientX
		const diffX = currentX - swipeStartX

		// Swipe right to open sidebar (only if starting from left edge)
		if (swipeStartX < 50 && diffX > 50 && !sidebarOpen) {
			setSidebarOpen(true)
			setSwipeStartX(null)
		}
	}

	const handleTouchEnd = () => {
		setSwipeStartX(null)
	}

	const sendMessage = async () => {
		if (!input.trim() || isLoading || !conversationId) return

		const userMessage = input.trim()
		setInput("")
		setError(null)

		// Add user message to UI
		const userMsg = {
			role: "user",
			content: userMessage,
			message_id: `user-${Date.now()}`,
		}
		setMessages((prev) => [...prev, userMsg])

		// Create assistant message placeholder
		const assistantMsgId = `assistant-${Date.now()}`
		const assistantMsg = {
			role: "assistant",
			content: "",
			message_id: assistantMsgId,
		}
		setMessages((prev) => [...prev, assistantMsg])
		setIsLoading(true)

		// Cancel previous request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}
		abortControllerRef.current = new AbortController()

		try {
			const apiUrl = `${API_BASE_URL}/api/chat/message`
			console.log("Sending request to:", apiUrl)
			
			const response = await fetch(apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: userMessage,
					conversation_id: conversationId,
				}),
				signal: abortControllerRef.current.signal,
			})

			console.log("Response status:", response.status, response.statusText)
			
			if (!response.ok) {
				const errorText = await response.text().catch(() => "")
				console.error("API Error:", response.status, errorText)
				throw new Error(`HTTP error! status: ${response.status} - ${errorText || response.statusText}`)
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			let accumulatedContent = ""

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					if (!line.trim()) continue
					try {
						const event = JSON.parse(line)
						
						if (event.type === "assistantStream") {
							// Accumulate token content
							if (event.token) {
								accumulatedContent += event.token
							}
							
							// Update UI
							setMessages((prev) => {
								const updated = [...prev]
								const msgIndex = updated.findIndex(
									(m) => m.message_id === assistantMsgId
								)
								if (msgIndex >= 0) {
									updated[msgIndex] = {
										...updated[msgIndex],
										content: accumulatedContent,
									}
								}
								return updated
							})
							
							// If done, use final_content
							if (event.done && event.final_content) {
								setMessages((prev) => {
									const updated = [...prev]
									const msgIndex = updated.findIndex(
										(m) => m.message_id === assistantMsgId
									)
									if (msgIndex >= 0) {
										updated[msgIndex] = {
											...updated[msgIndex],
											content: event.final_content,
										}
									}
									return updated
								})
							}
						} else if (event.type === "error") {
							setError(event.message)
							setIsLoading(false)
							setMessages((prev) => prev.slice(0, -1))
							return
						}
					} catch (e) {
						console.error("Failed to parse event:", e, line)
					}
				}
			}
		} catch (err) {
			if (err.name === "AbortError") {
				console.log("Request aborted")
			} else {
				console.error("Error sending message:", err)
				setError(err.message)
				setMessages((prev) => prev.slice(0, -1))
			}
		} finally {
			setIsLoading(false)
			abortControllerRef.current = null
		}
	}

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	}

	return (
		<div
			ref={containerRef}
			className="h-screen w-screen flex flex-col bg-neutral-950 text-white overflow-hidden"
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			<InteractiveNetworkBackground />
			
			{/* Sidebar */}
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				currentConversationId={conversationId}
				onSelectConversation={handleSelectConversation}
				onNewConversation={createNewConversation}
			/>
			
			{/* Main chat area */}
			<div className="flex-1 flex flex-col items-center relative z-10">
				<div className="w-full max-w-4xl flex flex-col h-full">
					{/* Header */}
					<header className="border-b border-neutral-800 p-4 backdrop-blur-sm bg-neutral-950/50 flex items-center justify-between">
						<button
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
						>
							<IconMenu2 size={20} className="text-neutral-400" />
						</button>
						<h1 className="text-xl font-semibold text-center flex-1">AI Chat Assistant</h1>
						<button
							onClick={createNewConversation}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
							title="New Chat"
						>
							<IconPlus size={20} className="text-neutral-400" />
						</button>
					</header>

					{/* Messages list */}
					<div className="flex-1 overflow-y-auto p-6 space-y-6">
						{messages.length === 0 && (
							<div className="text-center text-neutral-400 mt-20">
								<p className="text-2xl mb-2 font-light">Welcome!</p>
								<p className="text-neutral-500">Start a conversation with your AI assistant.</p>
							</div>
						)}
						
						{messages.map((msg, idx) => (
							<div
								key={msg.message_id || idx}
								className={`flex ${
									msg.role === "user" ? "justify-end" : "justify-start"
								}`}
							>
							<div
								className={`max-w-[85%] rounded-2xl px-4 py-3 ${
									msg.role === "user"
										? "bg-blue-600 text-white"
										: "bg-neutral-800/80 text-neutral-100 backdrop-blur-sm"
								}`}
							>
								{msg.content || (isLoading && idx === messages.length - 1 ? (
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
										<div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
										<div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
									</div>
								) : "")}
							</div>
						</div>
						))}
						
						{error && (
							<div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
								Error: {error}
							</div>
						)}
						
						<div ref={messagesEndRef} />
					</div>

					{/* Input area - fixed at bottom */}
					<div className="border-t border-neutral-800 p-4 backdrop-blur-sm bg-neutral-950/50">
						<div className="flex gap-3 items-end">
							<textarea
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Type your message..."
								className="flex-1 bg-neutral-900/80 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
								rows={1}
								disabled={isLoading}
								style={{ minHeight: "44px", maxHeight: "200px" }}
							/>
							<button
								onClick={sendMessage}
								disabled={!input.trim() || isLoading}
								className="bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white p-3 rounded-xl flex items-center justify-center min-w-[48px] transition-colors"
							>
								{isLoading ? (
									<IconLoader className="animate-spin" size={20} />
								) : (
									<IconSend size={20} />
								)}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
