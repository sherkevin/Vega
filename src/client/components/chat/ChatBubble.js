"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import ThoughtProcessModal from "./ThoughtProcessModal"
import TypewriterText from "@components/ui/TypewriterText"

const ChatBubble = ({ message, isStreaming = false }) => {
	const [showThoughtProcess, setShowThoughtProcess] = useState(false)
	const isUser = message.role === "user"
	const hasThoughtProcess = message.turn_steps && message.turn_steps.length > 0

	return (
		<>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
				className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}
			>
				<div
					className={`max-w-[85%] px-4 py-3 ${
						isUser
							? "bg-blue-600/40 rounded-3xl rounded-tr-sm"
							: "glass rounded-3xl rounded-tl-sm bg-gradient-to-br from-white/10 to-transparent"
					}`}
				>
					{/* 消息内容 */}
					<div className="text-soft-white font-light leading-7">
						{isStreaming && !isUser ? (
							<TypewriterText text={message.content || ""} speed={20} />
						) : (
							<span className="whitespace-pre-wrap">{message.content}</span>
						)}
					</div>

					{/* 思维链指示器（仅 Agent 消息） */}
					{!isUser && hasThoughtProcess && (
						<button
							onClick={() => setShowThoughtProcess(true)}
							className="mt-2 flex items-center gap-2 text-xs text-muted-blue-gray hover:text-soft-white transition-colors group"
						>
							<motion.div
								className="w-2 h-2 rounded-full bg-warm-amber"
								animate={{
									scale: [1, 1.2, 1],
									opacity: [0.6, 1, 0.6]
								}}
								transition={{
									duration: 1.5,
									repeat: Infinity,
									ease: "easeInOut"
								}}
							/>
							<span className="group-hover:underline">Vega is thinking...</span>
						</button>
					)}
				</div>
			</motion.div>

			{/* 思维链 Modal */}
			<ThoughtProcessModal
				isOpen={showThoughtProcess}
				onClose={() => setShowThoughtProcess(false)}
				turnSteps={message.turn_steps}
			/>
		</>
	)
}

export default ChatBubble

