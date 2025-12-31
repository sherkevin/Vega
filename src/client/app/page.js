"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import CymaticsBackground from "@components/ui/CymaticsBackground"
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
	const [logoState, setLogoState] = useState("idle") // 'idle' | 'thinking' | 'speaking' (kept for internal tracking)
	const [showWelcome, setShowWelcome] = useState(false)
	
	// Calculate isActive state for CymaticsBackground
	// isActive is true when agent is thinking or speaking (loading)
	const isActive = isLoading
	const [swipeStartX, setSwipeStartX] = useState(null)
	
	// 新增状态
	const [uploadedFilename, setUploadedFilename] = useState(null)
	const [selectedFile, setSelectedFile] = useState(null)
	const [isUploading, setIsUploading] = useState(false)
	const [replyingTo, setReplyingTo] = useState(null)
	const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false)
	const [isVoiceMode, setIsVoiceMode] = useState(false)
	const [integrations] = useState([]) // 工具集成列表，暂时为空
	
	const messagesEndRef = useRef(null)
	const abortControllerRef = useRef(null)
	const containerRef = useRef(null)
	const streamingMessageIdRef = useRef(null)
	const textareaRef = useRef(null)
	const fileInputRef = useRef(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	// Only scroll when messages array length changes (new message added), not on every content update
	const prevMessagesLengthRef = useRef(0)
	useEffect(() => {
		if (messages.length !== prevMessagesLengthRef.current) {
			prevMessagesLengthRef.current = messages.length
			scrollToBottom()
		} else if (isLoading) {
			// During streaming, scroll smoothly without animation to avoid jank
			messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
		}
	}, [messages.length, isLoading])

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

	// 处理文件选择
	const handleFileChange = (e) => {
		const file = e.target.files?.[0]
		if (file) {
			setSelectedFile(file)
			setUploadedFilename(file.name)
			setIsUploading(false)
		}
	}

	// 停止流式响应
	const handleStopStreaming = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
			setIsLoading(false)
			setLogoState("idle")
		}
	}

	// 切换语音模式
	const toggleVoiceMode = () => {
		setIsVoiceMode((prev) => !prev)
	}

	// 处理输入变化
	const handleInputChange = (e) => {
		setInput(e.target.value)
	}

	// 使用 useCallback 优化 sendMessage
	const sendMessage = useCallback(async () => {
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
			let lastUpdateTime = 0
			const UPDATE_THROTTLE = 50 // Update UI at most every 50ms

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
							// Set speaking state when streaming starts
							if (event.token && logoState !== "speaking") {
								setLogoState("speaking")
							}
							
							// Accumulate token content
							if (event.token) {
								accumulatedContent += event.token
							}
							
							// Throttle UI updates to avoid jank
							const now = Date.now()
							if (now - lastUpdateTime >= UPDATE_THROTTLE || event.done) {
								lastUpdateTime = now
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
							}
							
							// If done, use final_content and capture turn_steps
							if (event.done && event.final_content) {
								finalTurnSteps = event.turn_steps || []
								// Always update when done, even if throttled
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
	}, [input, uploadedFilename, replyingTo, conversationId, isLoading])

	// Update logo state based on loading state
	// Note: logoState is also updated in sendMessage when streaming starts
	useEffect(() => {
		if (!isLoading) {
			setLogoState("idle")
		}
		// Don't override "speaking" state when isLoading is true
		// The sendMessage function will set it to "speaking" when tokens arrive
	}, [isLoading])

	return (
		<div
			ref={containerRef}
			className="h-screen w-screen flex flex-col text-soft-white overflow-hidden"
			style={{ background: "transparent" }}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			{/* Cymatics Background */}
			<CymaticsBackground isActive={isActive} />
			
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
			
			{/* Fixed Header - Compact and Fancy */}
			<header className="fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
				<div className="w-full max-w-xl mx-auto px-4">
					<div className="border border-white/10 py-2.5 px-5 glass rounded-full flex items-center justify-between backdrop-blur-xl shadow-lg pointer-events-auto mt-3">
						<button
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
						>
							<IconMenu2 size={16} className="text-muted-blue-gray" />
						</button>
						<div className="flex items-center justify-center gap-2">
							<AnimatedLogo />
							<h1 className="text-base font-medium text-soft-white tracking-tight">Vega</h1>
						</div>
						<button
							onClick={createNewConversation}
							className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
							title="New Chat"
						>
							<IconPlus size={16} className="text-muted-blue-gray" />
						</button>
					</div>
				</div>
			</header>

			{/* Main chat area */}
			<div className="flex-1 flex flex-col items-center relative z-10 pt-16">
				<div className="w-full max-w-4xl flex flex-col h-full">
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
			{!isVoiceMode && (
				<div className="flex-shrink-0 bg-transparent z-20">
					<div className="relative w-full max-w-4xl mx-auto px-2 pt-2 pb-6 sm:px-6">
						<ChatInputArea
							input={input}
							handleInputChange={handleInputChange}
							sendMessage={sendMessage}
							textareaRef={textareaRef}
							uploadedFilename={uploadedFilename}
							isUploading={isUploading}
							fileInputRef={fileInputRef}
							handleFileChange={handleFileChange}
							integrations={integrations}
							toolIcons={{}}
							setIsWelcomeModalOpen={setIsWelcomeModalOpen}
							toggleVoiceMode={toggleVoiceMode}
							isPro={false}
							thinking={isLoading}
							handleStopStreaming={handleStopStreaming}
							replyingTo={replyingTo}
							setReplyingTo={setReplyingTo}
							setUploadedFilename={setUploadedFilename}
							setSelectedFile={setSelectedFile}
						/>
					</div>
				</div>
			)}
		</div>
	)
}
