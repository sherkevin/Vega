"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { IconSend, IconLoader } from "@tabler/icons-react"

const ChatInputArea = ({ value, onChange, onSend, isLoading, placeholder = "Type your message..." }) => {
	const [isFocused, setIsFocused] = useState(false)
	const textareaRef = useRef(null)

	// 自动调整高度
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px"
			const scrollHeight = textareaRef.current.scrollHeight
			textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`
		}
	}, [value])

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			if (!isLoading && value.trim()) {
				onSend()
			}
		}
	}

	return (
		<motion.div
			initial={{ y: 20, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20"
		>
			<motion.div
				className={`glass-strong rounded-full px-4 py-3 flex items-end gap-3 transition-all duration-300 ${
					isFocused
						? "shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30"
						: "shadow-lg shadow-blue-500/10"
				}`}
				animate={{
					scale: isFocused ? 1.02 : 1
				}}
			>
				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyPress={handleKeyPress}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					placeholder={placeholder}
					disabled={isLoading}
					className="flex-1 bg-transparent text-soft-white placeholder-muted-blue-gray resize-none focus:outline-none font-light leading-relaxed text-sm md:text-base"
					style={{
						minHeight: "44px",
						maxHeight: "200px",
						lineHeight: "1.6"
					}}
				/>
				<motion.button
					onClick={onSend}
					disabled={!value.trim() || isLoading}
					className="bg-soul-blue hover:bg-blue-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white p-3 rounded-full flex items-center justify-center min-w-[48px] transition-colors disabled:opacity-50"
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					{isLoading ? (
						<IconLoader className="animate-spin" size={20} />
					) : (
						<IconSend size={20} />
					)}
				</motion.button>
			</motion.div>

			{/* 聚焦时的流光边框效果 */}
			{isFocused && (
				<motion.div
					className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
					style={{
						background: `linear-gradient(90deg, transparent, rgba(74, 158, 255, 0.3), transparent)`,
						backgroundSize: "200% 100%",
						animation: "shimmer 3s linear infinite",
						borderRadius: "9999px",
						padding: "2px",
						WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
						WebkitMaskComposite: "xor",
						mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
						maskComposite: "exclude"
					}}
				/>
			)}
		</motion.div>
	)
}

export default ChatInputArea

