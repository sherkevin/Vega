/**
 * @Author: shervin sherkevin@163.com
 * @Date: 2025-12-31 10:48:04
 * @Description: 
 * @FilePath: \Vega\src\client\components\ui\WelcomeSequence.js
 * @LastEditTime: 2025-12-31 15:00:57
 * @LastEditors: shervin sherkevin@163.com
 * @Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import ParticleOrb from "./ParticleOrb"

const WelcomeSequence = ({ onComplete }) => {
	const [stage, setStage] = useState(0) // 0: 黑屏, 1: Logo亮起, 2: 文字浮现, 3: 完成

	useEffect(() => {
		// Stage 0: 黑屏 (0.5s)
		const timer1 = setTimeout(() => setStage(1), 500)

		// Stage 1: Logo亮起 (1.5s)
		const timer2 = setTimeout(() => setStage(2), 2000)

		// Stage 2: 文字浮现 (2s)
		const timer3 = setTimeout(() => setStage(3), 4000)

		// Stage 3: 完成 (1s后调用onComplete)
		const timer4 = setTimeout(() => {
			if (onComplete) onComplete()
		}, 5000)

		return () => {
			clearTimeout(timer1)
			clearTimeout(timer2)
			clearTimeout(timer3)
			clearTimeout(timer4)
		}
	}, [onComplete])

	// 获取问候语（根据时间）
	const getGreeting = () => {
		const hour = new Date().getHours()
		if (hour < 12) return "Good Morning"
		if (hour < 18) return "Good Afternoon"
		return "Good Evening"
	}

	return (
		<AnimatePresence>
			{stage < 3 && (
				<motion.div
					initial={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
					className="fixed inset-0 bg-deep-space z-[100] flex items-center justify-center"
				>
					{/* Stage 0-1: Logo */}
					{stage >= 1 && (
						<motion.div
							initial={{ opacity: 0, scale: 0.5 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 1, ease: "easeOut" }}
							className="absolute"
						>
							<ParticleOrb size={120} />
						</motion.div>
					)}

					{/* Stage 2: 文字 */}
					{stage >= 2 && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.2 }}
							className="absolute bottom-32 text-center"
						>
							<motion.p
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.5 }}
								className="text-2xl font-light text-soft-white mb-2"
							>
								{getGreeting()}, Ready to dive in?
							</motion.p>
						</motion.div>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export default WelcomeSequence

