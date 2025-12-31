"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

const AuroraBackground = () => {
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768)
		}
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	// 移动端禁用或简化
	if (isMobile) {
		return null
	}

	return (
		<div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0F0F13] pointer-events-none">
			{/* 主光斑：Sentient Blue */}
			<motion.div
				animate={{
					x: [0, 100, 0],
					y: [0, -50, 0],
					scale: [1, 1.2, 1],
				}}
				transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
				className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vw] bg-sentient-blue/20 rounded-full blur-[100px]"
			/>
			
			{/* 暖光斑：Amber/Gold (陪伴感核心) */}
			<motion.div
				animate={{
					x: [0, -50, 0],
					y: [0, 50, 0],
					scale: [1, 1.1, 1],
				}}
				transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
				className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] bg-brand-orange/15 rounded-full blur-[80px]"
			/>

			{/* 神秘光斑：Soft Purple */}
			<motion.div
				animate={{
					x: [0, 30, 0],
					y: [0, 30, 0],
				}}
				transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
				className="absolute bottom-[-10%] left-[30%] w-[60vw] h-[40vw] bg-purple-900/20 rounded-full blur-[120px]"
			/>
			
			{/* 噪点纹理 (增加质感) */}
			<div
				className="absolute inset-0 opacity-[0.03]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
					backgroundSize: "200px 200px"
				}}
			/>
		</div>
	)
}

export default AuroraBackground

