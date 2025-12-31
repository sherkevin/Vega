"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

const AnimatedLogo = ({ state = "idle" }) => {
	const [colorShift, setColorShift] = useState(0)

	// 颜色流转动画（仅在 idle 状态）
	useEffect(() => {
		if (state === "idle") {
			const interval = setInterval(() => {
				setColorShift((prev) => (prev + 1) % 360)
			}, 50)
			return () => clearInterval(interval)
		}
	}, [state])

	// 根据状态确定样式
	const getStateStyles = () => {
		switch (state) {
			case "thinking":
				return {
					scale: 0.9,
					gradient: "from-white via-blue-400 to-blue-600",
					glow: "0 0 40px rgba(255, 255, 255, 0.8), 0 0 80px rgba(74, 158, 255, 0.6)",
					rotation: 360
				}
			case "speaking":
				return {
					scale: [1.0, 1.05, 1.0],
					gradient: "from-blue-400 via-purple-500 to-amber-400",
					glow: "0 0 30px rgba(255, 209, 102, 0.6), 0 0 60px rgba(74, 158, 255, 0.4)",
					rotation: 0
				}
			default: // idle
				return {
					scale: [1.0, 1.1, 1.0],
					gradient: `from-blue-400 via-purple-500 to-blue-600`,
					glow: `0 0 20px rgba(74, 158, 255, 0.4), 0 0 40px rgba(157, 78, 221, 0.3)`,
					rotation: 0
				}
		}
	}

	const styles = getStateStyles()

	return (
		<motion.div
			className="relative flex items-center justify-center"
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.5 }}
		>
			<motion.div
				className="relative w-16 h-16 rounded-full"
				style={{
					background: `radial-gradient(circle at 30% 30%, rgba(74, 158, 255, 0.9), rgba(157, 78, 221, 0.7), rgba(74, 158, 255, 0.5))`,
					boxShadow: styles.glow,
					filter: state === "thinking" ? "brightness(1.2)" : "brightness(1)",
					willChange: "transform, box-shadow"
				}}
				animate={{
					scale: styles.scale,
					rotate: state === "thinking" ? styles.rotation : 0
				}}
				transition={{
					duration: state === "idle" ? 3 : state === "thinking" ? 2 : 1.5,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut"
				}}
			>
				{/* 中心高光 */}
				<div
					className="absolute inset-0 rounded-full"
					style={{
						background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 60%)`
					}}
				/>
				{/* 外层光晕（speaking 状态） */}
				{state === "speaking" && (
					<motion.div
						className="absolute inset-0 rounded-full"
						style={{
							background: `radial-gradient(circle, rgba(255, 209, 102, 0.3), transparent 70%)`,
							filter: "blur(10px)"
						}}
						animate={{
							scale: [1, 1.3, 1],
							opacity: [0.5, 0.8, 0.5]
						}}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "easeInOut"
						}}
					/>
				)}
			</motion.div>
		</motion.div>
	)
}

export default AnimatedLogo

