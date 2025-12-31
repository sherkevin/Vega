"use client"

import { useState, useRef, useEffect } from "react"
import AmbientBackground from "@components/ui/AmbientBackground"
import AnimatedLogo from "@components/ui/AnimatedLogo"
import ChatBubble from "@components/chat/ChatBubble"
import ChatInputArea from "@components/chat/ChatInputArea"
import WelcomeSequence from "@components/ui/WelcomeSequence"
import Sidebar from "@components/Sidebar"
import { IconMenu2, IconPlus } from "@tabler/icons-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function ChatPage() {
	const [messages, setMessages] = useState([])
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState(null)
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [conversationId, setConversationId] = useState(null)
	const [logoState, setLogoState] = useState("idle") // 'idle' | 'thinking' | 'speaking'
	const [showWelcome, setShowWelcome] = useState(false)
	const [swipeStartX, setSwipeStartX] = useState(null)
	const messagesEndRef = useRef(null)
	const abortControllerRef = useRef(null)
	const containerRef = useRef(null)
	const streamingMessageIdRef = useRef(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// Check if welcome sequence should be shown
	useEffect(() => {
		const lastWelcomeDate = localStorage.getItem("vega_last_welcome_date")
		const today = new Date().toDateString()
		if (lastWelcomeDate !== today) {
			setShowWelcome(true)
			localStorage.setItem("vega_last_welcome_date", today)
		}
	}, [])

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
		setLogoState("thinking")

		// Add user message to UI
		const userMsg = {
			role: "user",
			content: userMessage,
			message_id: `user-${Date.now()}`,
		}
		setMessages((prev) => [...prev, userMsg])

		// Create assistant message placeholder
		const assistantMsgId = `assistant-${Date.now()}`
		streamingMessageIdRef.current = assistantMsgId
		const assistantMsg = {
			role: "assistant",
			content: "",
			message_id: assistantMsgId,
			turn_steps: []
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
			let finalTurnSteps = []

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
							
							// Update UI with streaming content
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
							
							// If done, use final_content and capture turn_steps
							if (event.done && event.final_content) {
								finalTurnSteps = event.turn_steps || []
								setMessages((prev) => {
									const updated = [...prev]
									const msgIndex = updated.findIndex(
										(m) => m.message_id === assistantMsgId
									)
									if (msgIndex >= 0) {
										updated[msgIndex] = {
											...updated[msgIndex],
											content: event.final_content,
											turn_steps: finalTurnSteps
										}
									}
									return updated
								})
								setLogoState("idle")
							}
						} else if (event.type === "error") {
							setError(event.message)
							setIsLoading(false)
							setLogoState("idle")
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
			setLogoState("idle")
		} finally {
			setIsLoading(false)
			abortControllerRef.current = null
			streamingMessageIdRef.current = null
		}
	}

	// Update logo state based on loading state
	useEffect(() => {
		if (isLoading) {
			setLogoState("thinking")
		} else {
			setLogoState("idle")
		}
	}, [isLoading])

	return (
		<div
			ref={containerRef}
			className="h-screen w-screen flex flex-col bg-deep-space text-soft-white overflow-hidden"
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			{/* Ambient Background */}
			<AmbientBackground />
			
			{/* Welcome Sequence */}
			{showWelcome && (
				<WelcomeSequence onComplete={() => setShowWelcome(false)} />
			)}
			
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
					<header className="border-b border-white/10 p-4 glass flex items-center justify-between">
						<button
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="p-2 hover:bg-white/10 rounded-lg transition-colors"
						>
							<IconMenu2 size={20} className="text-muted-blue-gray" />
						</button>
						<div className="flex-1 flex items-center justify-center gap-3">
							<AnimatedLogo state={logoState} />
							<h1 className="text-xl font-semibold text-soft-white">Vega</h1>
						</div>
						<button
							onClick={createNewConversation}
							className="p-2 hover:bg-white/10 rounded-lg transition-colors"
							title="New Chat"
						>
							<IconPlus size={20} className="text-muted-blue-gray" />
						</button>
					</header>

					{/* Messages list */}
					<div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
						{messages.length === 0 && (
							<div className="text-center text-muted-blue-gray mt-20">
								<p className="text-2xl mb-2 font-light">Welcome!</p>
								<p className="text-neutral-500">Start a conversation with your AI assistant.</p>
							</div>
						)}
						
						{messages.map((msg, idx) => (
							<ChatBubble
								key={msg.message_id || idx}
								message={msg}
								isStreaming={isLoading && msg.message_id === streamingMessageIdRef.current}
							/>
						))}
						
						{error && (
							<div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
								Error: {error}
							</div>
						)}
						
						<div ref={messagesEndRef} />
					</div>
				</div>
			</div>

			{/* Floating Input Area */}
			<ChatInputArea
				value={input}
				onChange={setInput}
				onSend={sendMessage}
				isLoading={isLoading}
				placeholder="Type your message..."
			/>
		</div>
	)
}
