"use client"

import {
	IconSend,
	IconPlayerStopFilled,
	IconTool,
	IconInfoCircle,
	IconPaperclip,
	IconLoader,
	IconHeadphonesFilled,
	IconX,
	IconFile,
	IconArrowBackUp
} from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import TextLoop from "@components/ui/TextLoop"
import { Button } from "@components/ui/button"
import useClickOutside from "@hooks/useClickOutside"
import { useState, useMemo, useRef } from "react"
import { cn } from "@utils/cn"

const ChatInputArea = ({
	input,
	handleInputChange,
	sendMessage,
	textareaRef,
	uploadedFilename,
	isUploading,
	fileInputRef,
	handleFileChange,
	integrations = [],
	toolIcons = {},
	setIsWelcomeModalOpen,
	toggleVoiceMode,
	isPro = false,
	thinking,
	handleStopStreaming,
	replyingTo,
	setReplyingTo,
	setUploadedFilename,
	setSelectedFile
}) => {
	const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const toolsMenuRef = useRef(null)
	const toolsButtonRef = useRef(null)

	useClickOutside(toolsMenuRef, (event) => {
		if (
			toolsButtonRef.current &&
			!toolsButtonRef.current.contains(event.target)
		) {
			setIsToolsMenuOpen(false)
		}
	})

	const { connectedTools, builtinTools } = useMemo(() => {
		const hiddenTools = ["progress_updater", "chat_tools", "tasks", "google_search"]
		const connected = integrations.filter(
			(i) => i.connected && (i.auth_type === "oauth" || i.auth_type === "manual")
		)
		const builtin = integrations.filter(
			(i) => i.auth_type === "builtin" && !hiddenTools.includes(i.name)
		)
		return { connectedTools: connected, builtinTools: builtin }
	}, [integrations])

	// 处理发送：增加防抖防止重复点击，增加控制台日志方便调试
	const handleSendClick = (e) => {
		e.preventDefault() // 防止默认行为
		e.stopPropagation()
		console.log("Send button clicked", { input, uploadedFilename, thinking })
		if ((input.trim() || uploadedFilename) && !thinking && !isUploading) {
			sendMessage()
		}
	}

	// 自动调整高度
	const handleTextareaChange = (e) => {
		handleInputChange(e)
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px"
			const scrollHeight = textareaRef.current.scrollHeight
			textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`
		}
	}

	// 胶囊容器样式：全圆角，毛玻璃，边框光晕
	const containerClasses = cn(
		"relative transition-all duration-300 ease-out",
		"bg-neutral-900/60 backdrop-blur-xl", // 更深的背景，更好的对比度
		"border rounded-[28px]", // 胶囊形状
		isFocused 
			? "border-brand-orange/50 shadow-[0_0_20px_-5px_rgba(241,162,29,0.3)] ring-1 ring-brand-orange/20" 
			: "border-white/10 shadow-lg"
	)

	return (
		<div className="relative w-full max-w-3xl mx-auto" style={{ isolation: "isolate" }}>
			{/* 上方浮出的状态提示 (Reply / File) */}
			<div className="absolute bottom-full left-0 right-0 mb-2 px-4 flex flex-col gap-2 z-0">
				<AnimatePresence>
					{replyingTo && (
						<motion.div
							initial={{ opacity: 0, y: 10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.95 }}
							className="bg-neutral-800/80 backdrop-blur-md p-2 px-4 rounded-2xl border border-white/5 flex items-center justify-between text-sm shadow-xl"
						>
							<span className="text-neutral-300 truncate max-w-[80%] flex items-center gap-2">
								<IconArrowBackUp size={14} className="text-brand-orange"/>
								Replying to: <span className="text-white italic">{replyingTo.content?.slice(0, 30)}...</span>
							</span>
							<button onClick={() => setReplyingTo(null)} className="text-neutral-400 hover:text-white"><IconX size={14}/></button>
						</motion.div>
					)}
					{uploadedFilename && (
						<motion.div
							initial={{ opacity: 0, y: 10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.95 }}
							className="bg-neutral-800/80 backdrop-blur-md p-2 px-4 rounded-2xl border border-white/5 flex items-center justify-between text-sm shadow-xl"
						>
							<span className="text-brand-orange truncate max-w-[80%] flex items-center gap-2">
								<IconFile size={14}/>
								{uploadedFilename}
							</span>
							<button onClick={() => { setUploadedFilename(null); setSelectedFile(null); }} className="text-neutral-400 hover:text-white"><IconX size={14}/></button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div 
				className={containerClasses}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
			>
				<div className="relative p-3 pl-5 flex items-end gap-3">
					<div className="flex-1 py-2 relative min-h-[44px] flex items-center">
						{/* Textarea */}
						<textarea
							ref={textareaRef}
							value={input}
							onChange={handleTextareaChange}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault()
									if ((input.trim() || uploadedFilename) && !thinking && !isUploading) {
										sendMessage()
									}
								}
							}}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
							placeholder=""
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck="false"
							className="w-full bg-transparent text-[15px] leading-relaxed text-white placeholder-transparent resize-none focus:ring-0 focus:outline-none custom-scrollbar z-10"
							rows={1}
							style={{ maxHeight: "200px" }}
						/>
						
						{/* 灵动的 Placeholder Loop */}
						{!input && !uploadedFilename && (
							<div className="absolute inset-0 flex items-center text-neutral-500 pointer-events-none z-0">
								<TextLoop className="text-[15px] font-light tracking-wide opacity-60">
									<span>How can I help you today?</span>
									<span>Analyze this document...</span>
									<span>Draft a weekly report...</span>
									<span>Schedule a meeting...</span>
								</TextLoop>
							</div>
						)}
					</div>

					{/* 右侧操作区：文件 & 发送 */}
					<div className="flex items-center gap-2 pb-1">
						{/* 附件按钮 */}
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleFileChange}
							className="hidden"
							accept=".csv,.doc,.docx,.pdf,.txt,.xlsx,.xls,.png,.jpg"
						/>
						<Button
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
							variant="ghost"
							size="icon"
							className="rounded-full w-9 h-9 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
						>
							{isUploading ? <IconLoader size={18} className="animate-spin" /> : <IconPaperclip size={18} />}
						</Button>

						{/* 语音按钮 (Pro) */}
						{isPro && (
							<Button
								onClick={toggleVoiceMode}
								variant="ghost"
								size="icon"
								className="rounded-full w-9 h-9 text-neutral-400 hover:text-brand-orange hover:bg-brand-orange/10 transition-colors"
							>
								<IconHeadphonesFilled size={18} />
							</Button>
						)}

						{/* 发送按钮 - 视觉焦点 */}
						{thinking ? (
							<Button
								onClick={handleStopStreaming}
								className="rounded-full w-10 h-10 bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-all duration-300"
							>
								<IconPlayerStopFilled size={18} />
							</Button>
						) : (
							<Button
								onClick={handleSendClick}
								disabled={(!input.trim() && !uploadedFilename) || isUploading}
								className={cn(
									"rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 shadow-lg",
									(!input.trim() && !uploadedFilename) 
										? "bg-neutral-700 text-neutral-500 opacity-50 cursor-not-allowed" 
										: "bg-brand-orange hover:bg-brand-orange/90 text-brand-black scale-100 hover:scale-105"
								)}
							>
								<IconSend size={18} className={cn((input.trim() || uploadedFilename) && "ml-0.5")} />
							</Button>
						)}
					</div>
				</div>

				{/* 底部小工具栏 */}
				<div className="px-5 pb-3 pt-0 flex items-center gap-4 border-t border-white/5 mt-1">
					<button 
						ref={toolsButtonRef}
						onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
						className="flex items-center gap-2 text-xs text-neutral-400 hover:text-brand-orange transition-colors py-2"
					>
						<IconTool size={14} />
						<span className="font-medium">Tools</span>
					</button>
					<div className="h-3 w-[1px] bg-white/10"></div>
					{setIsWelcomeModalOpen && (
						<button 
							onClick={() => setIsWelcomeModalOpen(true)}
							className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors py-2"
						>
							<IconInfoCircle size={14} />
							<span>About</span>
						</button>
					)}
				</div>
			</div>
			
			{/* Tools Menu Popup */}
			<AnimatePresence>
				{isToolsMenuOpen && (
					<motion.div
						ref={toolsMenuRef}
						initial={{ opacity: 0, y: 10, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.95 }}
						className="absolute bottom-[110%] left-0 w-64 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
					>
						<div className="max-h-60 overflow-y-auto custom-scrollbar">
							{connectedTools.length === 0 && builtinTools.length === 0 ? (
								<div className="p-4 text-center text-neutral-500 text-sm">
									No tools available
								</div>
							) : (
								<>
									{connectedTools.map((tool) => (
										<div key={tool.name} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-neutral-300 text-sm">
											<span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
											{tool.display_name || tool.name}
										</div>
									))}
									{builtinTools.map((tool) => (
										<div key={tool.name} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-neutral-300 text-sm">
											<span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
											{tool.display_name || tool.name}
										</div>
									))}
								</>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ChatInputArea
