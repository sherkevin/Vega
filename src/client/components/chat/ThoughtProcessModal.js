"use client"

import { motion, AnimatePresence } from "framer-motion"
import { IconX } from "@tabler/icons-react"

const ThoughtProcessModal = ({ isOpen, onClose, turnSteps = [] }) => {
	if (!isOpen) return null

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Overlay */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, y: 20, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 20, scale: 0.95 }}
						className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-2xl mx-auto max-h-[80vh] glass rounded-2xl p-6 z-50 overflow-hidden flex flex-col"
					>
						{/* Header */}
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold text-soft-white">
								Vega's Thought Process
							</h3>
							<button
								onClick={onClose}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors"
							>
								<IconX size={20} className="text-muted-blue-gray" />
							</button>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto custom-scrollbar">
							{turnSteps && turnSteps.length > 0 ? (
								<div className="space-y-4">
									{turnSteps.map((step, index) => (
										<div
											key={index}
											className="bg-white/5 rounded-lg p-4 border border-white/10"
										>
											<div className="text-xs text-muted-blue-gray mb-2 uppercase tracking-wide">
												{step.type || "thought"}
											</div>
											<div className="text-sm text-soft-white font-light leading-relaxed whitespace-pre-wrap">
												{step.content || JSON.stringify(step, null, 2)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center text-muted-blue-gray py-8">
									No thought process data available
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}

export default ThoughtProcessModal

